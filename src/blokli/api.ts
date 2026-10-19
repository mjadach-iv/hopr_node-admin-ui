import { formatEther, getAddress } from 'viem';
import { queryBlokli, tryUnwrapUnion, unwrapUnion } from './client';
import { getRedeemedPerChannel } from '../chain/spent';
import {
  parseTokenValue,
  type BlokliChannelStatus,
  type BlokliChannelType,
  type ChannelStatsType,
  type NodeChannelsType,
  type SafeChannelStatsType,
  type SafeNodeType,
  type TicketRedemptionType,
  type TokenValueString,
  type TokenValueType,
} from './types';

export type BlokliPayloadType = {
  blokliUrl: string;
  timeout?: number;
};

// Gnosis RPCs for the channel events blokli does not index, in fallback order
type RpcPayloadType = { rpcUrls: string[] };

const CHANNEL_STATS_RESULT = `{
      __typename
      ... on ChannelStats {
        count
        balance
      }
      ... on InvalidAddressError {
        code
        message
      }
      ... on QueryFailedError {
        code
        message
      }
    }`;

const CHANNEL_STATS_QUERY = `
  query AdminChannelStats($safeAddress: String!) {
    channelStats(safeAddress: $safeAddress, status: OPEN) ${CHANNEL_STATS_RESULT}
    closing: channelStats(safeAddress: $safeAddress, status: PENDINGTOCLOSE) ${CHANNEL_STATS_RESULT}
    safeBalance: hoprBalance(address: $safeAddress) {
      __typename
      ... on HoprBalance {
        balance
      }
      ... on InvalidAddressError {
        code
        message
      }
      ... on QueryFailedError {
        code
        message
      }
    }
  }
`;

const toChannelStats = (stats: { count: number; balance: TokenValueString }): ChannelStatsType => ({
  count: stats.count,
  ...parseTokenValue(stats.balance),
});

/**
 * wxHOPR in the OPEN outgoing channels of every node registered to the safe, and
 * alongside it the closing channels and the safe's own balance, so a channel being
 * opened or closed is counted on one side or the other. The safeAddress filter is
 * source-side only, so this is outgoing-only by definition, and blokli does the sums
 * server side - no need to enumerate the safe's nodes.
 */
export const getChannelStats = async (
  payload: BlokliPayloadType & { safeAddress: string },
): Promise<SafeChannelStatsType> => {
  type StatsResult = { __typename?: string; count?: number; balance?: TokenValueString } | null;
  const data = await queryBlokli<{
    channelStats: StatsResult;
    closing: StatsResult;
    safeBalance: { __typename?: string; balance?: TokenValueString } | null;
  }>(payload.blokliUrl, CHANNEL_STATS_QUERY, { safeAddress: payload.safeAddress }, payload.timeout);

  const open = unwrapUnion<{ count: number; balance: TokenValueString }>(data.channelStats, 'ChannelStats');
  const closing = tryUnwrapUnion<{ count: number; balance: TokenValueString }>(data.closing, 'ChannelStats');
  const safeBalance = tryUnwrapUnion<{ balance: TokenValueString }>(data.safeBalance, 'HoprBalance');

  return {
    ...toChannelStats(open),
    closing: closing ? toChannelStats(closing) : null,
    safeBalance: safeBalance ? parseTokenValue(safeBalance.balance) : null,
  };
};

const TICKET_REDEMPTION_QUERY = `
  query AdminTicketRedemptionStats($nodeAddress: String!) {
    ticketRedemptionStats(filter: { nodeAddress: $nodeAddress }) {
      __typename
      ... on RedeemedStats {
        redeemedAmount
        redemptionCount
        rejectedAmount
        rejectionCount
      }
      ... on InvalidAddressError {
        code
        message
      }
      ... on MissingFilterError {
        code
        message
      }
      ... on QueryFailedError {
        code
        message
      }
    }
  }
`;

/**
 * Lifetime on-chain ticket redemptions for a node. Unlike the node's own ticket
 * statistics this is not reset when the node database is wiped.
 */
export const getTicketRedemptionStats = async (
  payload: BlokliPayloadType & { nodeAddress: string },
): Promise<TicketRedemptionType> => {
  const data = await queryBlokli<{
    ticketRedemptionStats: { __typename?: string } | null;
  }>(payload.blokliUrl, TICKET_REDEMPTION_QUERY, { nodeAddress: payload.nodeAddress }, payload.timeout);

  const stats = unwrapUnion<{
    redeemedAmount: TokenValueString;
    redemptionCount: string;
    rejectedAmount: TokenValueString;
    rejectionCount: string;
  }>(data.ticketRedemptionStats, 'RedeemedStats');

  return {
    redeemed: parseTokenValue(stats.redeemedAmount),
    // UInt64 fields come back as strings, keep them as such
    redemptionCount: stats.redemptionCount,
    rejected: parseTokenValue(stats.rejectedAmount),
    rejectionCount: stats.rejectionCount,
  };
};

// safe(address:) is deprecated in blokli's target schema in favor of
// safeBy(address:, selector:), the swap is mechanical once deployed everywhere
const SAFE_NODES_QUERY = `
  query AdminSafeNodes($safeAddress: String!) {
    safe(address: $safeAddress) {
      __typename
      ... on Safe {
        registeredNodes
      }
      ... on InvalidAddressError {
        code
        message
      }
      ... on QueryFailedError {
        code
        message
      }
    }
  }
`;

// one request for the OPEN channels of the whole safe, grouped by source keyid
// client side - much cheaper than per node channelStats calls
const SAFE_CHANNELS_QUERY = `
  query AdminSafeChannels($safeAddress: String!) {
    channels(safeAddress: $safeAddress) {
      __typename
      ... on ChannelsList {
        channels {
          concreteChannelId
          source
          balance
          status
        }
      }
      ... on MissingFilterError {
        code
        message
      }
      ... on InvalidAddressError {
        code
        message
      }
      ... on QueryFailedError {
        code
        message
      }
    }
    chainInfo {
      __typename
      ... on ChainInfo {
        contractAddresses
      }
      ... on QueryFailedError {
        code
        message
      }
    }
  }
`;

/**
 * Blokli enforces a query complexity budget of 500 per request and weighs the
 * RPC-backed root fields: nativeBalance costs 50 and ticketRedemptionStats 100,
 * so the aliased batches below are chunked to stay under the budget.
 */
const ACCOUNTS_PER_REQUEST = 40;
const NATIVE_BALANCES_PER_REQUEST = 8;
const REDEMPTIONS_PER_REQUEST = 4;

type BatchResultType = Record<string, { __typename?: string } | null>;

/**
 * Runs an aliased batch query in chunks, binding values[i] to $a{i}. A failing
 * chunk is only logged, so its aliases are missing from the merged result.
 */
const runChunked = async (
  payload: BlokliPayloadType,
  values: (string | number)[],
  chunkSize: number,
  buildQuery: (chunkIndexes: number[]) => string,
): Promise<BatchResultType> => {
  const indexes = values.map((_, i) => i);
  const chunks: number[][] = [];
  for (let start = 0; start < indexes.length; start += chunkSize) {
    chunks.push(indexes.slice(start, start + chunkSize));
  }
  const merged: BatchResultType = {};
  await Promise.all(
    chunks.map(async (chunkIndexes) => {
      try {
        const data = await queryBlokli<BatchResultType>(
          payload.blokliUrl,
          buildQuery(chunkIndexes),
          Object.fromEntries(chunkIndexes.map((i) => [`a${i}`, values[i]])),
          payload.timeout,
        );
        Object.assign(merged, data);
      } catch (e) {
        console.warn('Blokli batched request failed', e);
      }
    }),
  );
  return merged;
};

const buildAccountsQuery = (indexes: number[]) => {
  const variables = indexes.map((i) => `$a${i}: String!`).join(', ');
  const fields = indexes
    .map(
      (i) => `
    k${i}: accounts(chainKey: $a${i}) {
      __typename
      ... on AccountsList {
        accounts {
          keyid
          chainKey
        }
      }
      ... on MissingFilterError {
        code
        message
      }
      ... on QueryFailedError {
        code
        message
      }
    }`,
    )
    .join('\n');
  return `query AdminSafeNodeAccounts(${variables}) {${fields}
  }`;
};

const buildNativeBalancesQuery = (indexes: number[]) => {
  const variables = indexes.map((i) => `$a${i}: String!`).join(', ');
  const fields = indexes
    .map(
      (i) => `
    b${i}: nativeBalance(address: $a${i}) {
      __typename
      ... on NativeBalance {
        balance
      }
      ... on InvalidAddressError {
        code
        message
      }
      ... on QueryFailedError {
        code
        message
      }
    }`,
    )
    .join('\n');
  return `query AdminSafeNodeNativeBalances(${variables}) {${fields}
  }`;
};

const buildRedemptionsQuery = (indexes: number[]) => {
  const variables = indexes.map((i) => `$a${i}: String!`).join(', ');
  const fields = indexes
    .map(
      (i) => `
    r${i}: ticketRedemptionStats(filter: { nodeAddress: $a${i} }) {
      __typename
      ... on RedeemedStats {
        redeemedAmount
      }
      ... on InvalidAddressError {
        code
        message
      }
      ... on MissingFilterError {
        code
        message
      }
      ... on QueryFailedError {
        code
        message
      }
    }`,
    )
    .join('\n');
  return `query AdminSafeNodeRedemptions(${variables}) {${fields}
  }`;
};

/**
 * All nodes registered to the safe with their xDai balance, OPEN outgoing channel
 * stats and lifetime redeemed amount. Blokli has no single query for it, so this
 * assembles: safe() for the node list, one channels(safeAddress) request grouped
 * by source keyid client side, and complexity-chunked aliased batches for the
 * accounts, native balances and redemptions. Only the safe() lookup is a hard
 * failure - any other failing request or per node field just nulls the affected
 * cells, rendered as '-'.
 */
type SafeChannelType = { concreteChannelId: string; source: number; balance: TokenValueString; status: string };

const safeChannelId = (channel: SafeChannelType) => `0x${channel.concreteChannelId.toLowerCase().replace(/^0x/, '')}`;

export const getSafeNodes = async (
  payload: BlokliPayloadType & RpcPayloadType & { safeAddress: string },
): Promise<SafeNodeType[]> => {
  const safeData = await queryBlokli<{
    safe: { __typename?: string; registeredNodes?: string[] } | null;
  }>(payload.blokliUrl, SAFE_NODES_QUERY, { safeAddress: payload.safeAddress }, payload.timeout);

  // blokli answers null (not an error member) when it does not know the safe
  if (safeData.safe === null) {
    console.warn(`Blokli does not know safe ${payload.safeAddress}`);
    return [];
  }
  const safe = unwrapUnion<{ registeredNodes: string[] }>(safeData.safe, 'Safe');

  // checksummed so the addresses match the alias and channel maps of the node slice
  const nodeAddresses = [...safe.registeredNodes].map((address) => getAddress(address)).sort();
  if (nodeAddresses.length === 0) return [];

  const [accountsData, nativeData, redemptionData, channelsList] = await Promise.all([
    runChunked(payload, nodeAddresses, ACCOUNTS_PER_REQUEST, buildAccountsQuery),
    runChunked(payload, nodeAddresses, NATIVE_BALANCES_PER_REQUEST, buildNativeBalancesQuery),
    runChunked(payload, nodeAddresses, REDEMPTIONS_PER_REQUEST, buildRedemptionsQuery),
    queryBlokli<{ channels: { __typename?: string } | null; chainInfo: { __typename?: string } | null }>(
      payload.blokliUrl,
      SAFE_CHANNELS_QUERY,
      { safeAddress: payload.safeAddress },
      payload.timeout,
    )
      .then((data) => ({
        channels: tryUnwrapUnion<{ channels: SafeChannelType[] }>(data.channels, 'ChannelsList')?.channels ?? null,
        contractAddresses: tryUnwrapUnion<{ contractAddresses: string }>(data.chainInfo, 'ChainInfo')
          ?.contractAddresses,
      }))
      .catch((e) => {
        console.warn('Blokli safe channels request failed', e);
        return { channels: null, contractAddresses: undefined };
      }),
  ]);

  // every channel the safe funded, closed ones too, so a node's spent covers its whole history
  let redeemedById: Record<string, bigint> | null = null;
  let rpcBroken = false;
  if (channelsList.channels && channelsList.contractAddresses) {
    try {
      redeemedById = await getRedeemedPerChannel({
        rpcUrls: payload.rpcUrls,
        channelsContract: (JSON.parse(channelsList.contractAddresses) as { channels: string }).channels,
        channelIds: channelsList.channels.map(safeChannelId),
      });
    } catch (e) {
      rpcBroken = true;
      console.warn('Could not read the safe channel redemptions', e);
    }
  }

  return nodeAddresses.map((nodeAddress, i) => {
    const accountsList = tryUnwrapUnion<{ accounts: { keyid: number; chainKey: string }[] }>(
      accountsData[`k${i}`],
      'AccountsList',
    );
    const keyid =
      accountsList?.accounts.find((account) => account.chainKey.toLowerCase() === nodeAddress.toLowerCase())?.keyid ??
      null;
    const native = tryUnwrapUnion<{ balance: TokenValueString }>(nativeData[`b${i}`], 'NativeBalance');
    const redeemedStats = tryUnwrapUnion<{ redeemedAmount: TokenValueString }>(
      redemptionData[`r${i}`],
      'RedeemedStats',
    );

    // a resolved keyid with no matching channels is real data (0 channels),
    // an unresolved keyid or a failed channels request is unknown ('-')
    let channels: ChannelStatsType | null = null;
    let spent: TokenValueType | null = null;
    if (channelsList.channels && keyid !== null) {
      const outgoing = channelsList.channels.filter((channel) => channel.source === keyid);
      const open = outgoing.filter((channel) => channel.status === 'OPEN');
      const value = open.reduce((sum, channel) => sum + BigInt(parseTokenValue(channel.balance).value), BigInt(0));
      channels = {
        count: open.length,
        value: value.toString(),
        formatted: formatEther(value),
      };
      if (redeemedById) {
        const spentValue = outgoing.reduce(
          (sum, channel) => sum + (redeemedById?.[safeChannelId(channel)] ?? BigInt(0)),
          BigInt(0),
        );
        spent = { value: spentValue.toString(), formatted: formatEther(spentValue) };
      }
    }

    return {
      nodeAddress,
      xDai: native ? parseTokenValue(native.balance) : null,
      channels,
      redeemed: redeemedStats ? parseTokenValue(redeemedStats.redeemedAmount) : null,
      spent,
      rpcBroken,
    };
  });
};

const NODE_ACCOUNT_QUERY = `
  query AdminNodeAccount($nodeAddress: String!) {
    accounts(chainKey: $nodeAddress) {
      __typename
      ... on AccountsList {
        accounts {
          keyid
          chainKey
        }
      }
      ... on MissingFilterError {
        code
        message
      }
      ... on QueryFailedError {
        code
        message
      }
    }
    chainInfo {
      __typename
      ... on ChainInfo {
        ticketPrice
        contractAddresses
      }
      ... on QueryFailedError {
        code
        message
      }
    }
  }
`;

const NODE_CHANNELS_RESULT = `
      __typename
      ... on ChannelsList {
        channels {
          concreteChannelId
          source
          destination
          balance
          status
          epoch
          ticketIndex
          closureTime
        }
      }
      ... on MissingFilterError {
        code
        message
      }
      ... on InvalidAddressError {
        code
        message
      }
      ... on QueryFailedError {
        code
        message
      }`;

// no status filter, closed channels are wanted too
const NODE_CHANNELS_QUERY = `
  query AdminNodeChannels($keyid: Int!) {
    outgoing: channels(sourceKeyId: $keyid) {${NODE_CHANNELS_RESULT}
    }
    incoming: channels(destinationKeyId: $keyid) {${NODE_CHANNELS_RESULT}
    }
  }
`;

const buildAccountsByKeyidQuery = (indexes: number[]) => {
  const variables = indexes.map((i) => `$a${i}: Int!`).join(', ');
  const fields = indexes
    .map(
      (i) => `
    k${i}: accounts(keyid: $a${i}) {
      __typename
      ... on AccountsList {
        accounts {
          keyid
          chainKey
        }
      }
      ... on MissingFilterError {
        code
        message
      }
      ... on QueryFailedError {
        code
        message
      }
    }`,
    )
    .join('\n');
  return `query AdminChannelCounterparties(${variables}) {${fields}
  }`;
};

type BlokliRawChannelType = {
  concreteChannelId: string;
  source: number;
  destination: number;
  balance: TokenValueString;
  status: BlokliChannelStatus;
  epoch: number;
  ticketIndex: string;
  closureTime: string | null;
};

type AccountsListType = { accounts: { keyid: number; chainKey: string }[] };

/**
 * Every channel of the node in both directions and all statuses, with the
 * counterparty keyids resolved to addresses. Blokli has no spent or per channel
 * redeemed figure, so estimatedValue is ticketIndex x the current ticket price:
 * every ticket issued this epoch up to the last on-chain redemption, valued at one hop.
 */
export const getNodeChannels = async (
  payload: BlokliPayloadType & RpcPayloadType & { nodeAddress: string },
): Promise<NodeChannelsType> => {
  const accountData = await queryBlokli<{
    accounts: { __typename?: string } | null;
    chainInfo: { __typename?: string } | null;
  }>(payload.blokliUrl, NODE_ACCOUNT_QUERY, { nodeAddress: payload.nodeAddress }, payload.timeout);

  const chainInfo = unwrapUnion<{ ticketPrice: TokenValueString; contractAddresses: string }>(
    accountData.chainInfo,
    'ChainInfo',
  );
  const ticketPrice = parseTokenValue(chainInfo.ticketPrice);
  const keyid = unwrapUnion<AccountsListType>(accountData.accounts, 'AccountsList').accounts.find(
    (account) => account.chainKey.toLowerCase() === payload.nodeAddress.toLowerCase(),
  )?.keyid;
  if (keyid === undefined) {
    console.warn(`Blokli does not know node ${payload.nodeAddress}`);
    return { ticketPrice, spent: null, rpcBroken: false, incoming: [], outgoing: [] };
  }

  const channelsData = await queryBlokli<{
    outgoing: { __typename?: string } | null;
    incoming: { __typename?: string } | null;
  }>(payload.blokliUrl, NODE_CHANNELS_QUERY, { keyid }, payload.timeout);
  const outgoing = unwrapUnion<{ channels: BlokliRawChannelType[] }>(channelsData.outgoing, 'ChannelsList').channels;
  const incoming = unwrapUnion<{ channels: BlokliRawChannelType[] }>(channelsData.incoming, 'ChannelsList').channels;

  const counterpartyKeyids = Array.from(
    new Set([...outgoing.map((channel) => channel.destination), ...incoming.map((channel) => channel.source)]),
  );
  const counterpartiesData = await runChunked(
    payload,
    counterpartyKeyids,
    ACCOUNTS_PER_REQUEST,
    buildAccountsByKeyidQuery,
  );
  const addressByKeyid = new Map<number, string>();
  counterpartyKeyids.forEach((counterpartyKeyid, i) => {
    const account = tryUnwrapUnion<AccountsListType>(counterpartiesData[`k${i}`], 'AccountsList')?.accounts.find(
      (account) => account.keyid === counterpartyKeyid,
    );
    if (account) addressByKeyid.set(counterpartyKeyid, getAddress(account.chainKey));
  });

  const estimate = (ticketIndex: string): TokenValueType => {
    const value = BigInt(ticketIndex) * BigInt(ticketPrice.value);
    return {
      value: value.toString(),
      formatted: formatEther(value),
    };
  };

  const channelId = (channel: BlokliRawChannelType) =>
    `0x${channel.concreteChannelId.toLowerCase().replace(/^0x/, '')}`;

  let redeemedById: Record<string, bigint> | null = null;
  try {
    redeemedById = await getRedeemedPerChannel({
      rpcUrls: payload.rpcUrls,
      channelsContract: (JSON.parse(chainInfo.contractAddresses) as { channels: string }).channels,
      channelIds: [...outgoing, ...incoming].map(channelId),
    });
  } catch (e) {
    console.warn('Could not read the channel redemptions', e);
  }
  const rpcBroken = redeemedById === null;
  const toTokenValue = (value: bigint): TokenValueType => ({ value: value.toString(), formatted: formatEther(value) });

  const toChannel = (channel: BlokliRawChannelType, counterpartyKeyid: number): BlokliChannelType => ({
    channelId: channelId(channel),
    counterparty: addressByKeyid.get(counterpartyKeyid) ?? null,
    status: channel.status,
    balance: parseTokenValue(channel.balance),
    epoch: channel.epoch,
    ticketIndex: channel.ticketIndex,
    closureTime: channel.closureTime,
    estimatedValue: channel.status === 'CLOSED' ? null : estimate(channel.ticketIndex),
    redeemed: redeemedById ? toTokenValue(redeemedById[channelId(channel)] ?? BigInt(0)) : null,
  });

  return {
    ticketPrice,
    spent: redeemedById
      ? toTokenValue(
          outgoing.reduce((sum, channel) => sum + (redeemedById?.[channelId(channel)] ?? BigInt(0)), BigInt(0)),
        )
      : null,
    rpcBroken,
    outgoing: outgoing.map((channel) => toChannel(channel, channel.destination)),
    incoming: incoming.map((channel) => toChannel(channel, channel.source)),
  };
};

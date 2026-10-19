import { createPublicClient, fallback, http, toEventSelector, type Hex } from 'viem';

const TICKET_REDEEMED = toEventSelector('TicketRedeemed(bytes32,bytes32)');
const BALANCE_MASK = (BigInt(1) << BigInt(96)) - BigInt(1);
const EPOCH_MASK = (BigInt(1) << BigInt(24)) - BigInt(1);
const EPOCH_SHIFT = BigInt(176);
// keeps the OR list of channel ids in one eth_getLogs topic within what public RPCs accept
const CHANNELS_PER_REQUEST = 200;
// the largest range the capped public RPCs accept per eth_getLogs (publicnode: 10k without its log index)
const BLOCKS_PER_WINDOW = BigInt(10_000);
const WINDOWS_IN_PARALLEL = 5;
// where the windowed scan starts: the HoprChannels deployments, lowercase
const CHANNELS_FIRST_BLOCK: Record<string, number> = {
  '0x75ce59332721e3ae3064cb9652bce35ffce3f8e6': 48530952, // piz-palu-prod
  '0x3480caf9bc8874f4c7e3fc4a62eab681b643b137': 47638474, // piz-palu-staging
  '0xced2bbe29c66b40e17eca63214c58506c53f1686': 47637970, // piz-palu-dev
  '0xe3322b0601a2ff1402801ebb22a2a7be599d9620': 47637970, // piz-palu-dev
  '0x860f50b24ba6a862736c5045747323e03aa52aa4': 47415377, // jura-prod
  '0x9ff5bc389a7f8096c9e3a27897c470970f4b595c': 48060435, // jura-staging
  '0x01be530efb04dc7919d77722e647ce4b5c26a5db': 48060435, // jura-staging
  '0xd8c91008c68cd87e7c52ea1a2c6f6dc6a5236008': 47415331, // jura-dev
};
// before every v5 deployment, for a channels contract missing above
const HOPR_FIRST_BLOCK = 47_400_000;

type RpcLog = {
  topics: string[];
  data: string;
  blockNumber: string;
  logIndex: string;
  transactionHash: string;
};

// every HoprChannels event carries the channel state packed as status | epoch | closureTime | ticketIndex | balance
const unpack = (data: string) => {
  const packed = BigInt(data);
  return {
    balance: packed & BALANCE_MASK,
    epoch: (packed >> EPOCH_SHIFT) & EPOCH_MASK,
  };
};

/**
 * Wei redeemed from each of the given channels over its whole history, every
 * epoch included, keyed by the lowercase channel id. The contract resets a
 * channel when it closes, so this can only be read from its events: a redemption
 * lowers the balance in the same transaction that emits TicketRedeemed.
 */
export const getRedeemedPerChannel = async ({
  rpcUrls,
  channelsContract,
  channelIds,
  timeout = 30_000,
}: {
  // tried in order, the next one taking over when a request fails
  rpcUrls: string[];
  channelsContract: string;
  channelIds: string[];
  timeout?: number;
}): Promise<Record<string, bigint>> => {
  const redeemed: Record<string, bigint> = Object.fromEntries(channelIds.map((id) => [id.toLowerCase(), BigInt(0)]));
  if (channelIds.length === 0) return redeemed;
  if (rpcUrls.length === 0) throw new Error('No Gnosis RPC configured');

  const client = createPublicClient({
    transport: fallback(
      rpcUrls.map((url) => http(url, { timeout, retryCount: 1 })),
      { retryCount: 0 },
    ),
  });
  const getLogs = (ids: string[], fromBlock: bigint, toBlock: bigint | 'latest') =>
    client.request({
      method: 'eth_getLogs',
      params: [
        {
          address: channelsContract as Hex,
          fromBlock: `0x${fromBlock.toString(16)}`,
          toBlock: typeof toBlock === 'bigint' ? `0x${toBlock.toString(16)}` : toBlock,
          topics: [null, ids as Hex[]],
        },
      ],
    }) as Promise<RpcLog[]>;

  const fetchLogs = async (ids: string[]) => {
    try {
      return await getLogs(ids, BigInt(0), 'latest');
    } catch (e) {
      // every RPC refused the whole chain at once, so walk it in windows the capped ones accept
      console.warn('Full range eth_getLogs failed on every RPC, scanning in windows', e);
      const head = await client.getBlockNumber();
      const windows: [bigint, bigint][] = [];
      for (
        let from = BigInt(CHANNELS_FIRST_BLOCK[channelsContract.toLowerCase()] ?? HOPR_FIRST_BLOCK);
        from <= head;
        from += BLOCKS_PER_WINDOW
      ) {
        const to = from + BLOCKS_PER_WINDOW - BigInt(1);
        windows.push([from, to < head ? to : head]);
      }
      const logs: RpcLog[] = [];
      for (let i = 0; i < windows.length; i += WINDOWS_IN_PARALLEL) {
        const batch = windows.slice(i, i + WINDOWS_IN_PARALLEL);
        (await Promise.all(batch.map(([from, to]) => getLogs(ids, from, to)))).forEach((part) => logs.push(...part));
      }
      return logs;
    }
  };
  const chunks: string[][] = [];
  for (let i = 0; i < channelIds.length; i += CHANNELS_PER_REQUEST) {
    chunks.push(channelIds.slice(i, i + CHANNELS_PER_REQUEST));
  }

  const logs = (await Promise.all(chunks.map(fetchLogs)))
    .flat()
    .sort(
      (a, b) =>
        Number(BigInt(a.blockNumber) - BigInt(b.blockNumber)) || Number(BigInt(a.logIndex) - BigInt(b.logIndex)),
    );

  const last = new Map<string, ReturnType<typeof unpack>>();
  // the channel state before the current transaction, per channel
  const beforeTx = new Map<string, { tx: string; state?: ReturnType<typeof unpack> }>();
  for (const log of logs) {
    const channelId = log.topics[1].toLowerCase();
    const state = unpack(log.data);
    if (beforeTx.get(channelId)?.tx !== log.transactionHash) {
      beforeTx.set(channelId, { tx: log.transactionHash, state: last.get(channelId) });
    }
    const before = beforeTx.get(channelId)?.state;
    if (log.topics[0] === TICKET_REDEEMED && before && before.epoch === state.epoch) {
      redeemed[channelId] = (redeemed[channelId] ?? BigInt(0)) + before.balance - state.balance;
    }
    last.set(channelId, state);
  }
  return redeemed;
};

import { createPublicClient, fallback, http, type Hex } from 'viem';
import { channelsFirstBlock, TICKET_REDEEMED, unpack } from './channelState';

// keeps the OR list of channel ids in one eth_getLogs topic within what public RPCs accept
const CHANNELS_PER_REQUEST = 200;
// the largest range the capped public RPCs accept per eth_getLogs (publicnode: 10k without its log index)
const BLOCKS_PER_WINDOW = BigInt(10_000);
const WINDOWS_IN_PARALLEL = 5;

type RpcLog = {
  topics: string[];
  data: string;
  blockNumber: string;
  logIndex: string;
  transactionHash: string;
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
      for (let from = BigInt(channelsFirstBlock(channelsContract)); from <= head; from += BLOCKS_PER_WINDOW) {
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

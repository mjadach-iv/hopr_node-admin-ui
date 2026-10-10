import { toEventSelector } from 'viem';

const TICKET_REDEEMED = toEventSelector('TicketRedeemed(bytes32,bytes32)');
const BALANCE_MASK = (BigInt(1) << BigInt(96)) - BigInt(1);
const EPOCH_MASK = (BigInt(1) << BigInt(24)) - BigInt(1);
const EPOCH_SHIFT = BigInt(176);

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
  rpcUrl,
  channelsContract,
  channelIds,
  timeout = 30_000,
}: {
  rpcUrl: string;
  channelsContract: string;
  channelIds: string[];
  timeout?: number;
}): Promise<Record<string, bigint>> => {
  const redeemed: Record<string, bigint> = Object.fromEntries(channelIds.map((id) => [id.toLowerCase(), BigInt(0)]));
  if (channelIds.length === 0) return redeemed;

  const response = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'eth_getLogs',
      params: [{ address: channelsContract, fromBlock: '0x0', toBlock: 'latest', topics: [null, channelIds] }],
    }),
    signal: AbortSignal.timeout(timeout),
  });
  if (!response.ok) throw new Error(`RPC responded with ${response.status} ${response.statusText}`);
  const json = (await response.json()) as { result?: RpcLog[]; error?: { message: string } };
  if (!json.result) throw new Error(json.error?.message ?? 'RPC returned no logs');

  const logs = [...json.result].sort(
    (a, b) => Number(BigInt(a.blockNumber) - BigInt(b.blockNumber)) || Number(BigInt(a.logIndex) - BigInt(b.logIndex)),
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

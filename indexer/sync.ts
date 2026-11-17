import { createPublicClient, fallback, http, isAddress, type Hex, type PublicClient } from 'viem';
import { getContractAddresses } from '../src/blokli/api';
import {
  CHANNEL_OPENED,
  CHANNEL_STATE_EVENTS,
  channelsFirstBlock,
  TICKET_REDEEMED,
  unpack,
  type ChannelState,
} from '../src/chain/channelState';
import type { IndexerDb, Redemption, StoredChannel } from './db';

// publicnode, the most capped of the RPCs that scan history, reads at most 10k blocks per eth_getLogs
const MAX_WINDOW = 10_000;
// the free plans of drpc and swiftnodes read 100, so with only those left the sync slows down but goes on
const MIN_WINDOW = 100;
const WINDOWS_IN_PARALLEL = 5;
// a window this many successes in a row grows back towards MAX_WINDOW
const GROW_AFTER = 5;
// block times are interpolated between blocks this far apart, ~83 min on Gnosis
const ANCHOR_EVERY = 1_000;
// Gnosis finalizes every few seconds, so this keeps the index about a block behind
const POLL_MS = 15_000;
const RETRY_MIN_MS = 15_000;
const RETRY_MAX_MS = 5 * 60_000;
// blokli is asked for the channels contract again this often while it is unreachable
const BLOKLI_RETRY_MS = 5 * 60_000;
const RPC_TIMEOUT = 30_000;

export type Log = Pick<Console, 'info' | 'warn' | 'error'>;

type RpcLog = {
  topics: string[];
  data: string;
  blockNumber: string;
  logIndex: string;
  transactionHash: string;
};

type Clients = { key: string; logs: PublicClient; blocks: PublicClient };

const toHex = (block: number) => `0x${block.toString(16)}` as Hex;
const topicAddress = (topic: string) => `0x${topic.slice(-40)}`.toLowerCase();
const errorMessage = (e: unknown) => (e instanceof Error ? e.message.split('\n')[0] : String(e));

/** Unix seconds of every block of a window, from the anchors around it. */
const interpolate = (anchors: Map<number, number>) => {
  const blocks = [...anchors.keys()].sort((a, b) => a - b);
  return (block: number) => {
    let lower = blocks[0];
    let upper = blocks[blocks.length - 1];
    for (const anchor of blocks) {
      if (anchor <= block) lower = anchor;
      if (anchor >= block) {
        upper = anchor;
        break;
      }
    }
    const lowerTs = anchors.get(lower)!;
    if (upper === lower) return lowerTs;
    return Math.round(lowerTs + ((block - lower) * (anchors.get(upper)! - lowerTs)) / (upper - lower));
  };
};

/**
 * Walks every HoprChannels log of the network from the contract's deployment to the finalized
 * block and keeps the decoded ticket redemptions, so any node's earnings are known the moment it
 * is watched. Each window is committed with the cursor in one transaction and resumed from there.
 */
export const createSync = ({ db, log }: { db: IndexerDb; log: Log }) => {
  let stopped = false;
  let running: Promise<void> | null = null;
  let wakeUp: (() => void) | null = null;
  let clients: Clients | null = null;
  let channels: Map<string, StoredChannel> | null = null;
  // the blokli url the channels contract was last read from, and when that last failed
  let resolvedFor: string | null = null;
  let blokliFailedAt = 0;
  let windowSize = MAX_WINDOW;
  let successes = 0;
  const unknownEvents = new Set<string>();

  const state = {
    phase: 'starting' as 'starting' | 'syncing' | 'idle',
    finalized: null as number | null,
    // the chain's newest block, what the progress is measured against
    latest: null as number | null,
    lastError: null as string | null,
  };

  const sleep = (ms: number) =>
    new Promise<void>((resolve) => {
      const timeout = setTimeout(done, ms);
      function done() {
        clearTimeout(timeout);
        wakeUp = null;
        resolve();
      }
      wakeUp = done;
    });

  const clientsFor = (rpcUrls: string[]): Clients => {
    const key = rpcUrls.join(',');
    if (clients?.key === key) return clients;
    const transport = (batch: boolean) =>
      fallback(
        rpcUrls.map((url) => http(url, { timeout: RPC_TIMEOUT, retryCount: 1, batch: batch && { batchSize: 50 } })),
        { retryCount: 0 },
      );
    clients = {
      key,
      // a batch of eth_getLogs would be one huge response, so only block headers are batched
      logs: createPublicClient({ transport: transport(false) }),
      blocks: createPublicClient({ transport: transport(true) }),
    };
    return clients;
  };

  // the channels contract of blokli's network, a different one starts the index over
  const ensureNetwork = async (blokliUrl: string) => {
    const meta = db.getIndexMeta();
    if (resolvedFor === blokliUrl && meta.channelsContract) return meta.channelsContract;
    // blokli is down but has not changed, so the contract is still the stored one
    const sameBlokli = resolvedFor === null && db.resolvedBlokliUrl() === blokliUrl && !!meta.channelsContract;
    if (sameBlokli && Date.now() - blokliFailedAt < BLOKLI_RETRY_MS) return meta.channelsContract!;
    try {
      const { network, contracts } = await getContractAddresses({ blokliUrl, timeout: 15_000 });
      if (stopped) throw new Error('Stopped');
      const channelsContract = contracts.channels?.toLowerCase();
      if (!channelsContract || !isAddress(channelsContract)) throw new Error('Blokli lists no channels contract');
      if (channelsContract !== meta.channelsContract) {
        const startBlock = channelsFirstBlock(channelsContract);
        log.info(`[indexer] indexing ${network} channels ${channelsContract} from block ${startBlock}`);
        db.startIndex({ channelsContract, network, startBlock });
        channels = null;
      } else if (network !== meta.network) {
        db.setNetwork(network);
      }
      db.setResolvedBlokliUrl(blokliUrl);
      resolvedFor = blokliUrl;
      return channelsContract;
    } catch (e) {
      blokliFailedAt = Date.now();
      if (sameBlokli) {
        log.warn(`[indexer] blokli unreachable, keeps indexing ${meta.channelsContract}: ${errorMessage(e)}`);
        return meta.channelsContract!;
      }
      throw new Error(`Blokli did not name the channels contract: ${errorMessage(e)}`);
    }
  };

  const fetchWindow = async (
    { logs: logsClient, blocks: blocksClient }: Clients,
    channelsContract: string,
    from: number,
    to: number,
    startBlock: number,
  ) => {
    const logs = (await logsClient.request({
      method: 'eth_getLogs',
      params: [{ address: channelsContract as Hex, fromBlock: toHex(from), toBlock: toHex(to) }],
    })) as RpcLog[];
    // the window's end always, so the cursor has a time; every ANCHOR_EVERY block too when tickets were redeemed
    const anchorBlocks = new Set([to]);
    if (from === startBlock) anchorBlocks.add(from);
    if (logs.some((entry) => entry.topics[0] === TICKET_REDEEMED)) {
      anchorBlocks.add(from);
      for (let block = Math.ceil(from / ANCHOR_EVERY) * ANCHOR_EVERY; block < to; block += ANCHOR_EVERY) {
        anchorBlocks.add(block);
      }
    }
    const anchors = new Map<number, number>();
    await Promise.all(
      [...anchorBlocks].map(async (block) => {
        const { timestamp } = await blocksClient.getBlock({ blockNumber: BigInt(block) });
        anchors.set(block, Number(timestamp));
      }),
    );
    return { from, to, logs, anchors };
  };

  // the window's channel changes and redemptions, nothing is written yet
  const decode = (logs: RpcLog[], known: Map<string, StoredChannel>, anchors: Map<number, number>) => {
    const changed = new Map<string, StoredChannel>();
    const redemptions: Redemption[] = [];
    // the channel state before the current transaction, then after each of its redemptions
    const base = new Map<string, { tx: string; state?: ChannelState }>();
    const timeOf = interpolate(anchors);
    const sorted = [...logs].sort(
      (a, b) =>
        Number(BigInt(a.blockNumber) - BigInt(b.blockNumber)) || Number(BigInt(a.logIndex) - BigInt(b.logIndex)),
    );
    for (const entry of sorted) {
      const topic = entry.topics[0];
      if (!CHANNEL_STATE_EVENTS.has(topic)) {
        if (topic && !unknownEvents.has(topic)) {
          unknownEvents.add(topic);
          log.info(`[indexer] skips HoprChannels event ${topic}`);
        }
        continue;
      }
      if (entry.topics.length < 2 || entry.data.length !== 66) continue;
      const channelId = entry.topics[1].toLowerCase();
      const previous = changed.get(channelId) ?? known.get(channelId);
      const channelState = unpack(entry.data);
      if (base.get(channelId)?.tx !== entry.transactionHash) {
        base.set(channelId, {
          tx: entry.transactionHash,
          state: previous && { balance: previous.balance, epoch: previous.epoch },
        });
      }
      let source = previous?.source ?? null;
      let destination = previous?.destination ?? null;
      if (topic === CHANNEL_OPENED && entry.topics.length >= 4) {
        source = topicAddress(entry.topics[2]);
        destination = topicAddress(entry.topics[3]);
      }
      if (topic === TICKET_REDEEMED) {
        const before = base.get(channelId)!;
        // a reset channel (new epoch) has no balance to compare with
        if (before.state && before.state.epoch === channelState.epoch && before.state.balance > channelState.balance) {
          const block = Number(BigInt(entry.blockNumber));
          redemptions.push({
            txHash: entry.transactionHash.toLowerCase(),
            logIndex: Number(BigInt(entry.logIndex)),
            block,
            ts: timeOf(block),
            channelId,
            source,
            destination,
            amount: before.state.balance - channelState.balance,
          });
        }
        before.state = channelState;
      }
      changed.set(channelId, { source, destination, ...channelState });
    }
    return { changed, redemptions };
  };

  // one round: up to WINDOWS_IN_PARALLEL windows towards the finalized block; false when caught up
  const step = async (): Promise<boolean> => {
    const settings = db.getSettings();
    if (settings.rpcUrls.length === 0) throw new Error('No Gnosis RPC configured');
    const rpc = clientsFor(settings.rpcUrls);
    const channelsContract = await ensureNetwork(settings.blokliUrl);
    if (stopped) return false;
    const meta = db.getIndexMeta();
    if (meta.cursor === null || meta.startBlock === null) return false;

    const [finalizedBlock, latest] = await Promise.all([
      rpc.blocks.getBlock({ blockTag: 'finalized' }),
      rpc.blocks.getBlockNumber({ cacheTime: 0 }),
    ]);
    const finalized = Number(finalizedBlock.number);
    state.finalized = finalized;
    state.latest = Number(latest);
    if (meta.cursor >= finalized) return false;
    state.phase = 'syncing';

    const windows: [number, number][] = [];
    for (let from = meta.cursor + 1; windows.length < WINDOWS_IN_PARALLEL && from <= finalized; ) {
      const to = Math.min(from + windowSize - 1, finalized);
      windows.push([from, to]);
      from = to + 1;
    }
    let fetched: Awaited<ReturnType<typeof fetchWindow>>[];
    try {
      fetched = await Promise.all(
        windows.map(([from, to]) => fetchWindow(rpc, channelsContract, from, to, meta.startBlock!)),
      );
    } catch (e) {
      // too many logs or blocks for the RPCs, a smaller window may pass
      if (windowSize > MIN_WINDOW) {
        windowSize = Math.max(MIN_WINDOW, Math.floor(windowSize / 2));
        successes = 0;
        log.warn(`[indexer] windows of ${windowSize} blocks after: ${errorMessage(e)}`);
        return true;
      }
      throw e;
    }
    // settings changed meanwhile, e.g. blokli now names another contract
    if (stopped || db.getIndexMeta().channelsContract !== channelsContract) return true;

    channels ??= db.loadChannels();
    for (const window of fetched) {
      const { changed, redemptions } = decode(window.logs, channels, window.anchors);
      db.commitWindow({ to: window.to, channels: changed, redemptions, anchors: window.anchors });
      changed.forEach((channel, channelId) => channels!.set(channelId, channel));
    }
    if (++successes >= GROW_AFTER && windowSize < MAX_WINDOW) {
      windowSize = Math.min(MAX_WINDOW, windowSize * 2);
      successes = 0;
    }
    return true;
  };

  const loop = async () => {
    let retryMs = RETRY_MIN_MS;
    while (!stopped) {
      try {
        const more = await step();
        state.lastError = null;
        retryMs = RETRY_MIN_MS;
        if (!more && !stopped) {
          state.phase = 'idle';
          await sleep(POLL_MS);
        }
      } catch (e) {
        if (stopped) break;
        state.lastError = errorMessage(e);
        log.warn(`[indexer] sync failed, retrying in ${retryMs / 1000}s: ${state.lastError}`);
        await sleep(retryMs);
        retryMs = Math.min(RETRY_MAX_MS, retryMs * 2);
      }
    }
  };

  return {
    state,
    start: () => {
      running ??= loop();
    },
    // new settings are picked up right away instead of after the current pause
    wake: () => {
      resolvedFor = null;
      blokliFailedAt = 0;
      wakeUp?.();
    },
    // nothing touches the database after this returns, so it can be closed right away; whatever
    // request is still out is dropped when it answers
    stop: () => {
      stopped = true;
      wakeUp?.();
    },
  };
};

import { createSelector } from '@reduxjs/toolkit';
import { formatEther } from 'viem';
import type { RootState } from '..';
import type { SafeNodeType, TokenValueType } from '../../blokli/types';

/**
 * The url the node reports is the default, store.blokli.url is the per node override.
 */
export const selectBlokliUrl = (state: RootState): string | null =>
  state.blokli.url ?? state.node.info.data?.providerUrl ?? null;

/**
 * Sum of one figure over every safe node, in wei. Null when any node's figure is
 * missing, so a partial sum never passes for the whole safe.
 */
export const sumSafeNodes = (
  safeNodes: SafeNodeType[] | null | undefined,
  key: 'xDai' | 'redeemed' | 'spent',
): bigint | null =>
  safeNodes?.length && safeNodes.every((node) => node[key])
    ? safeNodes.reduce((sum, node) => sum + BigInt(node[key]!.value), BigInt(0))
    : null;

const toTokenValue = (value: bigint): TokenValueType => ({ value: value.toString(), formatted: formatEther(value) });

/**
 * The safe's wxHOPR split into the safe itself and its nodes' outgoing channels,
 * closing ones included as they hold their funds until finalized. All from one
 * blokli request, so funds moving into or out of a channel are counted once; the
 * node's own safe balance is only the fallback.
 */
export const selectSafeFunds = createSelector(
  [(state: RootState) => state.blokli.channelStats.data, (state: RootState) => state.node.balances.data.safeHopr],
  (stats, nodeSafeHopr) => {
    const safe: TokenValueType | null =
      stats?.safeBalance ??
      (nodeSafeHopr?.value && nodeSafeHopr.formatted
        ? { value: nodeSafeHopr.value, formatted: nodeSafeHopr.formatted }
        : null);
    const channels = stats ? toTokenValue(BigInt(stats.value) + BigInt(stats.closing?.value ?? 0)) : null;
    return {
      safe,
      channels,
      // funds of closing channels, on their way back to the safe
      inTransit: stats?.closing ? { value: stats.closing.value, formatted: stats.closing.formatted } : null,
      openCount: stats?.count ?? null,
      closingCount: stats?.closing?.count ?? null,
      total: safe && channels ? toTokenValue(BigInt(safe.value) + BigInt(channels.value)) : null,
    };
  },
);

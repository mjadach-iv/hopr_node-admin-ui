import type { RootState } from '..';
import type { SafeNodeType } from '../../blokli/types';

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

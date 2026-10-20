import type { SafeChannelStatsType, SafeNodeType, SafesNodesType } from '../../../blokli';
import type { NodesStatsType } from '../../../networkDashboard';

export type WatchlistDataType = {
  network: string | null;
  // null when blokli knows no safe for the node, missing when the lookup failed
  safeByNode: Record<string, string | null>;
  // the watched nodes and every other node of their safes
  figuresByNode: Record<string, SafeNodeType>;
  // wxHOPR of each safe and in all its nodes' channels, missing when blokli could not read it
  safeFunds: Record<string, SafeChannelStatsType>;
  // every node registered to the safe, missing when blokli could not answer
  nodesBySafe: SafesNodesType;
  stats: NodesStatsType | null;
};

type InitialState = {
  // the figures belong to this blokli url, a new one drops them
  urlInUse: string | null;
  data: WatchlistDataType | null;
  isFetching: boolean;
  // of the latest request, older ones landing later are ignored
  requestId: string | null;
  fetchingKey: string | null;
};

export const initialState: InitialState = {
  urlInUse: null,
  data: null,
  isFetching: false,
  requestId: null,
  fetchingKey: null,
};

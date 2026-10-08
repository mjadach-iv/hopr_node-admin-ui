import type { NodesStatsType } from '../../../networkDashboard';

type InitialState = {
  // the node and dashboard environment the figures belong to, used to drop stale results
  nodeAddress: string | null;
  envId: number | null;
  nodes: {
    data: NodesStatsType | null;
    isFetching: boolean;
  };
};

export const initialState: InitialState = {
  nodeAddress: null,
  envId: null,
  nodes: {
    data: null,
    isFetching: false,
  },
};

import { ActionReducerMapBuilder, createAsyncThunk } from '@reduxjs/toolkit';
import { api, utils, type NodesStatsType } from '../../../networkDashboard';
import { initialState } from './initialState';
import { RootState } from '../..';

const { networkDashboardApiError } = utils;

type NetworkDashboardThunkPayload = {
  envId: number;
  // checksummed, compared against the slice context by the fulfilled reducer
  nodeAddress: string;
  addresses: string[];
};

const getNodesStatsThunk = createAsyncThunk<
  NodesStatsType | undefined,
  NetworkDashboardThunkPayload,
  { state: RootState }
>(
  'networkDashboard/getNodesStats',
  async (payload, { rejectWithValue }) => {
    try {
      return await api.getNodesStats({
        envId: payload.envId,
        addresses: payload.addresses,
      });
    } catch (e) {
      if (e instanceof networkDashboardApiError) {
        return rejectWithValue({
          code: e.code,
          message: e.message,
        });
      }
      return rejectWithValue({ message: JSON.stringify(e) });
    }
  },
  {
    condition: (_payload, { getState }) => {
      if (getState().networkDashboard.nodes.isFetching) {
        return false;
      }
    },
  },
);

export const createAsyncReducer = (builder: ActionReducerMapBuilder<typeof initialState>) => {
  builder.addCase(getNodesStatsThunk.pending, (state) => {
    state.nodes.isFetching = true;
  });
  builder.addCase(getNodesStatsThunk.fulfilled, (state, action) => {
    if (action.meta.arg.nodeAddress !== state.nodeAddress) return;
    if (action.meta.arg.envId !== state.envId) return;
    if (action.payload) {
      state.nodes.data = {
        byAddress: { ...(state.nodes.data?.byAddress ?? {}), ...action.payload.byAddress },
        lastRun: action.payload.lastRun ?? state.nodes.data?.lastRun ?? null,
      };
    }
    state.nodes.isFetching = false;
  });
  builder.addCase(getNodesStatsThunk.rejected, (state) => {
    state.nodes.isFetching = false;
  });
};

export const actionsAsync = {
  getNodesStatsThunk,
};

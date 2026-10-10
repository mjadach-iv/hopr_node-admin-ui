import { ActionReducerMapBuilder, createAsyncThunk } from '@reduxjs/toolkit';
import { getAddress, isAddress } from 'viem';
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

const checksummed = (addresses: string[]) =>
  addresses.filter((address) => isAddress(address)).map((address) => getAddress(address));

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
    condition: (payload, { getState }) => {
      const { isFetching, fetchingAddresses } = getState().networkDashboard.nodes;
      if (isFetching && checksummed(payload.addresses).every((address) => fetchingAddresses.includes(address))) {
        return false;
      }
    },
  },
);

const settle = (state: typeof initialState, requestId: string) => {
  if (state.nodes.requestId !== requestId) return;
  state.nodes.isFetching = false;
  state.nodes.fetchingAddresses = [];
  state.nodes.requestId = null;
};

export const createAsyncReducer = (builder: ActionReducerMapBuilder<typeof initialState>) => {
  builder.addCase(getNodesStatsThunk.pending, (state, action) => {
    state.nodes.isFetching = true;
    state.nodes.fetchingAddresses = checksummed(action.meta.arg.addresses);
    state.nodes.requestId = action.meta.requestId;
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
    settle(state, action.meta.requestId);
  });
  builder.addCase(getNodesStatsThunk.rejected, (state, action) => {
    settle(state, action.meta.requestId);
  });
};

export const actionsAsync = {
  getNodesStatsThunk,
};

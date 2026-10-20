import { ActionReducerMapBuilder, createAsyncThunk } from '@reduxjs/toolkit';
import { getAddress, isAddress } from 'viem';
import { api as blokliApi, utils as blokliUtils } from '../../../blokli';
import { api as dashboardApi, utils as dashboardUtils } from '../../../networkDashboard';
import { initialState, type WatchlistDataType } from './initialState';
import { RootState } from '../..';

type WatchlistThunkPayload = {
  blokliUrl: string;
  rpcUrls: string[];
  nodeAddresses: string[];
};

const normalized = (addresses: string[]) =>
  Array.from(new Set(addresses.filter((address) => isAddress(address)).map((address) => getAddress(address)))).sort();

const requestKey = (payload: WatchlistThunkPayload) =>
  [payload.blokliUrl, payload.rpcUrls.join(','), normalized(payload.nodeAddresses).join(',')].join('|');

/**
 * Figures of the watched nodes from blokli, the Gnosis RPCs and the network
 * dashboard, independent of any connected node. Each node's safe is looked up
 * first, so its channels can be read the same way as on SAFE → NODES. Every
 * other node of those safes is read too, so the safe sums cover the whole safe.
 */
const getWatchlistThunk = createAsyncThunk<WatchlistDataType, WatchlistThunkPayload, { state: RootState }>(
  'watchlist/get',
  async (payload, { rejectWithValue }) => {
    const nodeAddresses = normalized(payload.nodeAddresses);
    try {
      const { network, safeByNode } = await blokliApi.getNodesSafes({ blokliUrl: payload.blokliUrl, nodeAddresses });
      const envId = dashboardUtils.dashboardEnvId(network);
      const safes = Array.from(new Set(Object.values(safeByNode).filter((safe): safe is string => !!safe)));
      const nodesBySafe = await blokliApi.getSafesNodes({ blokliUrl: payload.blokliUrl, safeAddresses: safes });
      const figuresSafeByNode: Record<string, string | null> = Object.fromEntries(
        Object.entries(nodesBySafe).flatMap(([safeAddress, nodes]) => nodes.map((node) => [node, safeAddress])),
      );
      nodeAddresses.forEach((nodeAddress) => {
        figuresSafeByNode[nodeAddress] = safeByNode[nodeAddress] ?? null;
      });
      const [figures, safeStats, stats] = await Promise.all([
        blokliApi.getNodesFigures({
          blokliUrl: payload.blokliUrl,
          rpcUrls: payload.rpcUrls,
          nodeAddresses: Object.keys(figuresSafeByNode),
          safeByNode: figuresSafeByNode,
        }),
        Promise.all(
          safes.map((safeAddress) =>
            blokliApi.getChannelStats({ blokliUrl: payload.blokliUrl, safeAddress }).catch((e) => {
              console.warn(`Blokli funds of safe ${safeAddress} failed`, e);
              return null;
            }),
          ),
        ),
        envId === null
          ? null
          : dashboardApi.getNodesStats({ envId, addresses: nodeAddresses }).catch((e) => {
              console.warn('Network dashboard request for the watchlist failed', e);
              return null;
            }),
      ]);
      return {
        network,
        safeByNode,
        figuresByNode: Object.fromEntries(figures.map((figure) => [figure.nodeAddress, figure])),
        safeFunds: Object.fromEntries(
          safes.flatMap((safeAddress, i) => (safeStats[i] ? [[safeAddress, safeStats[i]]] : [])),
        ),
        nodesBySafe,
        stats,
      };
    } catch (e) {
      if (e instanceof blokliUtils.blokliApiError) {
        return rejectWithValue({
          code: e.code,
          message: e.message,
        });
      }
      return rejectWithValue({ message: JSON.stringify(e) });
    }
  },
  {
    // a request with other inputs supersedes the running one instead of waiting for it
    condition: (payload, { getState }) => {
      const { isFetching, fetchingKey } = getState().watchlist;
      if (isFetching && fetchingKey === requestKey(payload)) {
        return false;
      }
    },
  },
);

const settle = (state: typeof initialState) => {
  state.isFetching = false;
  state.requestId = null;
  state.fetchingKey = null;
};

export const createAsyncReducer = (builder: ActionReducerMapBuilder<typeof initialState>) => {
  builder.addCase(getWatchlistThunk.pending, (state, action) => {
    if (action.meta.arg.blokliUrl !== state.urlInUse) {
      state.urlInUse = action.meta.arg.blokliUrl;
      state.data = null;
    }
    state.isFetching = true;
    state.requestId = action.meta.requestId;
    state.fetchingKey = requestKey(action.meta.arg);
  });
  builder.addCase(getWatchlistThunk.fulfilled, (state, action) => {
    if (action.meta.requestId !== state.requestId) return;
    // a dashboard hiccup keeps the figures already shown
    state.data = { ...action.payload, stats: action.payload.stats ?? state.data?.stats ?? null };
    settle(state);
  });
  builder.addCase(getWatchlistThunk.rejected, (state, action) => {
    if (action.meta.requestId !== state.requestId) return;
    settle(state);
  });
};

export const actionsAsync = {
  getWatchlistThunk,
};

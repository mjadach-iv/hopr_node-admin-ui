import { PayloadAction, createSlice } from '@reduxjs/toolkit';
import { getAddress, isAddress } from 'viem';
import { actionsAsync, createAsyncReducer } from './actionsAsync';
import { initialState } from './initialState';

const networkDashboardSlice = createSlice({
  name: 'networkDashboard',
  initialState,
  reducers: {
    resetState: () => initialState,
    // the connected node or its network changed: drop the figures of the previous one
    setContext(state, action: PayloadAction<{ nodeAddress: string | null | undefined; envId: number | null }>) {
      const { nodeAddress, envId } = action.payload;
      const checksummed = nodeAddress && isAddress(nodeAddress) ? getAddress(nodeAddress) : null;
      if (checksummed === state.nodeAddress && envId === state.envId) return;
      state.nodeAddress = checksummed;
      state.envId = envId;
      state.nodes.data = null;
      state.nodes.isFetching = false;
    },
  },
  extraReducers: (builder) => createAsyncReducer(builder),
});

export const networkDashboardActions = networkDashboardSlice.actions;
export const networkDashboardActionsAsync = actionsAsync;
export default networkDashboardSlice.reducer;

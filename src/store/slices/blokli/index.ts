import { PayloadAction, createSlice } from '@reduxjs/toolkit';
import { isAddress, getAddress } from 'viem';
import { actionsAsync, createAsyncReducer } from './actionsAsync';
import { initialState } from './initialState';

const blokliSlice = createSlice({
  name: 'blokli',
  initialState,
  reducers: {
    resetState: () => initialState,
    setNodeAddress(state, action: PayloadAction<string | null>) {
      const nodeAddress = action.payload;
      if (!nodeAddress || !isAddress(nodeAddress)) return;
      state.nodeAddress = getAddress(nodeAddress);
    },
    // the effective url changed: drop figures fetched with the previous url and
    // record the new one. isFetching goes back to false so the refetch is not
    // swallowed by the thunks' in-flight guards while an old request is pending.
    resetData(state, action: PayloadAction<string | null>) {
      state.urlInUse = action.payload;
      state.channelStats.data = null;
      state.channelStats.isFetching = false;
      state.ticketRedemption.data = null;
      state.ticketRedemption.isFetching = false;
      state.safeNodes.data = null;
      state.safeNodes.isFetching = false;
      state.nodeChannels.data = null;
      state.nodeChannels.isFetching = false;
    },
  },
  extraReducers: (builder) => createAsyncReducer(builder),
});

export const blokliActions = blokliSlice.actions;
export const blokliActionsAsync = actionsAsync;
export default blokliSlice.reducer;

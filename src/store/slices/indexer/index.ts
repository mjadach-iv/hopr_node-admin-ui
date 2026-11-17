import { createSlice } from '@reduxjs/toolkit';
import { actionsAsync, createAsyncReducer } from './actionsAsync';
import { initialState } from './initialState';

// not reset on logout: the indexer does not belong to a node
const indexerSlice = createSlice({
  name: 'indexer',
  initialState,
  reducers: {},
  extraReducers: (builder) => createAsyncReducer(builder),
});

export const indexerActions = indexerSlice.actions;
export const indexerActionsAsync = actionsAsync;
export default indexerSlice.reducer;

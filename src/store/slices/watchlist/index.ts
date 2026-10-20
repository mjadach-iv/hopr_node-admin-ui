import { createSlice } from '@reduxjs/toolkit';
import { actionsAsync, createAsyncReducer } from './actionsAsync';
import { initialState } from './initialState';

// not reset on logout: the watchlist does not belong to a node
const watchlistSlice = createSlice({
  name: 'watchlist',
  initialState,
  reducers: {
    resetState: () => initialState,
  },
  extraReducers: (builder) => createAsyncReducer(builder),
});

export const watchlistActions = watchlistSlice.actions;
export const watchlistActionsAsync = actionsAsync;
export default watchlistSlice.reducer;

import { ActionReducerMapBuilder, createAsyncThunk } from '@reduxjs/toolkit';
import { toast } from 'react-toastify';
import { CT_NODES, DEFAULT_BLOKLI_URL, GNOSIS_RPC_URLS } from '../../../../config';
import * as indexerApi from '../../../indexer/api';
import { saveBackup, settingsToRestore } from '../../../indexer/backup';
import type { IndexerSettings, IndexerStatus } from '../../../indexer/types';
import { appActions } from '../app';
import { initialState } from './initialState';
import type { RootState } from '../..';

// the app waits this long for its settings before going on with the defaults
const SETTINGS_TIMEOUT = 2_000;

const DEFAULTS: IndexerSettings = { rpcUrls: GNOSIS_RPC_URLS, blokliUrl: DEFAULT_BLOKLI_URL, ctNodes: CT_NODES };

const errorMessage = (e: unknown) => (e instanceof Error ? e.message : String(e));

/**
 * The RPC, blokli and CT settings from the indexer's database, once at start. A database that was
 * never edited gets the settings this browser saw last; without an indexer it is the defaults.
 */
const loadSettingsThunk = createAsyncThunk<boolean, void, { state: RootState }>(
  'indexer/loadSettings',
  async (_, { dispatch }) => {
    try {
      let settings = await indexerApi.getSettings(SETTINGS_TIMEOUT);
      const restore = settingsToRestore(settings);
      if (restore) {
        settings = await indexerApi.saveSettings(restore);
        toast('Settings restored from this browser', { type: 'info' });
      }
      saveBackup(settings);
      dispatch(appActions.setSettings({ ...settings, editable: true }));
      return true;
    } catch (e) {
      if (!(e instanceof indexerApi.IndexerUnavailableError)) console.warn('Could not load the settings', e);
      dispatch(appActions.setSettings({ ...DEFAULTS, editable: false }));
      return false;
    }
  },
);

/** Saves some of the settings into the indexer's database; rejected with the indexer's reason. */
const saveSettingsThunk = createAsyncThunk<IndexerSettings, Partial<IndexerSettings>, { state: RootState }>(
  'indexer/saveSettings',
  async (payload, { dispatch, rejectWithValue }) => {
    try {
      const settings = await indexerApi.saveSettings(payload);
      saveBackup(settings);
      dispatch(appActions.setSettings({ ...settings, editable: true }));
      return settings;
    } catch (e) {
      return rejectWithValue(errorMessage(e));
    }
  },
);

const getStatusThunk = createAsyncThunk<IndexerStatus, void, { state: RootState }>(
  'indexer/getStatus',
  async (_, { rejectWithValue }) => {
    try {
      return await indexerApi.getStatus();
    } catch (e) {
      return rejectWithValue(errorMessage(e));
    }
  },
);

export const createAsyncReducer = (builder: ActionReducerMapBuilder<typeof initialState>) => {
  builder.addCase(loadSettingsThunk.fulfilled, (state, action) => {
    state.available = action.payload;
  });
  builder.addCase(getStatusThunk.fulfilled, (state, action) => {
    state.available = true;
    state.status = action.payload;
  });
  builder.addCase(getStatusThunk.rejected, (state) => {
    state.status = null;
  });
};

export const actionsAsync = {
  loadSettingsThunk,
  saveSettingsThunk,
  getStatusThunk,
};

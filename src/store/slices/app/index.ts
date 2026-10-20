import { PayloadAction, createSlice } from '@reduxjs/toolkit';
import { initialState } from './initialState';
import { GetBalancesResponseType, GetChannelsResponseType, GetInfoResponseType } from '@hoprnet/hopr-sdk';
import { saveStateToLocalStorage } from '../../../utils/localStorage';
import { isAddress, getAddress } from 'viem';
import { buildAliasLinks, saveAliases } from '../../../utils/aliases';
import { saveWatchlist } from '../../../utils/watchlist';
import { ChannelsOutgoingType, ChannelsIncomingType } from '../../../store/slices/node/initialState';

// invalid addresses are ignored, kept ones stay in order and new ones go last
const updateWatchlist = (watchlist: string[], changes: Record<string, boolean>) => {
  const valid = Object.entries(changes).filter(([address]) => address && isAddress(address));
  const watched = new Map<string, boolean>(valid.map(([address, value]) => [getAddress(address), value]));
  const kept = watchlist.filter((address) => watched.get(address) !== false);
  const added = [...watched].flatMap(([address, value]) => (value && !kept.includes(address) ? [address] : []));
  return [...kept, ...added];
};

const appSlice = createSlice({
  name: 'app',
  initialState,
  reducers: {
    resetState: () => initialState,
    resetNodeState: (state) => ({
      ...state,
      previousStates: {
        ...state.previousStates,
        prevApiEndpoint: null,
        prevOutgoingChannels: null,
        prevIncomingChannels: null,
        prevMessagesUuids: [],
        prevNodeBalances: null,
        prevNodeInfo: null,
      },
    }),
    setNotificationSettings: (state, action: PayloadAction<typeof initialState.configuration.notifications>) => {
      if (action.payload) {
        state.configuration.notifications = action.payload;
        saveStateToLocalStorage('app/configuration/notifications', action.payload);
      }
    },
    setRpcSettings: (state, action: PayloadAction<typeof initialState.configuration.rpc>) => {
      state.configuration.rpc = action.payload;
      saveStateToLocalStorage('app/configuration/rpc', action.payload);
    },
    setBlokliSettings: (state, action: PayloadAction<typeof initialState.configuration.blokli>) => {
      state.configuration.blokli = action.payload;
      saveStateToLocalStorage('app/configuration/blokli', action.payload);
    },
    // handle aliases
    setAlias: (state, action: PayloadAction<{ peerAddress: string; alias: string }>) => {
      const { peerAddress, alias } = action.payload;
      if (!peerAddress || !alias || !isAddress(peerAddress)) return;
      state.aliases[getAddress(peerAddress)] = alias;
      saveAliases(state.aliases);
      state.aliasLinks = buildAliasLinks(state.aliases);
    },
    removeAlias: (state, action: PayloadAction<string>) => {
      const peerAddress = action.payload;
      if (!peerAddress || !isAddress(peerAddress)) return;
      delete state.aliases[getAddress(peerAddress)];
      saveAliases(state.aliases);
      state.aliasLinks = buildAliasLinks(state.aliases);
    },
    setWatched: (state, action: PayloadAction<{ address: string; watched: boolean }>) => {
      const { address, watched } = action.payload;
      state.watchlist = updateWatchlist(state.watchlist, { [address]: watched });
      saveWatchlist(state.watchlist);
    },
    // watched by address, one save for the whole batch
    setWatchedMany: (state, action: PayloadAction<Record<string, boolean>>) => {
      state.watchlist = updateWatchlist(state.watchlist, action.payload);
      saveWatchlist(state.watchlist);
    },
    addNotification: (
      state,
      action: PayloadAction<{
        id: string;
        name: string;
        source: string;
        timeout: number | null;
        url: string | null;
      }>,
    ) => {
      const now = Date.now();
      const defaultTimeout = 5000;
      state.notifications.push({
        ...action.payload,
        seen: false,
        interacted: false,
        timeout: action.payload.timeout ?? now + defaultTimeout,
      });
      if (state.notifications.length > 100)
        state.notifications = state.notifications.slice(state.notifications.length - 100, state.notifications.length);
    },
    seenNotification: (state, action: PayloadAction<string>) => {
      state.notifications = state.notifications.map((notification) =>
        notification.id === action.payload
          ? {
              ...notification,
              seen: true,
            }
          : notification,
      );
    },
    interactedWithNotification: (state, action: PayloadAction<string>) => {
      state.notifications = state.notifications.map((notification) =>
        notification.id === action.payload
          ? {
              ...notification,
              seen: true,
              interacted: true,
            }
          : notification,
      );
    },
    clearExpiredNotifications: (state) => {
      const now = Date.now();
      state.notifications = state.notifications.map((notification) =>
        notification.timeout < now
          ? {
              ...notification,
              seen: true,
              read: true,
            }
          : notification,
      );
    },
    clearNotifications: (state) => {
      state.notifications = [];
    },
    markSeenAllNotifications: (state) => {
      state.notifications = state.notifications.map((notification) => ({
        ...notification,
        seen: true,
      }));
    },
    setPrevApiEndpoint: (state, action: PayloadAction<string | null>) => {
      state.previousStates.prevApiEndpoint = action.payload;
    },
    setPrevOutgoingChannels: (state, action: PayloadAction<ChannelsOutgoingType | null>) => {
      state.previousStates.prevOutgoingChannels = action.payload;
    },
    setPrevIncomingChannels: (state, action: PayloadAction<ChannelsIncomingType | null>) => {
      state.previousStates.prevIncomingChannels = action.payload;
    },
    setPrevNodeInfo: (state, action: PayloadAction<GetInfoResponseType | null>) => {
      state.previousStates.prevNodeInfo = action.payload;
    },
    setPrevNodeBalances: (state, action: PayloadAction<GetBalancesResponseType | null>) => {
      state.previousStates.prevNodeBalances = action.payload;
    },
  },
});

export const appActions = appSlice.actions;
export default appSlice.reducer;

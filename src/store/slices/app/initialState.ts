import type { GetBalancesResponseType, GetInfoResponseType } from '@hoprnet/hopr-sdk';
import { loadStateFromLocalStorage } from '../../../utils/localStorage';
import { ChannelsOutgoingType, ChannelsIncomingType } from '../node/initialState';
import { AliasLinks, AliasMap, buildAliasLinks, loadAliases } from '../../../utils/aliases';
import { loadWatchlist } from '../../../utils/watchlist';
import { CT_NODES, DEFAULT_BLOKLI_URL, GNOSIS_RPC_URLS } from '../../../../config';

type InitialState = {
  notifications: {
    id: string;
    name: string;
    source: string;
    seen: boolean;
    interacted: boolean;
    timeout: number;
    url: string | null;
  }[];
  configuration: {
    notifications: {
      channels: boolean;
      nodeInfo: boolean;
      nodeBalances: boolean;
      message: boolean;
      pendingSafeTransaction: boolean;
      // "Safe received …": every redeemed ticket raises the safe's balance, so it is off unless chosen
      safeReceived: boolean;
    };
    // rpc, blokli and ctNodes live in the earnings indexer's database, loaded at start
    // (store/slices/indexer); without an indexer they are the built-in defaults
    rpc: {
      // Gnosis RPCs in fallback order
      urls: string[];
    };
    blokli: {
      url: string;
    };
    // node addresses whose tickets count as cover traffic
    ctNodes: string[];
    // false until the indexer answered or turned out to be missing, blokli is not queried before
    settingsLoaded: boolean;
    // only with an indexer, which stores them
    settingsEditable: boolean;
  };
  // nicknames for peer addresses, shared by every node
  aliases: AliasMap;
  aliasLinks: AliasLinks;
  // checksummed node addresses followed on NODE ADMIN → WATCHLIST
  watchlist: string[];
  previousStates: {
    prevApiEndpoint: string | null;
    prevOutgoingChannels: ChannelsOutgoingType | null;
    prevIncomingChannels: ChannelsIncomingType | null;
    prevNodeInfo: GetInfoResponseType | null;
    prevNodeBalances: GetBalancesResponseType | null;
    prevMessagesUuids: string[];
  };
};

// the blokli url used to be saved per node; storage may be blocked in an iframe
try {
  Object.keys(localStorage)
    .filter((key) => key.startsWith('blokli/url/'))
    .forEach((key) => localStorage.removeItem(key));
} catch (e) {
  console.warn('Could not clean up localStorage', e);
}

const aliases = loadAliases();

export const initialState: InitialState = {
  notifications: [],
  configuration: {
    // saved settings from before a switch existed get its default
    notifications: {
      channels: true,
      message: true,
      nodeBalances: true,
      nodeInfo: true,
      pendingSafeTransaction: true,
      safeReceived: false,
      ...(loadStateFromLocalStorage('app/configuration/notifications') as Partial<
        InitialState['configuration']['notifications']
      > | null),
    },
    rpc: { urls: GNOSIS_RPC_URLS },
    blokli: { url: DEFAULT_BLOKLI_URL },
    ctNodes: CT_NODES,
    settingsLoaded: false,
    settingsEditable: false,
  },
  aliases,
  aliasLinks: buildAliasLinks(aliases),
  watchlist: loadWatchlist(),
  // previous states used to compare for notifications
  previousStates: {
    prevApiEndpoint: null,
    prevOutgoingChannels: null,
    prevIncomingChannels: null,
    prevMessagesUuids: [],
    prevNodeBalances: null,
    prevNodeInfo: null,
  },
};

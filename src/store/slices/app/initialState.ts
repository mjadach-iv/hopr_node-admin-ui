import type { GetBalancesResponseType, GetInfoResponseType } from '@hoprnet/hopr-sdk';
import { loadStateFromLocalStorage } from '../../../utils/localStorage';
import { ChannelsOutgoingType, ChannelsIncomingType } from '../node/initialState';
import { AliasLinks, AliasMap, buildAliasLinks, loadAliases } from '../../../utils/aliases';
import { GNOSIS_RPC_URLS } from '../../../../config';

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
    };
    rpc: {
      // Gnosis RPCs in fallback order
      urls: string[];
    };
  };
  // nicknames for peer addresses, shared by every node
  aliases: AliasMap;
  aliasLinks: AliasLinks;
  previousStates: {
    prevApiEndpoint: string | null;
    prevOutgoingChannels: ChannelsOutgoingType | null;
    prevIncomingChannels: ChannelsIncomingType | null;
    prevNodeInfo: GetInfoResponseType | null;
    prevNodeBalances: GetBalancesResponseType | null;
    prevMessagesUuids: string[];
  };
};

const loadRpcSettings = (): InitialState['configuration']['rpc'] => {
  const stored = loadStateFromLocalStorage('app/configuration/rpc') as { urls?: unknown } | null;
  return Array.isArray(stored?.urls) ? { urls: stored.urls } : { urls: GNOSIS_RPC_URLS };
};

const aliases = loadAliases();

export const initialState: InitialState = {
  notifications: [],
  configuration: {
    notifications: (loadStateFromLocalStorage(
      'app/configuration/notifications',
    ) as InitialState['configuration']['notifications']) ?? {
      channels: true,
      message: true,
      nodeBalances: true,
      nodeInfo: true,
      pendingSafeTransaction: true,
    },
    rpc: loadRpcSettings(),
  },
  aliases,
  aliasLinks: buildAliasLinks(aliases),
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

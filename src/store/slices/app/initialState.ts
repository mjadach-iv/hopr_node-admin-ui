import type { GetBalancesResponseType, GetInfoResponseType } from '@hoprnet/hopr-sdk';
import { loadStateFromLocalStorage } from '../../../utils/localStorage';
import { ChannelsOutgoingType, ChannelsIncomingType } from '../node/initialState';
import { AliasMergeMode } from '../../../utils/aliases';
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
    aliases: {
      mergeMode: AliasMergeMode;
    };
    rpc: {
      // Gnosis RPCs in fallback order
      urls: string[];
    };
  };
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
    aliases: {
      ...{ mergeMode: 'network' as AliasMergeMode },
      ...((loadStateFromLocalStorage('app/configuration/aliases') as InitialState['configuration']['aliases'] | null) ??
        {}),
    },
    rpc: loadRpcSettings(),
  },
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

import { isAddress, getAddress } from 'viem';
import { loadStateFromLocalStorage, saveStateToLocalStorage } from './localStorage';

export type AliasMap = {
  [peerAddress: string]: string;
};

export type AliasLinks = {
  aliasTopeerAddress: {
    [alias: string]: string;
  };
  sortedAliases: string[];
  peerAddressesWithAliases: string[];
};

type SavedNode = {
  apiEndpoint: string | null;
  apiToken: string | null;
  localName: string | null;
  jazzIcon?: string | null;
  network?: string | null;
  nodeAddress?: string | null;
};

const ALIASES_KEY = 'app/aliases';
// where the aliases lived before they were shared between nodes
const NODE_ALIASES_PREFIX = 'node/aliases/';
const MERGE_MODE_KEY = 'app/configuration/aliases';

export function saveAliases(aliases: AliasMap) {
  saveStateToLocalStorage(ALIASES_KEY, aliases);
}

export function loadAliases(): AliasMap {
  // storage may be blocked in an iframe
  try {
    migrateAliasesToGlobal();
  } catch (e) {
    console.warn('Could not migrate the aliases', e);
  }
  return (loadStateFromLocalStorage(ALIASES_KEY) as AliasMap | null) ?? {};
}

/**
 * Lookups derived from the alias map, used by the autocomplete in the channel and session modals.
 */
export function buildAliasLinks(aliases: AliasMap): AliasLinks {
  const aliasTopeerAddress: AliasLinks['aliasTopeerAddress'] = {};
  Object.keys(aliases).forEach((peerAddress) => {
    aliasTopeerAddress[aliases[peerAddress]] = peerAddress;
  });
  return {
    aliasTopeerAddress,
    sortedAliases: Object.values(aliases).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' })),
    peerAddressesWithAliases: Object.keys(aliases),
  };
}

/**
 * Aliases used to be saved per node under `node/aliases/<nodeAddress>`. The first start after
 * the change merges them into the one shared map: saved nodes are taken A-Z by name, then the
 * nodes that were never saved, and the first alias for a peer address wins. Whatever the shared
 * map already holds is kept, so running this again changes nothing.
 */
function migrateAliasesToGlobal() {
  const oldKeys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(NODE_ALIASES_PREFIX)) oldKeys.push(key);
  }
  if (oldKeys.length === 0) return;

  const savedNodes = (loadStateFromLocalStorage('admin-ui-node-list') as SavedNode[] | null) ?? [];
  const savedAddresses: string[] = savedNodes
    .filter((node) => node.nodeAddress && isAddress(node.nodeAddress))
    .map((node) => ({
      nodeAddress: getAddress(node.nodeAddress as string),
      name: node.localName || node.apiEndpoint || '',
    }))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
    .map((node) => node.nodeAddress);
  const unsavedAddresses = oldKeys
    .map((key) => key.slice(NODE_ALIASES_PREFIX.length))
    .filter((nodeAddress) => !savedAddresses.includes(nodeAddress))
    .sort();

  const merged: AliasMap = (loadStateFromLocalStorage(ALIASES_KEY) as AliasMap | null) ?? {};
  [...savedAddresses, ...unsavedAddresses].forEach((nodeAddress) => {
    const aliases = (loadStateFromLocalStorage(NODE_ALIASES_PREFIX + nodeAddress) as AliasMap | null) ?? {};
    Object.keys(aliases).forEach((peerAddress) => {
      if (!isAddress(peerAddress)) return;
      const peerAddressValidated = getAddress(peerAddress);
      if (merged[peerAddressValidated]) return;
      merged[peerAddressValidated] = aliases[peerAddress];
    });
  });

  saveAliases(merged);
  oldKeys.forEach((key) => localStorage.removeItem(key));
  localStorage.removeItem(MERGE_MODE_KEY);
}

export const environment: 'dev' | 'node' | 'web3' = 'node'; //'node'; //'node';

// App
export const HOPR_TOKEN_USED = 'wxHOPR';
export const DEFAULT_BLOKLI_URL = 'https://blokli.piz-palu.gnosisvpn.io';
// reads the channel events blokli does not index; the node does not expose its own RPC.
// The first 2 serve eth_getLogs over the whole chain, publicnode is an independent
// provider capped at 50k blocks per request, so it is only scanned in windows.
export const GNOSIS_RPC_URLS = [
  'https://rpc.gnosischain.com',
  'https://rpc.gnosis.gateway.fm',
  'https://gnosis-rpc.publicnode.com',
];
// shown instead of '-' when every RPC failed
export const RPC_ERROR = 'RPC error';

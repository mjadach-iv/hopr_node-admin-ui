export const environment: 'dev' | 'node' | 'web3' = 'node'; //'node'; //'node';

// App
export const HOPR_TOKEN_USED = 'wxHOPR';
export const DEFAULT_BLOKLI_URL = 'https://blokli.piz-palu.gnosisvpn.io';
// reads the channel events blokli does not index; the node does not expose its own RPC.
// The first 2 serve eth_getLogs over the whole chain, publicnode is an independent
// provider capped at 10k blocks per request, so it is only scanned in windows.
// drpc and swiftnodes come last: their free plans read at most 100 blocks of logs per
// request (swiftnodes takes no batches either), so they stand in for block numbers,
// balances and the newest blocks, not for scanning the history.
export const GNOSIS_RPC_URLS = [
  'https://rpc.gnosischain.com',
  'https://rpc.gnosis.gateway.fm',
  'https://gnosis-rpc.publicnode.com',
  'https://gnosis.drpc.org',
  'https://rpc.swiftnodes.io/rpc/gnosis',
];
// shown instead of '-' when every RPC failed
export const RPC_ERROR = 'RPC error';
// The cover traffic (CT) nodes of piz-palu, all the nodes of safe 0x75E78c4ef91d567F63c5cBD5c5919e7c40436C00.
// Tickets they pay count as CT earnings on the watchlist, all others as traffic; editable in the settings.
export const CT_NODES = [
  '0x02D7D9cA7788E674676f809ac984CBF59E4B6099',
  '0x50EaC8E328847e5389AabB267398386Db7225644',
  '0x51624C828C175Cc81d6A7dd22A9A30D68C6A1ae0',
  '0x991A376C646274D74adB3b25CCc292A775f352F1',
  '0xa64109Ed980c902Ac554662b9D569a6A3F71e7a7',
];

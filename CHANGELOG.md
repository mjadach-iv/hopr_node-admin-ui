# Changelog

## 5.0.0-alpha.2 (unreleased)

Changes since 5.0.0-alpha.1.

### Added

- Network dashboard stats from network.hoprnet.org: availability (24h / 7d / 30d), latency, first seen and relay throughput for the connected node in a new INFO section, and for every node of the safe as new columns in SAFE → NODES. Polled every 5 minutes; only networks tracked by the dashboard (dufour, piz-palu-prod) are queried.
- Blokli backed channel columns (epoch, ticket index, estimated value) on the incoming and outgoing channels pages, plus closed channels tables.
- Transport section on the INFO page (NAT status, p2p connections, acknowledgements, rejected packets, mixer, path length).

### Changed

- xDai and wxHOPR amounts in the SAFE → NODES and CHANNELS tables and in the right hand info bar are shown in compact form (about 3 significant digits, e.g. `2.08k`), with the full value in a tooltip. Same rules as the HOPR hub.
- Node addresses in the SAFE → NODES and CHANNELS tables are shortened to `0x12345...abcde` with the full address in a tooltip. Copy, explorer link and search keep using the full address.
- "Redeemed" labels renamed to "Earned".

### Dependencies

- Added `numbro` for amount formatting.

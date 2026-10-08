# Changelog

## 5.0.0-alpha.3

Changes since 5.0.0-alpha.2.

### Added

- "Update available" in the header when the UI runs from the Docker image and a newer image has been released. Clicking it shows the `docker rm` / `docker run` commands that replace the container with the new version. Stable installs are only offered stable versions. Checked on load and every 6 hours against the repository's release tags.
- "Last throughput" column in SAFE → NODES, before "24h throughput".

### Removed

- "Latency" and "7d avail." columns from SAFE → NODES. Both are still shown on the INFO page.

### CI

- The Docker workflow is now "Close release". A manual run reads the version from `package.json`, fails if a git tag with that version already exists, pushes the image as `latest` and `<version>` (plus optional extra tags), and then tags the commit with the version.

## 5.0.0-alpha.2

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

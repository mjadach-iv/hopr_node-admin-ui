# Changelog

## 5.0.0-alpha.9

Changes since 5.0.0-alpha.8.

### Fixed

- The TypeScript check failed on BigInt literals in viem's ox dependency, breaking `pnpm build` and filling the dev server with errors.

## 5.0.0-alpha.8

Changes since 5.0.0-alpha.7.

### Added

- CONFIGURATION: a Gnosis RPC list under the Blokli URL. The RPCs are tried from the top, the next one taking over when one fails. Reorder them by drag and drop, remove them with the trash icon, add your own, then Save. Reset to default restores rpc.gnosischain.com, rpc.gnosis.gateway.fm and gnosis-rpc.publicnode.com.
- When every RPC fails, Spent and Net show "RPC error" instead of "-", in the header, on node and safe info, in the safe nodes table and on closed channels. A click opens the configuration page.

### Changed

- Spent falls back to the next RPC on any error. When none can read the whole chain in one request, the channel events are read in 10k block windows, which RPCs with a block range cap accept.
- CONFIGURATION: the Blokli URL's "Reset to node's" button is renamed Reset to default.

## 5.0.0-alpha.7

Changes since 5.0.0-alpha.6.

### Changed

- The header's safe chip and its breakdown show Net (earned - spent) in place of Earned and Spent.
- NODE INFO: Total staked and the Safe tile are gone. After Node gas come Node channels, Net, Earned and Spent, all for this node.
- SAFE INFO: Net moves to the fourth tile, before Earned and Spent.
- SAFE → NODES: a Net column before Earned and Spent.
- CHANNELS: closing channels count down to when they can be closed ("closable in 1:15"), with the exact time on hover.
- NODE INFO: the Blokli row in the addresses card is renamed Blokli provider and shows the URL scheme, e.g. `https://`.

### Removed

- NODE INFO: the Provider row in the Node & network card.

### Fixed

- Shortened negative amounts were rounded away from zero, so -0.0001 showed as -0.01.

## 5.0.0-alpha.6

Changes since 5.0.0-alpha.5.

### Added

- SAFE INFO page, above Nodes in the safe menu, laid out like node info: total staked, safe balance and channels, earned, spent and net over all safe nodes, the node count with a low xDAI warning, combined gas, the network dashboard's availability and throughput across the nodes, and the safe and node addresses. INFO in the node menu becomes NODE INFO.
- NODE INFO tells you when a newer stable hoprd is released: a warning triangle next to the outdated version, shown in orange, with the new version in its tooltip, and a notification once per node and release if node info notifications are on. Checked at most every 6 hours.
- The safe address on node and safe info opens the safe in Safe{Wallet}.
- NODE INFO: a Blokli row under Safe in the addresses card, showing the host and opening blokli's GraphiQL IDE.
- Total staked on node and safe info shows how much of it is in transit, held by closing channels until their closure is finalized.

### Changed

- The header's wallet chip is split in two: the node chip with connectivity and xDAI, the safe chip with the safe balance, channels, earned, spent and total. Each opens its own breakdown, and the mobile menu shows both.
- Earned and Spent in the header sum every node registered to the safe. They show "-" until every node's figure is known.
- Total staked and safe channels include closing channels, whose funds stay locked until the closure is finalized. The safe, channel and total figures come from one blokli response, so funds moving between the safe and a channel are not lost from the total. SAFE INFO lists closing channels next to the channel count.
- NODE INFO: the channels tile shows this node's open outgoing channels instead of the whole safe's, and Node gas comes right after Status.
- The update dialog's `docker run` command uses the admin UI's actual host port, or 4677 when served on 80/443.

### Removed

- NAT status on NODE INFO: libp2p autonat reports Private for nodes that peers do reach.

### Fixed

- Address tooltips no longer cover the copy and explorer buttons next to the address.

## 5.0.0-alpha.5

Changes since 5.0.0-alpha.4.

### Added

- Tables sort by clicking a column header. Numbers sort numerically and empty values go last.
- Spent next to Earned in the header: what counterparties redeemed from the node's outgoing channels, closed channels and earlier epochs included, read from the HoprChannels events.
- SAFE → NODES: a Spent column for each safe node, closed channels included.
- CHANNELS: the closed channels title is always shown, with its show/hide toggle next to it, and the choice is remembered. Closed channel rows get the ping, alias, channel and session actions.

### Changed

- Channel tables show the exact amount spent and earned per channel over all its epochs, closed channels included, instead of the ticket index × ticket price estimate, which undercounted multi-hop tickets. The estimate remains as a fallback, marked ≈, when the chain cannot be read.
- Channel events are requested in chunks of 200 channels, so safes with many nodes and channels can be read from public RPCs.
- The Scalar icon on NODE INFO is drawn in the primary yellow like the other icons, and the node dropdown button sits 8px further from the edge.

### Fixed

- SAFE → NODES loads the network dashboard figures for every safe node when the page opens, not only for the connected node.
- ALIASES: the last update date stays on one line.

## 5.0.0-alpha.4

Changes since 5.0.0-alpha.3.

### Added

- Mobile and tablet layout. Tables that do not fit their space turn into cards: wrapped columns on medium screens, two values per line on phones. The menu slides out and also shows the node wallet, and the header shows the total balance.

### Changed

- New look: dark HOPR blue theme with HOPR yellow accents, a sans-serif font with monospace only for addresses, and smaller unit names next to figures.
- The right hand info bar is gone. Node status and the main balances (node xDAI, safe, safe channels, earned, total) are in the header, and a click on them shows every balance at full precision. The page FAQ opens from "?" in the header.
- INFO page: headline tiles (status, total staked, safe, safe channels, earned, node gas, peers, channels) and compact cards replace the long list of tables. Packets and throughput are merged into one Traffic table.
- Denser tables: shorter rows, numbers right aligned, status pills, "last seen" as relative time, and copy, explorer and row actions highlighted on hover. The "#" column is gone.
- SAFE → NODES: throughput columns show the speed only, the share of the tested speed is in the tooltip.
- Tickets, Configuration, the landing page, dialogs, buttons, inputs and notifications follow the new theme.

### Fixed

- On phones the menu no longer reopens on every page load.

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

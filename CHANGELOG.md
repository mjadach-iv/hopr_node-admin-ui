# Changelog

## 5.0.0-alpha.15

Changes since 5.0.0-alpha.14.

### Changed

- Channel tables: a channel the node API reports as Open while blokli does not shows a red "Error" status instead of "Open · closable …", with a tooltip naming both statuses and the closure time.
- The collapsed sidebar is narrower and shows only the icons, centered, with no text cut off at its edge. The icons stay in place while the sidebar opens and closes, and the group headers and labels no longer wrap onto two lines during the animation. Its section icons are dark yellow.

## 5.0.0-alpha.14

Changes since 5.0.0-alpha.13.

### Added

- NODE ADMIN → WATCHLIST: the nodes you pick, in the same table as SAFE → NODES, grouped under a header row per safe. The header row shows the full safe address with its Safe{Wallet}, copy and explorer links, the safe's wxHOPR as "in safe / total" in the Balance column, with a tooltip laid out like the safe menu in the header (Balance, Total balance, full precision), and the sums of In channels, Net, Earned and Spent over every node of the safe, watched or not. The figures come from blokli, the Gnosis RPCs and the network dashboard, so the page works without connecting to a node and refreshes every minute. Nodes blokli knows no safe for are grouped as "Not registered to a safe".
- WATCHLIST rows have two actions: Create alias, and a trash icon that removes the node from the watchlist.
- SAFE → NODES: a checkbox at the end of every row adds the node to the watchlist or removes it. The list is kept in the browser, and the WATCHLIST menu entry shows how many nodes it holds.
- WATCHLIST: at the far right of every safe header row, a "watched/all nodes" button behind a nodes icon opens a dialog listing every node registered to the safe, from blokli, with a checkbox per node to add it to or remove it from the watchlist in one go.
- WATCHLIST: a + button next to refresh adds a node or a safe by its address. A node is watched right away, a safe opens the dialog of its nodes with all of them ticked.
- SAFE INFO: an allowance below 10k wxHOPR is shown in red with a warning icon, and a "raise" link next to it opens the new allowance Safe App in Safe{Wallet}.
- Notifications: "Allowance too low" when the Safe's allowance is below 10k wxHOPR, once right after login or when it drops below; clicking it opens the allowance Safe App in Safe{Wallet}. Notifications can now link outside the app, opened in a new tab.
- `/safe-app`: a page meant to run as a custom Safe App inside Safe{Wallet} to set the allowance. It shows the Safe's current allowance from blokli, takes the new allowance (100k by default, Max for unlimited, 0 revokes it) and hands the wxHOPR `approve` for the channels contract to Safe{Wallet}'s sign dialog. Safe{Wallet} reads `/safe-app/manifest.json` cross-origin, so the host must serve it with CORS headers; `nginx.conf` and `vercel.json` do, the FTP deploy target needs the same.

### Changed

- SAFE → NODES: the xDai column is called Balance.
- WATCHLIST: without a connected node, Last seen is when the network dashboard last reached the node.
- Disabled row actions in every table are dimmed, so they no longer look like the available ones until the row is hovered.
- Changing the Blokli URL on NODE ADMIN → CONFIGURATION reloads all data of the connected node, as after a fresh login.

### Fixed

- After logging in from the connect dialog, the blokli figures load again: the nodes on SAFE → NODES, In safe channels, Safe net and Total staked in the safe menu, SAFE INFO, the Tickets card and the blokli cells of the channel tables. They showed '-' until the page was reloaded.
- The app no longer fails to start where the browser blocks local storage, e.g. inside the Safe{Wallet} iframe with third-party storage blocked; settings then simply are not saved.

## 5.0.0-alpha.13

Changes since 5.0.0-alpha.12.

### Added

- SAFE INFO: a Module row with the address of the safe's node management module, read from the node's configuration, with the same explorer links as the safe address.

### Fixed

- NODE ADMIN → CONFIGURATION: the Add button for a new Gnosis RPC stays disabled, and Enter does nothing, until the URL has a real host: a domain with a dot, an IP address or localhost. A single word such as "abc" was accepted as http://abc.

## 5.0.0-alpha.12

Changes since 5.0.0-alpha.11.

### Added

- A NODE ADMIN group at the top of the menu, usable without connecting to a node: WATCHLIST (coming soon), ALIASES and CONFIGURATION (notifications, the Blokli URL and the Gnosis RPC list).

### Changed

- Aliases are one list shared by every node. The aliases saved per node are merged into it the first time the app starts: saved nodes are taken A-Z by name, then the nodes that were never saved, and the first alias for a peer address wins.
- CONFIGURATION under NODE keeps the Strategy and Configuration. Notifications, the Blokli URL and the Gnosis RPC list move to NODE ADMIN → CONFIGURATION.
- ALIASES moves from NETWORKING to NODE ADMIN. An old /networking/aliases link falls through to the home page.
- NETWORKING merges into NODE: PEERS, CHANNELS: IN, CHANNELS: OUT and SESSIONS now sit under NODE, at /node/... instead of /networking/.... An old /networking link falls through to the home page.
- CONFIGURATION is the last entry in NODE and in NODE ADMIN.
- The Blokli URL is one setting for every node, https://blokli.piz-palu.gnosisvpn.io by default, instead of the URL each node reports, and can be changed without connecting to a node. "Load url from node", enabled while connected, saves the URL the connected node reports. URLs saved per node are dropped.
- Smaller font in the Strategy and Configuration boxes on NODE → CONFIGURATION.
- Disconnecting on a NODE ADMIN page keeps you on that page instead of going to the home page.

### Fixed

- PEERS, CHANNELS: IN and CHANNELS: OUT show a loader until the first list arrives instead of "No entries", and the Epoch, Tickets and Spent/Earned cells show one while blokli reads the channels, which takes a while with many channels.
- Opening PEERS, CHANNELS: IN and CHANNELS: OUT with a few hundred rows is about 2-3x faster: tooltips mount on first hover, action dialogs on first open, fewer off-screen rows are rendered and node icons are cached. A loader shows while the rows render.
- Moving the mouse quickly across a table no longer leaves tooltips open behind it. Only the tooltip of the cell under the pointer shows.
- The RPC error link opens NODE ADMIN → CONFIGURATION, where the RPC list now is.
- The Add button next to a new Gnosis RPC is as wide as the Save button instead of half the line.
- Outlined buttons keep their text readable on hover instead of turning yellow on yellow.

### Removed

- The "merge aliases between nodes" switches, since there is one list now.

## 5.0.0-alpha.11

Changes since 5.0.0-alpha.10.

### Added

- NODE INFO: a Tickets card with the unredeemed, neglected and rejected ticket values and the number of on-chain redemptions. The Redeem all tickets button is in the page header, and the ticket questions are in the page's FAQ.

### Changed

- The Safe{Wallet} button next to the safe address opens the safe's home page in Safe{Wallet} instead of its apps page.

### Removed

- The TICKETS page. Its ticket price, minimum winning probability and earned value were already on NODE INFO, and the rest is in the new Tickets card.

## 5.0.0-alpha.10

Changes since 5.0.0-alpha.9.

### Fixed

- A safe with a node that never announced itself on chain showed Net as "-". Such a node cannot have opened a channel, so its channels and spent now count as 0. Values blokli could not answer for still show "-".

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

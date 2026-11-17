# HOPR Node Admin UI

A web UI for managing a HOPR node: balances, channels, peers, aliases, sessions, tickets and configuration.

## Disclaimer

**This is a community project, provided "as is", without warranty of any kind. Use it at your own risk.
No one — neither the authors nor the contributors — is responsible for any loss of funds or other damages resulting from its use.**

## Run with Docker

Prebuilt images for `linux/amd64` and `linux/arm64` are published to Docker Hub.

```sh
docker run -d --name hopr-node-admin-ui -p 4677:4677 -v hopr-admin-data:/data 0xmj/hopr-node-admin-ui:latest
```

The `/data` volume keeps the earnings indexer's database, which also holds the RPC, blokli and CT node settings (see [Earnings indexer](#earnings-indexer)).

Then open [http://localhost:4677](http://localhost:4677) and connect to your node with its API endpoint and token.
The node's API must be reachable from your browser, since the UI calls it directly.

## Desktop app

Every [GitHub release](https://github.com/mjadach-iv/hopr_node-admin-ui/releases) has the desktop app attached:

| Platform                        | File                                              |
| ------------------------------- | ------------------------------------------------- |
| macOS (Apple Silicon and Intel) | `hopr-node-admin-<version>-mac-universal.dmg`     |
| Windows x64                     | `hopr-node-admin-<version>-win-x64.exe`           |
| Linux x64 (AppImage)            | `hopr-node-admin-<version>-linux-x86_64.AppImage` |
| Linux arm64 (AppImage)          | `hopr-node-admin-<version>-linux-arm64.AppImage`  |

It is the same app as the web version and calls the node's API directly, so the node must be reachable from your machine.

The app updates itself from the GitHub releases. It checks on start and every 6 hours, downloads a new version in the background and shows **Restart to update** in the header when it is ready. **Check for Updates…** is in the app menu on macOS and in **Help** on Windows and Linux. An app on an alpha or beta version also takes prereleases, an app on a stable version only stable releases.

Platform notes:

- **macOS**: the app is not signed yet. Open it the first time with right-click > **Open**, or run `xattr -dr com.apple.quarantine "/Applications/HOPR Node Admin.app"`. Unsigned apps cannot install updates, so the header shows **Update available** with a link to the release instead.
- **Windows**: the installer is not signed, so SmartScreen warns on the first run. Choose **More info** > **Run anyway**.
- **Linux**: make the AppImage executable with `chmod +x`. Ubuntu 22.04 and newer need `libfuse2` (`libfuse2t64` on 24.04). Updates replace the AppImage file in place.

Logs are written to `~/Library/Logs/HOPR Node Admin/main.log` on macOS, `%APPDATA%\HOPR Node Admin\logs\main.log` on Windows and `~/.config/HOPR Node Admin/logs/main.log` on Linux.

## Development

Requirements:

- Node.js 24 (`.nvmrc`; `nvm use` or `fnm use` picks it up). The Docker image, CI and the desktop app (Electron 44) use Node 24 too.
- pnpm, enabled through Corepack. The exact version is pinned in the `packageManager` field of `package.json`.

```sh
corepack enable
pnpm install
pnpm dev
```

The dev server runs at [http://localhost:5173](http://localhost:5173) and reloads on changes.

Other scripts:

| Command       | What it does                                 |
| ------------- | -------------------------------------------- |
| `pnpm build`  | Type-checks and builds the app into `build/` |
| `pnpm serve`  | Serves the production build on port 3000     |
| `pnpm lint`   | Runs ESLint with autofix                     |
| `pnpm format` | Formats the code with Prettier               |

### Desktop app development

The desktop app is an [Electron](https://www.electronjs.org/) shell around the same build, in `electron/`.
It is packaged with [electron-builder](https://www.electron.build/) (`electron-builder.yml`) and updates through [electron-updater](https://www.electron.build/auto-update) from the GitHub releases.

| Command               | What it does                                                                                         |
| --------------------- | ---------------------------------------------------------------------------------------------------- |
| `pnpm electron:dev`   | Starts the Vite dev server and opens it in Electron, with reload on changes in `src/`                |
| `pnpm electron:pack`  | Builds the app into `release/<platform>-unpacked/` (or `release/mac-*/` on macOS) without installers |
| `pnpm electron:build` | Builds the installers and update files for the current OS into `release/`                            |

#### Building the desktop app

With the [requirements](#development) installed and `pnpm install` done, build on the operating system you are building for: macOS apps only build on macOS, Windows installers on Windows, AppImages on Linux. CI builds all three (see [Continuous integration](#continuous-integration)).

To try a build, package it without installers:

```sh
pnpm electron:pack
```

It runs `pnpm build` (the app, type checks and the earnings indexer in `dist-indexer/`), compiles `electron/` into `dist-electron/` and packages everything into `release/`. On macOS that gives `release/mac-arm64/HOPR Node Admin.app` (`mac-x64` on Intel), for the Mac it was built on. Its name carries no version, only the installers below do; the app shows its version at the bottom right. Earlier builds stay in `release/` until it is deleted. Open it with:

```sh
open "release/mac-arm64/HOPR Node Admin.app"
```

Without a Developer ID certificate the macOS app is signed ad hoc (`electron/afterPack.cjs`), which is enough to run it on the Mac that built it. The packaged app uses the same profile as an installed one, with `indexer.sqlite` next to the saved settings: `~/Library/Application Support/HOPR Node Admin/` on macOS, `%APPDATA%\HOPR Node Admin\` on Windows, `~/.config/HOPR Node Admin/` on Linux.

For the installers and update files of a release, as attached to the GitHub releases:

```sh
pnpm electron:build
```

| OS      | Output in `release/`                                                              |
| ------- | --------------------------------------------------------------------------------- |
| macOS   | `hopr-node-admin-<version>-mac-universal.dmg` and `.zip`, Apple Silicon and Intel |
| Windows | `hopr-node-admin-<version>-win-x64.exe`                                           |
| Linux   | `hopr-node-admin-<version>-linux-x86_64.AppImage` and `-arm64.AppImage`           |

Signed and notarized macOS builds need the certificate and Apple ID variables described in [Signing the macOS app](#signing-the-macos-app).

Starting the binary in `Contents/MacOS/` directly from a terminal that sets `ELECTRON_RUN_AS_NODE` (VS Code's does) runs it as plain Node, which fails with `bad option`; prefix it with `env -u ELECTRON_RUN_AS_NODE`. `open` is not affected.

The packaged app serves `build/` from the `app://node-admin/` origin (`electron/protocol.ts`), so the web build runs unchanged.
`/hoprd-tags` is answered there too, as nginx and the Vite dev server do for the web build.
Safe{Wallet} loads custom Safe Apps over http(s) only, so the packaged app also serves `build/` on `http://127.0.0.1:4678` (`electron/safeAppServer.ts`, a random port when 4678 is taken), and the Safe App pages (`/safe-app` for the allowance, `/safe-app-add-node`, `/safe-app-remove-node`) open in Safe{Wallet} from there.
Updates are only checked in the packaged app.

## Earnings indexer

The watchlist's earnings over time come from an indexer in `indexer/`, which runs in the desktop app's main process (`electron/indexer.ts`) and in the Docker image (`indexer/server.ts` behind nginx).
Both serve the same API at `/indexer/api/`; the desktop app answers it on its `app://` origin without opening a port.
The web deploys (Vercel, FTP) have no indexer: the chart is hidden and the settings below are the defaults.

- It walks every HoprChannels log of the network through the configured Gnosis RPCs, from the contract's deployment to the finalized block, and stores every ticket redemption with its amount, source and destination. A node added to the watchlist has its history at once.
- Earnings are split at query time: tickets from the channels of the CT nodes set in NODE ADMIN → CONFIGURATION count as CT, all others as traffic. The default CT nodes (`CT_NODES` in `config.ts`) are the nodes of the piz-palu CT safe. A node's spent is the tickets it paid, from the same rows.
- Everything is in one SQLite file (`node:sqlite`, no native module): `indexer.sqlite` in the desktop app's user data folder, `/data/indexer.sqlite` in Docker.
- The RPC, blokli and CT node settings live in that file too, only once saved: until then they follow the env and the defaults of the running version. The browser keeps a copy and restores it into a database that was never edited, e.g. a container recreated without a volume.
- The file carries its versions (`indexer/db.ts`). A change to the decoding bumps `INDEX_VERSION`: the index is rebuilt from the chain, which takes a minute or two, and the settings and watched nodes stay. A change to the settings or nodes tables adds a migration, which keeps them. A file written by a newer app than the running one, after a downgrade, is deleted and started over.

| Command              | What it does                                                                                      |
| -------------------- | ------------------------------------------------------------------------------------------------- |
| `pnpm indexer:dev`   | Builds the indexer and runs it on `127.0.0.1:4680` with `.indexer/indexer.sqlite`, for `pnpm dev` |
| `pnpm build:indexer` | Bundles it into `dist-indexer/` (part of `pnpm build`)                                            |

The Vite dev server proxies `/indexer` to port 4680, where `pnpm electron:dev` serves the indexer too.

## Build the Docker image

```sh
docker build -t hopr-node-admin-ui .
docker run -d --name hopr-node-admin-ui -p 4677:4677 -v hopr-admin-data:/data hopr-node-admin-ui
```

The image is built in three stages:

1. **deps** installs dependencies with pnpm on Node 24.
2. **build** runs `pnpm build` and writes the app version to `version.txt`.
3. **runtime** serves the static files with nginx on port 4677, using `nginx.conf`, and runs the earnings indexer next to it (`docker/entrypoint.sh`).

The first two stages always run on the builder's native platform, because their output is plain static files.
That makes multi-architecture builds fast, since nothing is emulated:

```sh
docker buildx build --platform linux/amd64,linux/arm64 -t hopr-node-admin-ui .
```

The running container reports its version at `/version.txt`.

## Continuous integration

| Workflow                                             | Trigger         | What it does                                                                                                                                                                                            |
| ---------------------------------------------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Close release](.github/workflows/close-release.yml) | Manual run, PRs | Pushes the image as `latest` and the `package.json` version (plus extra tags), builds the desktop app, then creates the GitHub release with the installers (PRs only build the image and the Linux app) |
| [Deploy](.github/workflows/deploy.yml)               | Manual run      | Builds the app and uploads `build/` to a web server over FTP                                                                                                                                            |

### Releasing

Set these under **Settings > Secrets and variables > Actions** in the GitHub repository:

- **Variable `DOCKERHUB_USERNAME`**: the Docker Hub account or organisation that owns the image. Falls back to the GitHub owner name.
- **Secret `DOCKERHUB_TOKEN`**: a Docker Hub access token with Read & Write scope.

Images are only pushed when you run the workflow by hand:

1. Bump `version` in `package.json` and push the change.
2. Open **Actions > Close release > Run workflow**.
3. Pick the branch to release from.
4. Optionally enter extra image tags, separated by commas or spaces. `latest` and the `package.json` version are always pushed.

The workflow then creates the GitHub release for the version on the released commit, for example `5.0.0`, with the desktop installers and their update files (`latest*.yml`) attached.
Versions with a `-` part, like `5.0.0-alpha.15`, are marked as prereleases.
If that git tag already exists, the run fails before anything is built or pushed.

Pull requests build the image and the Linux desktop app to check them, but never push or release anything.

#### Signing the macOS app

Without a certificate the macOS app is built unsigned. Gatekeeper then blocks the first start, and the app cannot install its own updates.
To sign and notarize it, add these five secrets from an Apple Developer Program account. Set all of them, or none:

- **`CSC_LINK`**: the Developer ID Application certificate with its private key, as a base64 encoded `.p12` file.
- **`CSC_KEY_PASSWORD`**: the password of that `.p12` file.
- **`APPLE_ID`**, **`APPLE_APP_SPECIFIC_PASSWORD`** and **`APPLE_TEAM_ID`**: the Apple ID, an [app-specific password](https://support.apple.com/en-us/102654) for it and the team ID, used to notarize the app.

Builds made after that are signed, notarized and install their updates themselves.
Apps already installed from unsigned builds keep linking to the release, so users update them once by hand.

### FTP deploy

The Deploy workflow needs the secrets `FTP_SERVER`, `FTP_USERNAME` and `FTP_PASSWORD`.
The web server must serve `index.html` for unknown paths, because the app uses client-side routing.

## Contributing

To contribute to this repository, open a pull request.

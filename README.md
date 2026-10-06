# HOPR Node Admin UI

A web UI for managing a HOPR node: balances, channels, peers, aliases, sessions, tickets and configuration.

## Disclaimer

**This is a community project, provided "as is", without warranty of any kind. Use it at your own risk.
No one — neither the authors nor the contributors — is responsible for any loss of funds or other damages resulting from its use.**

## Run with Docker

Prebuilt images for `linux/amd64` and `linux/arm64` are published to Docker Hub.

```sh
docker run -d --name hopr-node-admin-ui -p 4677:4677 0xmj/hopr-node-admin-ui:latest
```

Then open [http://localhost:4677](http://localhost:4677) and connect to your node with its API endpoint and token.
The node's API must be reachable from your browser, since the UI calls it directly.

## Development

Requirements:

- Node.js 22.13 or newer (CI uses Node 24)
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

## Build the Docker image

```sh
docker build -t hopr-node-admin-ui .
docker run -d --name hopr-node-admin-ui -p 4677:4677 hopr-node-admin-ui
```

The image is built in three stages:

1. **deps** installs dependencies with pnpm on Node 24.
2. **build** runs `pnpm build` and writes the app version to `version.txt`.
3. **runtime** serves the static files with nginx on port 4677, using `nginx.conf`.

The first two stages always run on the builder's native platform, because their output is plain static files.
That makes multi-architecture builds fast, since nothing is emulated:

```sh
docker buildx build --platform linux/amd64,linux/arm64 -t hopr-node-admin-ui .
```

The running container reports its version at `/version.txt`.

## Continuous integration

| Workflow                               | Trigger         | What it does                                                            |
| -------------------------------------- | --------------- | ----------------------------------------------------------------------- |
| [Docker](.github/workflows/docker.yml) | Manual run, PRs | Pushes the image to Docker Hub with the tags you enter (PRs only build) |
| [Deploy](.github/workflows/deploy.yml) | Manual run      | Builds the app and uploads `build/` to a web server over FTP            |

### Docker Hub publishing

Set these under **Settings > Secrets and variables > Actions** in the GitHub repository:

- **Variable `DOCKERHUB_USERNAME`**: the Docker Hub account or organisation that owns the image. Falls back to the GitHub owner name.
- **Secret `DOCKERHUB_TOKEN`**: a Docker Hub access token with Read & Write scope.

Images are only pushed when you run the workflow by hand:

1. Bump `version` in `package.json` and push the change.
2. Open **Actions > Docker > Run workflow**.
3. Pick the branch or tag to build from.
4. Enter the image tags, separated by commas or spaces, for example `5.0.0, latest`.

Pull requests build the image to check it, but never push it.

### FTP deploy

The Deploy workflow needs the secrets `FTP_SERVER`, `FTP_USERNAME` and `FTP_PASSWORD`.
The web server must serve `index.html` for unknown paths, because the app uses client-side routing.

## Contributing

To contribute to this repository, open a pull request.

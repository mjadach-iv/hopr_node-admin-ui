# HOPR Node Admin UI

A community web UI for managing a HOPR node: balances, channels, peers, aliases, sessions, tickets and configuration.

> **Disclaimer:** This is a community project, provided "as is", without warranty of any kind. Use it at your own risk. No one — neither the authors nor the contributors — is responsible for any loss of funds or other damages resulting from its use.

## Quick start

```sh
docker run -d --pull always --name hopr-node-admin-ui -p 4677:4677 -v hopr-admin-data:/data 0xmj/hopr-node-admin-ui:latest
```

Open http://localhost:4677 and connect to your node with its API endpoint and token.

The volume at `/data` holds the earnings indexer's database: the earnings history of the network and the RPC, blokli and CT node settings. Without it they are lost whenever the container is recreated, and the indexer warns about it in the container log.

The UI runs in your browser and calls the node's API directly. The API must be reachable from the browser, not just from the container.

To use a different port on the host, change the left side of `-p`, for example `-p 8080:4677`.

## Updating

When a newer image is released, the UI shows **Update available** in the header. Clicking it gives you the exact commands, which look like this:

```sh
docker rm -f hopr-node-admin-ui
docker run -d --name hopr-node-admin-ui -p 4677:4677 -v hopr-admin-data:/data 0xmj/hopr-node-admin-ui:<version>
```

Saved node connections, aliases and the watchlist stay in your browser. The settings and the indexed earnings stay in the `hopr-admin-data` volume, so replacing the container loses nothing.

## Tags

| Tag                               | What it is                                    |
| --------------------------------- | --------------------------------------------- |
| `latest`                          | The newest release                            |
| `<version>`, e.g. `5.0.0-alpha.3` | One specific release. It is never overwritten |

Every tag is built for `linux/amd64` and `linux/arm64`.

To check which version a running container serves:

```sh
curl http://localhost:4677/version.txt
```

## Image details

- Static build served by `nginx:stable-alpine` on port `4677`, with the earnings indexer (Node 24) next to it at `/indexer/api/`.
- Volume `/data`: the indexer's SQLite database, including the RPC, blokli and CT node settings. Whoever can reach the port can change these settings, as they are shared by every browser using the container.
- Optional environment variables:

| Variable             | What it does                                                                     |
| -------------------- | -------------------------------------------------------------------------------- |
| `INDEXER_RPC_URLS`   | Comma separated Gnosis RPCs used before any are saved in the UI                  |
| `INDEXER_BLOKLI_URL` | The blokli used before one is saved in the UI                                    |
| `INDEXER_CT_NODES`   | Comma separated CT node addresses used before any are saved in the UI            |
| `INDEXER_ENABLED`    | `false` runs the UI without the indexer: no earnings chart, settings are default |

## Links

- [Source code and issues](https://github.com/mjadach-iv/hopr_node-admin-ui)
- [Changelog](https://github.com/mjadach-iv/hopr_node-admin-ui/blob/main/CHANGELOG.md)
- [HOPR documentation](https://docs.hoprnet.org/)

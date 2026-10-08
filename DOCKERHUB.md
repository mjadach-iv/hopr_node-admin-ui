# HOPR Node Admin UI

A community web UI for managing a HOPR node: balances, channels, peers, aliases, sessions, tickets and configuration.

> **Disclaimer:** This is a community project, provided "as is", without warranty of any kind. Use it at your own risk. No one — neither the authors nor the contributors — is responsible for any loss of funds or other damages resulting from its use.

## Quick start

```sh
docker run -d --pull always --name hopr-node-admin-ui -p 4677:4677 0xmj/hopr-node-admin-ui:latest
```

Open http://localhost:4677 and connect to your node with its API endpoint and token.

The UI runs in your browser and calls the node's API directly. The API must be reachable from the browser, not just from the container.

To use a different port on the host, change the left side of `-p`, for example `-p 8080:4677`.

## Updating

When a newer image is released, the UI shows **Update available** in the header. Clicking it gives you the exact commands, which look like this:

```sh
docker rm -f hopr-node-admin-ui
docker run -d --name hopr-node-admin-ui -p 4677:4677 0xmj/hopr-node-admin-ui:<version>
```

Nothing is stored in the container. Saved node connections stay in your browser, so replacing the container loses nothing.

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

- Static build served by `nginx:stable-alpine` on port `4677`.
- No volumes and no environment variables needed.

## Links

- [Source code and issues](https://github.com/mjadach-iv/hopr_node-admin-ui)
- [Changelog](https://github.com/mjadach-iv/hopr_node-admin-ui/blob/main/CHANGELOG.md)
- [HOPR documentation](https://docs.hoprnet.org/)

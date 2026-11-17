#!/bin/sh
# nginx and the earnings indexer side by side. This shell is PID 1, so docker stop's SIGTERM
# reaches both and the indexer closes its database cleanly. nginx starts through its own
# entrypoint, which fills in the config template (DNS resolvers) first.
set -eu

indexer_pid=
if [ "${INDEXER_ENABLED:-true}" != "false" ]; then
  mkdir -p "$(dirname "$INDEXER_DB")"
  (
    child=
    trap 'if [ -n "$child" ]; then kill -TERM "$child" 2>/dev/null; wait "$child"; fi; exit 0' TERM INT
    # a crash restarts it, it resumes from the last block it committed
    while true; do
      node /opt/indexer/server.cjs &
      child=$!
      wait "$child" || true
      echo "earnings indexer stopped, restarting in 5s" >&2
      sleep 5
    done
  ) &
  indexer_pid=$!
fi

/docker-entrypoint.sh "$@" &
nginx_pid=$!

stop() {
  kill -TERM "$nginx_pid" 2>/dev/null || true
  if [ -n "$indexer_pid" ]; then kill -TERM "$indexer_pid" 2>/dev/null || true; fi
}
trap stop TERM INT

# nginx exiting for any reason ends the container
wait "$nginx_pid" || true
stop
if [ -n "$indexer_pid" ]; then wait "$indexer_pid" || true; fi

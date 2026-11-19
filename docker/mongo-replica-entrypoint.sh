#!/bin/bash
# Starts a three-member MongoDB replica set (rs0) for local development.
#
# All three mongod processes run in one container on ports 27017-27019 and
# advertise themselves as 127.0.0.1:<port>. The same ports are published on
# the host, so the API (running on the host) can reach every member by the
# same address the members use for each other, and the driver can follow a
# failover to a new primary.
set -e

for port in 27017 27018 27019; do
  mkdir -p "/data/rs/$port"
  mongod --replSet rs0 --port "$port" --bind_ip_all --dbpath "/data/rs/$port" \
    --logpath "/data/rs/$port.log" --fork
done

# Initiate the replica set once (the config survives restarts in /data/rs).
if ! mongosh --quiet --port 27017 --eval 'rs.status().ok' >/dev/null 2>&1; then
  mongosh --quiet --port 27017 --eval '
    rs.initiate({
      _id: "rs0",
      members: [
        { _id: 0, host: "127.0.0.1:27017", priority: 2 },
        { _id: 1, host: "127.0.0.1:27018", priority: 1 },
        { _id: 2, host: "127.0.0.1:27019", priority: 1 }
      ]
    })'
fi

echo "Replica set rs0 is running on ports 27017, 27018 and 27019."
# Keep the container in the foreground by following the primary's log.
tail -F /data/rs/27017.log

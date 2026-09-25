#!/usr/bin/env bash
set -euo pipefail

# Starts a MongoDB container for integration tests.
# Usage: ./test/bin/mongo-docker.sh start|stop|status

CONTAINER_NAME="devconnector-test-mongo"
IMAGE="mongo:7.0"
PORT="${MONGODB_PORT:-27018}"

case "${1:-}" in
  start)
    if docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
      echo "Container ${CONTAINER_NAME} already running"
      echo "mongodb://localhost:${PORT}/devconnector_test"
      exit 0
    fi
    docker rm -f "${CONTAINER_NAME}" >/dev/null 2>&1 || true
    docker run -d \
      --name "${CONTAINER_NAME}" \
      -p "${PORT}:27017" \
      -e MONGO_INITDB_DATABASE=devconnector_test \
      "${IMAGE}"
    # Wait for mongo to be ready
    for i in $(seq 1 30); do
      if docker exec "${CONTAINER_NAME}" mongosh --quiet --eval "db.adminCommand('ping')" >/dev/null 2>&1; then
        echo "mongodb://localhost:${PORT}/devconnector_test"
        exit 0
      fi
      sleep 1
    done
    echo "ERROR: MongoDB container failed to start within 30s" >&2
    docker logs "${CONTAINER_NAME}" >&2
    exit 1
    ;;

  stop)
    if docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
      docker stop "${CONTAINER_NAME}"
      docker rm "${CONTAINER_NAME}"
      echo "Stopped ${CONTAINER_NAME}"
    else
      echo "Container ${CONTAINER_NAME} not running"
    fi
    ;;

  status)
    if docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
      echo "running"
      exit 0
    else
      echo "stopped"
      exit 1
    fi
    ;;

  *)
    echo "Usage: $0 {start|stop|status}" >&2
    exit 1
    ;;
esac

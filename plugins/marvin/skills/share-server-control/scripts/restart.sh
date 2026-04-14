#!/usr/bin/env bash
set -euo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"

bash "$DIR/stop.sh"
sleep 1
bash "$DIR/start.sh"

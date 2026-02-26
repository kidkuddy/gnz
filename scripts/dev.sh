#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# Build backend sidecar first
echo "Building backend sidecar..."
"$ROOT/scripts/build-backend.sh"

# Start Tauri dev mode from project root (CLI finds desktop/tauri.conf.json)
echo "Starting Tauri dev mode..."
cd "$ROOT"
pnpm tauri dev -- --release

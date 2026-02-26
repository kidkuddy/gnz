#!/usr/bin/env bash
set -euo pipefail

# Detect target triple
case "$(uname -s)-$(uname -m)" in
  Darwin-arm64)  TRIPLE="aarch64-apple-darwin" ;;
  Darwin-x86_64) TRIPLE="x86_64-apple-darwin" ;;
  Linux-aarch64) TRIPLE="aarch64-unknown-linux-gnu" ;;
  Linux-x86_64)  TRIPLE="x86_64-unknown-linux-gnu" ;;
  *) echo "Unsupported platform"; exit 1 ;;
esac

OUTDIR="$(dirname "$0")/../desktop/binaries"
mkdir -p "$OUTDIR"

echo "Building gnz-backend for $TRIPLE..."
cd "$(dirname "$0")/../backend"
go build -o "$OUTDIR/gnz-backend-$TRIPLE" ./cmd/gnz-backend/
echo "Done: $OUTDIR/gnz-backend-$TRIPLE"

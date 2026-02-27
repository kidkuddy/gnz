SHELL := /bin/zsh

# Detect target triple for Tauri sidecar naming
UNAME_S := $(shell uname -s)
UNAME_M := $(shell uname -m)

ifeq ($(UNAME_S),Darwin)
  ifeq ($(UNAME_M),arm64)
    TARGET_TRIPLE := aarch64-apple-darwin
  else
    TARGET_TRIPLE := x86_64-apple-darwin
  endif
else ifeq ($(UNAME_S),Linux)
  ifeq ($(UNAME_M),aarch64)
    TARGET_TRIPLE := aarch64-unknown-linux-gnu
  else
    TARGET_TRIPLE := x86_64-unknown-linux-gnu
  endif
endif

SIDECAR_NAME := gnz-backend-$(TARGET_TRIPLE)

.PHONY: all dev build clean backend ui tauri setup

all: build

# Install dependencies
setup:
	cd ui && pnpm install
	cd backend && go mod tidy

# Build Go backend and place as sidecar (only if sources changed)
backend:
	@NEWEST_SRC=$$(find backend -name '*.go' -newer desktop/binaries/$(SIDECAR_NAME) 2>/dev/null | head -1); \
	if [ ! -f desktop/binaries/$(SIDECAR_NAME) ] || [ -n "$$NEWEST_SRC" ]; then \
		cd backend && go build -o ../desktop/binaries/$(SIDECAR_NAME) ./cmd/gnz-backend/; \
		echo "Built sidecar: desktop/binaries/$(SIDECAR_NAME)"; \
	else \
		echo "Sidecar up to date, skipping Go build"; \
	fi

# Build frontend
ui:
	cd ui && pnpm build

# Build everything and package with Tauri
build: backend ui
	pnpm tauri build

# Development mode
dev: backend
	./scripts/dev.sh

# Clean build artifacts
clean:
	rm -rf ui/dist
	rm -rf desktop/binaries/gnz-backend-*
	rm -rf desktop/target
	cd backend && rm -f gnz-backend

# Just build and check the backend
backend-check:
	cd backend && go vet ./...
	cd backend && go build -o gnz-backend ./cmd/gnz-backend/
	@echo "Backend OK"
	cd backend && rm -f gnz-backend

SHELL := /bin/bash
BACKEND := ../..
BIN_DIR := $(BACKEND)/bin
HERALD := $(BIN_DIR)/herald
HLD := $(BIN_DIR)/hld

.PHONY: all build herald hld clean vet test run health

all: build

# Build both binaries
build: herald hld

herald:
	@mkdir -p $(BIN_DIR)
	cd $(BACKEND) && go build -o $(abspath $(HERALD)) ./cmd/herald/
	@echo "built: $(HERALD)"

hld:
	@mkdir -p $(BIN_DIR)
	cd $(BACKEND) && go build -o $(abspath $(HLD)) ./cmd/hld/
	@echo "built: $(HLD)"

# Run the daemon (requires ANTHROPIC_API_KEY)
run: herald
	$(HERALD) --port 9090 --data-dir /tmp/herald-dev

# Vet all herald packages
vet:
	cd $(BACKEND) && go vet ./pkg/herald/...

# Run tests (when they exist)
test:
	cd $(BACKEND) && go test ./pkg/herald/...

# Quick health check against a running daemon
health:
	@curl -s http://localhost:9090/health | python3 -m json.tool 2>/dev/null || echo "Herald not running"

# Clean build artifacts
clean:
	rm -f $(HERALD) $(HLD)
	rm -rf /tmp/herald-dev

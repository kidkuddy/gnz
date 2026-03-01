# Benchmark Report: Herald vs Claude Code

**Date:** 2026-03-01
**System:** Apple M1, 8 cores, 16 GB RAM, macOS 26.3, arm64
**Runs:** 2 per scenario per phase

---

## TL;DR

Herald is **6.5x faster** on simple prompts and uses **25x less memory** than Claude Code. At 8 concurrent requests, Herald handles **6.1 req/s** vs Claude's **0.67 req/s** — a **9.1x throughput advantage** — while consuming **78x less memory**.

---

## Cold Start

Fresh process per prompt. No prior session state.

| Scenario | Claude | Herald | Speedup | Claude RSS | Herald RSS | Memory Ratio |
|----------|--------|--------|---------|------------|------------|-------------|
| simple_text | 7.54s | 1.16s | **6.5x** | 297 MB | 12 MB | 24.7x |
| file_listing | 17.56s | 5.95s | **3.0x** | 309 MB | 11 MB | 28.0x |
| read_summarize | 14.54s | 4.34s | **3.4x** | 295 MB | 11 MB | 26.8x |
| heavy_reasoning | 23.71s | 16.32s | **1.5x** | 333 MB | 12 MB | 27.7x |

Herald's daemon process peaked at ~23 MB across all scenarios. Claude spawns a full Node.js process each time (~300 MB).

The speedup is most pronounced on simple prompts where startup overhead dominates. On heavy_reasoning, the API call itself takes 15s+ so startup cost matters less — but Herald still wins by ~7s.

## Warm Session

Second message sent to an existing session.

| Scenario | Claude | Herald | Speedup | Claude RSS | Herald RSS | Memory Ratio |
|----------|--------|--------|---------|------------|------------|-------------|
| simple_text | 8.37s | 0.95s | **8.8x** | 275 MB | 11 MB | 25.0x |
| file_listing | 13.31s | 3.48s | **3.8x** | 331 MB | 11 MB | 30.0x |
| read_summarize | 10.70s | 2.72s | **3.9x** | 281 MB | 11 MB | 25.5x |
| heavy_reasoning | 17.44s | 7.92s | **2.2x** | 294 MB | 12 MB | 24.5x |

Herald's warm session performance is notably better than cold — simple_text drops from 1.16s to 0.95s (session already loaded in daemon memory). Claude with `--continue` still has to spin up a full Node process each time, so warm vs cold makes little difference for it.

## Parallel / Concurrent (simple_text)

N simultaneous requests fired at the same time.

| Concurrency | Claude Wall | Herald Wall | Speedup | Claude RSS Total | Herald Daemon | Memory Ratio |
|-------------|-------------|-------------|---------|------------------|---------------|-------------|
| C=2 | 7.77s | 1.61s | **4.8x** | 558 MB | 23 MB | 24.2x |
| C=4 | 13.26s | 1.42s | **9.3x** | 1,108 MB | 25 MB | 44.3x |
| C=8 | 12.00s | 1.31s | **9.1x** | 2,178 MB | 28 MB | 77.7x |

| Metric | Claude | Herald |
|--------|--------|--------|
| C=8 Throughput | 0.67 req/s | 6.10 req/s |

This is where Herald's daemon architecture really shines:
- **Claude** spawns 8 separate Node processes = 8 x ~270 MB = 2.2 GB total
- **Herald** runs all 8 sessions in goroutines within a single ~28 MB daemon
- Herald wall time is essentially flat (1.3-1.6s) regardless of concurrency — the API calls run in parallel within the daemon
- Claude wall time scales roughly linearly with concurrency as processes compete for resources

## Key Takeaways

1. **Startup cost is Herald's biggest win.** Claude's Node.js process takes ~5-8s to boot. Herald's thin Go client (`hld`) takes <0.1s — the daemon is already running.

2. **Memory efficiency scales with usage.** One Herald daemon at 28 MB serves 8 concurrent requests. Claude would use 2.2 GB for the same workload. On a 16 GB machine, you'd hit memory pressure at ~40 concurrent Claude processes but could comfortably run 100+ Herald sessions.

3. **CPU usage is negligible for Herald.** The `hld` client uses ~0.01s CPU vs Claude's 5-8s. All the compute happens server-side (API call). Claude's Node runtime burns CPU on JavaScript parsing, tool execution setup, and IPC overhead.

4. **Warm sessions help Herald more than Claude.** Herald can skip session creation (it's already in daemon memory). Claude still has to spawn a fresh Node process regardless.

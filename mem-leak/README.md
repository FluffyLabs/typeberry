# fuzz-target memory-leak harnesses

Throwaway tooling to hunt memory leaks in the typeberry fuzz-target by driving
traces/blocks through the fuzz socket and diffing V8 heap snapshots. Not committed.

There are two heap-snapshot harnesses here, differing only in what they feed the
target:

| script           | input                                   | what it stresses |
|------------------|-----------------------------------------|------------------|
| `run.sh`         | one isolated `StateTransition` trace     | a single `Initialize`+`ImportBlock` looped `ITERATIONS` times (re-init every iter) |
| `run-blocks.sh`  | a concatenated dump of consecutive blocks| the whole block chain replayed `PASSES` times (re-init to genesis per pass) |

Both share `fuzz-client.ts` (the fuzz-proto v1 client; there's none in the repo)
and `lib.sh` (launch / wait / SIGUSR2 snapshot / cleanup).

## How they work

1. start `jam fuzz-target` as a real `node` process with V8's
   `--heapsnapshot-signal=SIGUSR2` wired up
2. warm it up so one-time lazy init (wasm, caches) is excluded from the baseline
3. take a **baseline** snapshot (the signal makes V8 run a full GC, then dump)
4. drive the load through the socket
5. take an **after** snapshot
6. shut the target down

Re-initialising amplifies leaks and also stresses `resetState` (close old node +
rebuild via `mainImporter`), not just the import path.

## run.sh (single trace)

```bash
./mem-leak/run.sh                              # 1000 iters, 5 warmup, tiny
ITERATIONS=2000 WARMUP=10 SPEC=tiny \
  TRACE=test-vectors-local/traces/00886505.bin ./mem-leak/run.sh
```

Uses `--init-genesis-from-ancestry`: the trace is a single isolated block, so the
importer must skip parent/state-root checks. The driver also asserts every import
returns the trace's `post_state` root. Snapshots -> `mem-leak/snapshots/`.

## run-blocks.sh (block dump, e.g. fallback.bin)

```bash
./mem-leak/run-blocks.sh                       # 50 passes, 1 warmup, tiny
PASSES=200 WARMUP=2 SPEC=tiny \
  BLOCKS=../typeberry-testing/block-dumps/fallback.bin \
  CHAINSPEC=../typeberry-testing/block-dumps/chain-spec.json \
  ./mem-leak/run-blocks.sh
```

These are real consecutive blocks rooted at genesis, so the target runs WITHOUT
`--init-genesis-from-ancestry` (full parent-hash + state-root verification). Genesis
header + state come from `chain-spec.json`; the blocks are stream-decoded from the
`.bin` (same framing as `node/reader.ts`). One pass = every block in order; total
imports = `PASSES * <#blocks>` (fallback.bin is slots #1..#100). Snapshots ->
`mem-leak/snapshots-blocks/`.

## Find the leak

Open `baseline.heapsnapshot` then `after.heapsnapshot` in Chrome DevTools -> Memory,
switch the after snapshot to **Comparison** (against baseline), sort by `# Delta` /
`# New`. Constructors whose delta scales with the load are suspects; use "Retainers"
to see what keeps them alive.

## Notes

- Both use the CLI `fuzz-target` path, not the `JAM_FUZZ` env path: the env path
  hardcodes `initGenesisFromAncestry=false` (see `bin/jam/fuzz-env.ts`), which the
  single-trace harness needs to be `true`. The CLI path lets each harness pick.
- In-memory DB (`default` config is tiny + in-memory) to keep disk noise out.
- A heap snapshot only ever explains the **JS heap** (`heapUsed`). If RSS climbs but
  the snapshot diff is flat, the growth is native / LMDB mmap / WASM linear memory.
  The sibling `fuzz-rss.sh` + `sampler.mjs` (Docker-based, RSS+heapUsed CSV over a
  real graymatter fuzz session) is the tool for that case -- check it first if you
  suspect off-heap growth.
```

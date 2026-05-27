# @typeberry/jam

Command-line interface for running a Typeberry JAM node.

## Usage

```bash
jam [options]
jam [options] dev <dev-validator-index>
jam [options] import <bin-or-json-blocks>
jam [options] export <output-directory-or-file>
jam [options] [--version=1] fuzz-target [socket-path=/tmp/jam_target.sock]
```

## Commands

### `jam` (default)

Run a JAM node in regular operation mode.

```bash
jam --name=my-node --config=default
```

### `jam dev <index>`

Run a JAM node in development mode as a validator. The `<index>` parameter determines the validator slot and automatically configures:
- Node name (e.g., `jam-1`, `jam-2`)
- Networking port (12346, 12347, etc.)
- Local bootnodes for a 5-validator dev network
- Block authoring capabilities

```bash
# Start first dev validator
jam dev 1

# Start second dev validator
jam dev 2
```

### `jam import <files...>`

Import blocks from one or more `.bin` or `.json` files into the node's database. The node will start, import the blocks, and then exit.

```bash
jam import blocks/block-1.bin blocks/block-2.bin
```

### `jam export <output>`

Export blocks from the node's database to the specified output directory or file.

```bash
jam export ./exported-blocks
```

### `jam fuzz-target [socket]`

Run the node as a fuzzing target, listening on the specified Unix socket path (defaults to `/tmp/jam_target.sock`).

```bash
jam --version=1 fuzz-target /tmp/custom_socket.sock
```

## Options

### `--name`

Override the node name. This affects the networking key derivation and database location.

Default: `jam`

```bash
jam --name=alice
```

### `--config`

Configuration directives for the node. Can be specified multiple times and are evaluated left to right.

A configuration directive can be:
- A path to a config file
- An inline JSON object
- A pseudo-jq query (subset of jq syntax for modifying config)
- One of the predefined configs: `dev`, `default`

Default: `default`

**Examples:**

```bash
# Use dev configuration
jam --config=dev

# Modify bootnodes in dev config (merge)
jam --config=dev --config=.chain_spec+={"bootnodes": []}

# Replace entire chain spec property
jam --config=dev --config=.chain_spec={"bootnodes": []}

# Merge JSON file onto chain spec
jam --config=dev --config=.chain_spec+=bootnodes.json

# Merge JSON object onto dev config
jam --config=dev --config={"chain_spec": {"bootnodes": []}}

# Merge contents of JSON file onto dev config
jam --config=dev --config=bootnodes.json

# Use custom config file
jam --config=custom-config.json
```

### `--pvm`

Select the PVM (Polkavm) backend to use. Available options: `wasmtime`, `interpreter`, `ananas`.

Default: `ananas`

```bash
jam --pvm=wasmtime
```

## Environment Variables

### `JAM_LOG`

Control logging output. Set to a comma-separated list of log filters.

```bash
JAM_LOG=trace jam dev 1
JAM_LOG=networking:debug,state:trace jam
```

### `JAM_FUZZ*` (Standard Target Packaging)

When `JAM_FUZZ` is set, the node starts in fuzz-target mode regardless of any
command-line arguments (passing CLI args alongside `JAM_FUZZ` is rejected).
This is the entrypoint expected by the
[JAM conformance fuzz target packaging](https://github.com/davxy/jam-conformance/tree/main/fuzz-proto#standard-target-packaging)
contract.

| Variable | Required | Purpose |
|----------|----------|---------|
| `JAM_FUZZ` | Yes (any non-empty value) | Activates fuzz mode. |
| `JAM_FUZZ_SPEC` | Yes | Chain spec: `tiny` or `full`. |
| `JAM_FUZZ_SOCK_PATH` | Yes | Unix domain socket path the target listens on. |
| `JAM_FUZZ_DATA_PATH` | No | Database location. A real path runs the target against the hybrid backend (in-memory leaves plus an on-disk LMDB value store, recommended for full-spec runs to bound memory). Unset, empty, or `undefined` keeps the fully in-memory database (the default). |
| `JAM_FUZZ_LOG_LEVEL` | No | Log verbosity: `error`, `warn`, `info`, `debug`, `trace`. Overrides `JAM_LOG` in fuzz mode. |

The target stays up across multiple fuzzer sessions; on each `Initialize`
message it resets the state to the genesis sent by the fuzzer. By default the
state is held entirely in memory. If `JAM_FUZZ_DATA_PATH` points at a real
directory, the target uses a hybrid backend instead (wiped on every reset, so
each session starts clean); if that store cannot be opened it logs a warning and
falls back to in-memory. The hybrid backend keeps the trie-leaf sets in memory
(so it still prunes at finality depth 10_000 to bound memory, like the in-memory
backend) but persists the large values to an on-disk LMDB store fronted by an
in-memory LRU cache. This keeps memory bounded while the large values live on
disk. Because leaf sets are pruned, the fuzzer can query the state of past
blocks only within the pruning window (roughly the last 20_000 blocks), not the
whole session.

**Docker example:**

```bash
docker run --rm \
  -e JAM_FUZZ=1 \
  -e JAM_FUZZ_SPEC=tiny \
  -e JAM_FUZZ_SOCK_PATH=/tmp/jam.sock \
  -e JAM_FUZZ_DATA_PATH=/tmp/jam-data \
  -v /tmp:/tmp \
  typeberry:latest
```

### OpenTelemetry Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `OTEL_ENABLED` | Enable/disable OpenTelemetry (set to `true` to enable) | `false` |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | URL to push metrics to | `http://localhost:9090/api/v1/otlp` |

**Example:**

```bash
# Telemetry is off by default.
jam dev 1

# Enable telemetry: metrics will be pushed to local prometheus with OTLP receiver.
OTEL_ENABLED=true jam dev 1
```

### Local Prometheus via Docker

To inspect metrics pushed over OTLP, start a Prometheus container with the OTLP receiver enabled:

```bash
docker run -d -p 9090:9090 --name=prometheus prom/prometheus \
  --config.file=/etc/prometheus/prometheus.yml \
  --web.enable-otlp-receiver
```

The default `OTEL_EXPORTER_OTLP_ENDPOINT` already points to the local instance, so run the node and open `http://localhost:9090` to explore the collected telemetry.

## Development

The `dev` command is designed for local testing with multiple validators:

```bash
# Terminal 1
jam dev 1

# Terminal 2
jam dev 2

# Terminal 3
jam dev 3
```

Each validator automatically discovers the others via local bootnodes and begins block production.

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

### OpenTelemetry Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `OTEL_ENABLED` | Enable/disable OpenTelemetry | `true` |
| `OTEL_PROMETHEUS_PORT` | Port for Prometheus metrics | `9464` |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | URL to push metrics to | (disabled) |

**Example:**

```bash
# Access Prometheus metrics at http://localhost:9464/metrics
jam dev 1

# Use custom Prometheus port
OTEL_PROMETHEUS_PORT=8080 jam dev 1

# Disable telemetry
OTEL_ENABLED=false jam dev 1
```

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

# @typeberry/rpc

JSON-RPC server for querying Typeberry node data.

Implements the [JIP-2 (JAM Improvement Proposal 2)](https://hackmd.io/@polkadot/jip2) specification.

## Overview

The RPC server provides a JSON-RPC 2.0 interface over WebSocket for querying blockchain data from a Typeberry node's database. It operates in read-only mode, connecting to an existing node's LMDB database to serve queries without affecting node operation.

## Usage

```bash
rpc [options]
```

The RPC server connects to an existing node's database and serves queries over WebSocket.

### Basic Example

```bash
# Connect to default node database
rpc

# Connect to a specific node's database
rpc --name=alice --config=dev

# Use custom port
rpc --port=8080
```

## Options

### `--port`

Port to listen on for WebSocket connections.

Default: `19800`

```bash
rpc --port=8080
```

### `--name`

The name of the node whose database you want to connect to. Must be an exact match for the database to load correctly.

Default: `jam`

```bash
rpc --name=alice
```

### `--config`

Configuration directive for the node whose database you want to connect to. Must match the config used when starting the node for the database path to be correct.

Default: `default`

```bash
rpc --config=dev
```

## Available RPC Methods

The following JSON-RPC methods are available according to the JIP-2 specification:

### Implemented Methods

- **`bestBlock`** - Returns the hash of the best block
- **`finalizedBlock`** - Returns the hash of the finalized block (currently returns best block)
- **`listServices`** - Lists all registered services
- **`parent`** - Returns the parent block hash for a given block
- **`serviceData`** - Retrieves service account data
- **`servicePreimage`** - Retrieves a preimage for a given hash
- **`serviceRequest`** - Retrieves service request data
- **`serviceValue`** - Retrieves service value by key
- **`stateRoot`** - Returns the state root hash
- **`statistics`** - Returns blockchain statistics

### Not Yet Implemented

- **`beefyRoot`** - Returns the BEEFY root (awaits Chapter 12)
- **`parameters`** - Returns chain parameters
- **`submitPreimage`** - Submits a preimage
- **`submitWorkPackage`** - Submits a work package

## Client Usage

### JavaScript/TypeScript

```javascript
import WebSocket from 'ws';

const ws = new WebSocket('ws://localhost:19800');

ws.on('open', () => {
  // Request best block
  ws.send(JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    method: 'bestBlock',
    params: []
  }));
});

ws.on('message', (data) => {
  const response = JSON.parse(data);
  console.log('Best block:', response.result);
});
```

### curl

```bash
# Using websocat (WebSocket curl alternative)
echo '{"jsonrpc":"2.0","id":1,"method":"bestBlock","params":[]}' | websocat ws://localhost:19800
```

## Example Queries

### Get Best Block

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "bestBlock",
  "params": []
}
```

### Get State Root

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "stateRoot",
  "params": ["0x...block_hash..."]
}
```

### List Services

```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "listServices",
  "params": ["0x...block_hash..."]
}
```

### Get Service Value

```json
{
  "jsonrpc": "2.0",
  "id": 4,
  "method": "serviceValue",
  "params": [
    "0x...block_hash...",
    42,
    "0x...key..."
  ]
}
```

## Running with a Node

The RPC server is designed to run alongside a JAM node:

```bash
# Terminal 1: Start the node
jam dev 1

# Terminal 2: Start the RPC server (connects to node's database)
rpc --name=jam-1 --config=dev
```

The RPC server operates in read-only mode and does not interfere with node operation.

## Connection Details

- **Protocol**: WebSocket (JSON-RPC 2.0)
- **Default Port**: 19800
- **Default Host**: 0.0.0.0 (listens on all interfaces)
- **Database Access**: Read-only LMDB connection

## Error Handling

The server returns standard JSON-RPC 2.0 error responses:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "error": {
    "code": -32601,
    "message": "Method not found"
  }
}
```

Common error codes:
- `-32700` - Parse error
- `-32600` - Invalid request
- `-32601` - Method not found
- `-32602` - Invalid params
- `-32603` - Internal error

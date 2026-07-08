# @typeberry/rpc

JSON-RPC server for querying Typeberry node data.

Implements the [JIP-2](https://github.com/polkadot-fellows/JIPs/blob/main/JIP-2.md) specification.

## Overview

The RPC server provides a JSON-RPC 2.0 interface over WebSocket for querying blockchain data. It runs in-process with the JAM node, sharing the database handle (fjall) and is configured via the node's config file.

## Configuration

Add an `rpc` section to the node config JSON to enable the RPC server:

```json
{
  "rpc": {
    "port": 19800
  }
}
```

Omit the `rpc` key to disable the RPC server.

In dev mode (`jam dev <index>`), the port is shifted by the validator index (e.g. `jam dev 1` listens on 19801, `jam dev 2` on 19802).

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

### websocat

```bash
echo '{"jsonrpc":"2.0","id":1,"method":"bestBlock","params":[]}' | websocat ws://localhost:19800
```

## Connection Details

- **Protocol**: WebSocket (JSON-RPC 2.0)
- **Default Port**: 19800
- **Default Host**: 0.0.0.0 (listens on all interfaces)
- **Database Access**: Read-only (shared in-process handle)

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

# @typeberry/lib

Convenience package providing unified access to all Typeberry core packages.

## Overview

`@typeberry/lib` is a meta-package that re-exports all Typeberry modules under namespaced identifiers. This simplifies imports when working with multiple Typeberry packages and ensures version compatibility across the entire stack.

## Usage

### Installation

```bash
npm install @typeberry/lib
```

### Importing

Instead of installing and importing individual packages:

```typescript
// Without @typeberry/lib
import { Blake2b } from "@typeberry/hash";
import { Codec } from "@typeberry/codec";
import { ed25519 } from "@typeberry/crypto";
```

You can import everything from a single package:

```typescript
// With @typeberry/lib
import { hash, codec, crypto } from "@typeberry/lib";

const blake2b = await hash.Blake2b.createHasher();
const descriptor = codec.Codec.from(schema);
const keypair = await crypto.ed25519.generateKeypair();
```

### Available Modules

The following modules are available as namespaced exports:

- `block` - Block structures and types
- `block_json` - JSON serialization for blocks
- `bytes` - Byte array utilities
- `codec` - SCALE codec implementation
- `collections` - Specialized data structures
- `config` - Configuration types
- `config_node` - Node configuration utilities
- `crypto` - Cryptographic primitives (Ed25519, Sr25519, BLS)
- `database` - Database abstractions
- `erasure_coding` - Erasure coding implementation
- `fuzz_proto` - Fuzzing protocol support
- `hash` - Hashing functions (Blake2b, etc.)
- `jam_host_calls` - JAM-specific host calls
- `json_parser` - JSON parsing utilities
- `logger` - Logging framework
- `mmr` - Merkle Mountain Range implementation
- `numbers` - Fixed-size numeric types
- `ordering` - Ordering and comparison utilities
- `pvm` - PVM debugger adapter
- `pvm_host_calls` - PVM host call implementations
- `pvm_interpreter` - PVM bytecode interpreter
- `pvm_program` - PVM program utilities
- `pvm_spi_decoder` - Standard PVM Interface decoder
- `shuffling` - Shuffling algorithms
- `state` - State management
- `state_json` - JSON serialization for state
- `state_merkleization` - State Merkleization
- `state_vectors` - State test vectors
- `transition` - State transition functions
- `trie` - Trie data structures
- `utils` - General utilities

## Examples

### Working with State and Crypto

```typescript
import { state, crypto, hash } from "@typeberry/lib";

const blake2b = await hash.Blake2b.createHasher();
const stateRoot = await state.calculateStateRoot(stateData, blake2b);
const signature = await crypto.ed25519.sign(message, secretKey);
```

### Encoding and Decoding

```typescript
import { codec, bytes } from "@typeberry/lib";

const descriptor = codec.Codec.from(schema);
const encoded = descriptor.encode(data);
const decoded = descriptor.decode(encoded);
```

### PVM Operations

```typescript
import { pvm_interpreter, pvm_program, pvm_host_calls } from "@typeberry/lib";

const program = pvm_program.PvmProgram.from(bytecode);
const interpreter = new pvm_interpreter.Interpreter(program, hostCalls);
const result = interpreter.run();
```

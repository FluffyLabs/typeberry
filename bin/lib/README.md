# @typeberry/lib

Convenience package providing unified access to all Typeberry core packages.

## Overview

`@typeberry/lib` is a meta-package that re-exports all Typeberry modules through subpath imports. This simplifies imports when working with multiple Typeberry packages and ensures version compatibility across the entire stack.

All imports use the pattern `@typeberry/lib/<module>` to access individual packages with full ESM and CommonJS support.

## Usage

### Installation

```bash
npm install @typeberry/lib
```

### Importing

Instead of installing and importing individual packages:

```typescript
// Without @typeberry/lib - requires installing each package separately
import { Blake2b } from "@typeberry/hash";
import { Encoder } from "@typeberry/codec";
import { ed25519 } from "@typeberry/crypto";
```

Import directly from `@typeberry/lib` using subpath imports:

```typescript
// With @typeberry/lib - single package installation
import { Blake2b } from "@typeberry/lib/hash";
import { Encoder } from "@typeberry/lib/codec";
import { ed25519 } from "@typeberry/lib/crypto";

const blake2b = await Blake2b.createHasher();
const encoded = Encoder.encodeObject(schema, value);
const keypair = await ed25519.generateKeypair();
```

### Available Modules

The following modules are available as subpath imports (e.g., `@typeberry/lib/block`):

- `block` - Block structures and types
- `block-json` - JSON serialization for blocks
- `bytes` - Byte array utilities
- `codec` - JAM/GP codec implementation
- `collections` - Specialized data structures
- `config` - Configuration types
- `config-node` - Node configuration utilities
- `crypto` - Cryptographic primitives (Ed25519, Sr25519, BLS)
- `database` - Database abstractions
- `erasure-coding` - Erasure coding implementation
- `fuzz-proto` - Fuzzing protocol support
- `hash` - Hashing functions (Blake2b, etc.)
- `importer` - Typeberry importer utilities
- `jam-host-calls` - JAM-specific host calls
- `json-parser` - JSON parsing utilities
- `logger` - Logging framework
- `mmr` - Merkle Mountain Range implementation
- `numbers` - Fixed-size numeric types
- `ordering` - Ordering and comparison utilities
- `pvm-host-calls` - PVM host call implementations
- `pvm-interface` - PVM interface and program utilities
- `pvm-interpreter` - PVM bytecode interpreter
- `shuffling` - Shuffling algorithms
- `state` - State management
- `state-json` - JSON serialization for state
- `state-merkleization` - State Merkleization
- `state-vectors` - State test vectors
- `transition` - State transition functions
- `trie` - Trie data structures
- `utils` - General utilities
- `workers-api` - Workers API utilities

## Examples

All examples below are extracted from actual test files in `examples/` directory, ensuring they compile and work correctly.

### Basic Import

<!-- example-code:basic-import -->
```typescript
import { Blake2b } from "@typeberry/lib/hash";
import { codec } from "@typeberry/lib/codec";
import { BytesBlob, Bytes } from "@typeberry/lib/bytes";
import { tryAsU8 } from "@typeberry/lib/numbers";

// Import from @typeberry/lib using subpath imports

// All imports work with both ESM and CommonJS
assert.ok(Blake2b);
assert.ok(codec);
assert.ok(BytesBlob);
assert.ok(Bytes);
assert.ok(tryAsU8);
```
<!-- /example-code:basic-import -->

### Working with Numbers

<!-- example-code:numbers -->
```typescript
import { tryAsU8, tryAsU32, isU8 } from "@typeberry/lib/numbers";

// Create typed numbers
const smallNumber = tryAsU8(42);
const largeNumber = tryAsU32(1000000);

// Type checking
assert.ok(isU8(42));
assert.strictEqual(smallNumber, 42);
assert.strictEqual(largeNumber, 1000000);
```
<!-- /example-code:numbers -->

### Hashing with Blake2b

<!-- example-code:hash-blake2b -->
```typescript
import { Blake2b } from "@typeberry/lib/hash";

// Create a Blake2b hasher
const hasher = await Blake2b.createHasher();

// Hash some data
const data = new Uint8Array([1, 2, 3, 4, 5]);
const hash = hasher.hashBytes(data);

// hash is a 32-byte Blake2b hash
assert.strictEqual(hash.length, 32);
```
<!-- /example-code:hash-blake2b -->

### Hashing a String

<!-- example-code:hash-string -->
```typescript
import { Blake2b } from "@typeberry/lib/hash";

const hasher = await Blake2b.createHasher();

// Hash a string directly
const hash = hasher.hashString("Hello, world!");

// Returns a 32-byte hash
assert.strictEqual(hash.length, 32);
```
<!-- /example-code:hash-string -->

### Hashing Multiple Blobs

<!-- example-code:hash-multiple -->
```typescript
import { Blake2b } from "@typeberry/lib/hash";

const hasher = await Blake2b.createHasher();

// Hash multiple byte arrays together
const data1 = new Uint8Array([1, 2, 3]);
const data2 = new Uint8Array([4, 5, 6]);
const hash = hasher.hashBlobs([data1, data2]);

// Returns a single hash of all inputs
assert.strictEqual(hash.length, 32);
```
<!-- /example-code:hash-multiple -->

### Bytes - Parsing Hex Strings

<!-- example-code:bytes-parsing -->
```typescript
import { BytesBlob } from "@typeberry/lib/bytes";

// Parse hex string with 0x prefix
const hexString = "0x48656c6c6f";
const bytes = BytesBlob.parseBlob(hexString);

// Convert to regular Uint8Array
const data = bytes.raw;

// Verify the data
const text = new TextDecoder().decode(data);
assert.strictEqual(text, "Hello");
```
<!-- /example-code:bytes-parsing -->

### Bytes - Concatenation

<!-- example-code:bytes-concat -->
```typescript
import { BytesBlob } from "@typeberry/lib/bytes";

const bytes1 = new Uint8Array([1, 2, 3]);
const bytes2 = new Uint8Array([4, 5, 6]);

// Concatenate byte arrays
const combined = BytesBlob.blobFromParts([bytes1, bytes2]);

assert.deepStrictEqual(combined.raw, new Uint8Array([1, 2, 3, 4, 5, 6]));
```
<!-- /example-code:bytes-concat -->

### Bytes - Creating Bytes

<!-- example-code:bytes-create -->
```typescript
import { Bytes } from "@typeberry/lib/bytes";

// Create fixed-size bytes
const data = Bytes.fill(32, 0x42);

assert.strictEqual(data.length, 32);
assert.strictEqual(data.raw[0], 0x42);
```
<!-- /example-code:bytes-create -->

### JAM/GP Codec - Basic Usage

<!-- example-code:codec-basic -->
```typescript
import { codec, Encoder, Decoder } from "@typeberry/lib/codec";
import { Bytes } from "@typeberry/lib/bytes";

// Define a schema for fixed-size bytes
const hashSchema = codec.bytes(32);

// Create test data

const testHash = Bytes.fill(32, 0x42);

// Encode data
const encoded = Encoder.encodeObject(hashSchema, testHash);

// Decode data
const decoded = Decoder.decodeObject(hashSchema, encoded);

assert.deepStrictEqual(decoded, testHash);
```
<!-- /example-code:codec-basic -->

### PVM Interpreter - Basic Usage

<!-- example-code:pvm-basic -->
```typescript
import { Interpreter } from "@typeberry/lib/pvm-interpreter";
import { tryAsGas } from "@typeberry/lib/pvm-interface";
import { BytesBlob } from "@typeberry/lib/bytes";

// Load a PVM program from hex (SCALE-encoded program)
const programHex =
  "0x0000210408010409010503000277ff07070c528a08980852a905f3528704080409111300499352d500";
const program = BytesBlob.parseBlob(programHex);

// Create interpreter and initialize with program
const pvm = new Interpreter();
pvm.resetGeneric(program.raw, 0, tryAsGas(1000));

// Run the program
pvm.runProgram();

// Program executed successfully (no exceptions thrown)
assert.ok(true);
```
<!-- /example-code:pvm-basic -->

### PVM Interpreter - Accessing Registers

<!-- example-code:pvm-registers -->
```typescript
import { Interpreter } from "@typeberry/lib/pvm-interpreter";
import { tryAsGas } from "@typeberry/lib/pvm-interface";
import { BytesBlob } from "@typeberry/lib/bytes";

const programHex =
  "0x0000210408010409010503000277ff07070c528a08980852a905f3528704080409111300499352d500";
const program = BytesBlob.parseBlob(programHex);

const pvm = new Interpreter();
pvm.resetGeneric(program.raw, 0, tryAsGas(1000));
pvm.runProgram();

// Access register values after execution
const reg0 = pvm.registers.getU64(0);

// Registers contain BigInt values
assert.strictEqual(typeof reg0, "bigint");
```
<!-- /example-code:pvm-registers -->

### PVM Interpreter - Gas Tracking

<!-- example-code:pvm-gas -->
```typescript
import { Interpreter } from "@typeberry/lib/pvm-interpreter";
import { tryAsGas } from "@typeberry/lib/pvm-interface";
import { BytesBlob } from "@typeberry/lib/bytes";

const programHex =
  "0x0000210408010409010503000277ff07070c528a08980852a905f3528704080409111300499352d500";
const program = BytesBlob.parseBlob(programHex);

const initialGas = tryAsGas(1000);
const pvm = new Interpreter();
pvm.resetGeneric(program.raw, 0, initialGas);
pvm.runProgram();

// Check remaining gas after execution
const remainingGas = pvm.gas.get();

// Gas should have been consumed
assert.ok(remainingGas < initialGas);
```
<!-- /example-code:pvm-gas -->

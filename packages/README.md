# Packages Directory

This directory contains all the modular packages that make up the Typeberry project. Each package is independently versioned and can be published to npm under the `@typeberry` scope.

## Directory Structure

### `core/`
Contains fundamental packages that provide low-level functionality and utilities used throughout the project:

- **bytes** - Byte manipulation utilities
- **codec** - Encoding/decoding functionality
- **collections** - Data structure utilities
- **crypto** - Cryptographic functions and utilities
- **erasure-coding** - Error correction and erasure coding
- **hash** - Hashing algorithms and utilities
- **json-parser** - JSON parsing functionality
- **logger** - Basic logging utilities
- **mmr** - Merkle Mountain Range implementation
- **networking** - Network-related utilities
- **numbers** - Number handling and manipulation
- **ordering** - Ordering and sorting utilities
- **pvm-debugger-adapter** - PVM debugger adapter
- **pvm-host-calls** - PVM host call implementations
- **pvm-interpreter** - PVM interpreter functionality
- **pvm-program** - PVM program utilities
- **pvm-spi-decoder** - PVM SPI decoder
- **shuffling** - Shuffling algorithms
- **state-machine** - State machine implementations
- **trie** - Trie data structure implementation
- **utils** - General purpose utilities

### `jam/`
Contains JAM (Join-Accumulate Machine) specific packages:

- **block** - JAM block definitions and utilities
- **block-json** - JSON serialization for JAM blocks
- **config** - JAM configuration handling
- **config-node** - Node-specific JAM configuration
- **database** - Database abstractions for JAM
- **database-lmdb** - LMDB database implementation
- **jam-host-calls** - JAM-specific host calls
- **jamnp-s** - JAM network protocol implementation
- **node** - JAM node implementation
- **safrole** - Safrole consensus mechanism
- **state** - JAM state management
- **state-json** - JSON serialization for JAM state
- **state-merkleization** - State merkleization utilities
- **transition** - State transition logic

### `configs/`
Pre-defined JSON configuration files and schemas:

- Configuration schemas (`.schema.json` files)
- Environment-specific configurations (dev, production, etc.)
- Default configuration templates

### `extensions/`
Typeberry extension packages that are not strictly required
for the JAM client to work, yet might add some extra functionality:

- **ipc** - Inter-process communication extensions

### `workers/`
Worker-related packages for background processing:

- **block-generator** - Block generation worker
- **generic** - Generic worker utilities
- **importer** - Data import worker
- **jam-network** - JAM network worker

### `misc/`
Miscellaneous utilities and tools:

- **benchmark** - Benchmarking tools
- **builder** - Build utilities

## Adding New Packages

When adding a new package:

1. **Choose the right directory**: Place it in the most appropriate top-level directory based on its purpose
2. **Follow naming conventions**: Use kebab-case for directory names
3. **Include package.json**: Each package should have its own `package.json` with proper metadata
4. **Use @typeberry scope**: Package names should use the `@typeberry/` npm scope
5. **Add dependencies**: Reference other packages using the `@typeberry/` scope and "*" version for local packages

## Package Organization Guidelines

- **Core packages** should be framework-agnostic and provide fundamental functionality
- **JAM packages** contain JAM-specific implementations and logic, builds on core.
- **Extensions** add optional functionality that builds on core or jam packages
- **Workers** contain background processing and worker-specific code
- **Configs** store configuration files and schemas
- **Misc** contains development tools and utilities that don't fit elsewhere

# typeberry 🫐

[![JAM Conformance 0.7.1](https://github.com/FluffyLabs/typeberry/actions/workflows/vectors-jam-conformance-071.yml/badge.svg?branch=main)](https://github.com/FluffyLabs/typeberry/actions/workflows/vectors-jam-conformance-071.yml) [![W3F davxy 0.7.1](https://github.com/FluffyLabs/typeberry/actions/workflows/vectors-w3f-davxy-071.yml/badge.svg?branch=main)](https://github.com/FluffyLabs/typeberry/actions/workflows/vectors-w3f-davxy-071.yml) [![W3F vectors](https://github.com/FluffyLabs/typeberry/actions/workflows/vectors-w3f.yml/badge.svg?branch=main)](https://github.com/FluffyLabs/typeberry/actions/workflows/vectors-w3f.yml) [![Publish commits](https://github.com/FluffyLabs/typeberry/actions/workflows/prize-blockchain.yml/badge.svg?branch=main)](https://github.com/FluffyLabs/typeberry/actions/workflows/prize-blockchain.yml) [![License: MPL 2.0](https://img.shields.io/badge/License-MPL%202.0-brightgreen.svg)](https://opensource.org/licenses/MPL-2.0)

Typeberry is a TypeScript implementation of [JAM protocol](https://graypaper.com/) by Fluffy Labs.

**NOTE: Since we are taking part in the JAM Prize, we do not accept any external
PRs unless the contributor waives any claims to the prize and copy rights for
the submitted code. By creating the PR you accept this requirement.**

## Links

- [Documentation](https://fluffylabs.dev/typeberry)
- [Performance Charts](https://typeberry.fluffylabs.dev)

## Implementation status

Gray Paper compliance can be controlled via `GP_VERSION` environment variable.

- [x] 0.6.7
- [x] 0.7.0
- [x] 0.7.1
- [x] 0.7.2

JAM Prize requirements

- [x] Milestone 1
    - [x] Block import
    - [x] W3F test vectors
    - [x] JAM Conformance Fuzzer
    - [x] Performance optimisations
- [ ] Milestone 2
    - [x] Networking (partial)
    - [x] Fast PVM (ananas)
- [ ] Milestone 3
    - [ ] PVM Recompiler
- [ ] Milestone 4
- [ ] Milestone 5

## Requirements

```bash
$ node --version
v 22.9.0
```

We recommend [NVM](https://github.com/nvm-sh/nvm) to install and manage different
`node` versions.

### Installing dependencies

```bash
$ npm ci
```

### Running typeberry

```bash
$ npm start
```

### Running fuzz-target

```bash
$ npm start -- fuzz-target
```

### Running with Docker

Build and run typeberry using Docker:

```bash
# Build the Docker image
$ docker build -t typeberry .

# Run with default settings
$ docker run typeberry

# Run with custom arguments
$ docker run typeberry --config /app/configs/typeberry-dev.json --node-name my-node

# Run with environment variables (e.g., for logging)
$ docker run -e JAM_LOG=trace GP_VERSION=0.7.2 typeberry

# Run with volume mounts for persistent data
$ docker run -v $(pwd)/database:/app/database typeberry
```

The Docker container uses a minimal Alpine Linux image and forwards all arguments to `npm start`.

### Running the JSON RPC

JSON-RPC does not require `typeberry` to be running, so we just need to point the binary to the correct database.

Note the DB needs to be already initialized.

```bash
$ npm start -w @typeberry/rpc 
```

### Additional tooling

- [@typeberry/convert](bin/convert/README.md) - convert common JAM formats
- [@typeberry/jam](bin/jam/README.md) - main typeberry/jam node binary
- [@typeberry/lib](bin/lib/README.md) - typeberry-as-library. All utilities exposed as ESM, browser-compatible
    library.
- [JAM search](https://github.com/fluffylabs/jam-search) - search across all public JAM-related channels
- [State Viewer](https://github.com/fluffylabs/state-viewer) - load & inspect state of test vectors
- [PVM Debugger](https://github.com/fluffylabs/pvm-debugger) - load & inspect a PVM program
- [Gray Paper Reader](https://github.com/fluffylabs/graypaper-reader) - view the Gray Paper
- [Ananas](https://github.com/tomusdrw/anan-as) - AssemblyScript PVM interpreter

### Formatting & linting

```bash
$ npm run qa
```

Formatting & linting is done by [biomejs](https://biomejs.dev/)). You can run
separate tools using commands below.
Note that all safe fixes will be applied automatically.

```bash
$ npm run format # format the code
$ npm run lint   # lint the code & organise imports
```

A shorthand to run all the checks and apply safe fixes all at once is:
```bash
$ npm run qa-fix
```

### Running unit tests

```bash
$ npm run test
```

Running tests from a single package:
```bash
$ npm run test -w @typeberry/trie
```

### Running benchmarks
This command will run all benchmarks from `./benchmarks/` folder

```bash
$ npm start -w @typeberry/benchmark
```

Since each benchmark file is also runnable, it's easy to run just one benchmark, e.g:
```bash
$ npm exec tsx ./benchmarks/math/mul_overflow.ts
```

### Running JSON test vectors

To run JSON test cases coming from the official
[JAM test vectors repository](https://github.com/w3f/jamtestvectors/) you need
to first check out the repository with test cases and then use `test-runner`
to execute them.

```bash
$ git clone https://github.com/w3f/jamtestvectors.git
$ npm run w3f -w @typeberry/test-runner  --  jamtestvectors/**/*.json ../jamtestvectors/erasure_coding/vectors/*
```

Since there are multiple sources of test vectors (and their versions may differ),
all relevant ones can be easily checked out from [our test vectors repository](https://github.com/FluffyLabs/test-vectors).

Obviously it's also possible to run just single test case or part of the test
cases by altering the glob pattern in the path.

#### Selecting PVM Backend

By default, test vectors are run with both PVM backends (built-in and Ananas).
You can select a specific PVM backend using the `--pvm` option:

```bash
# Run tests with built-in PVM only
$ npm run w3f-davxy:0.7.1 -w @typeberry/test-runner -- --pvm builtin

# Run tests with Ananas PVM only
$ npm run w3f-davxy:0.7.1 -w @typeberry/test-runner -- --pvm ananas

# Run tests with both PVMs (default)
$ npm run w3f-davxy:0.7.1 -w @typeberry/test-runner
```

This option is useful for debugging PVM-specific issues or running faster tests
by testing only one implementation at a time.

### Running JSON RPC E2E tests

To run JSON RPC E2E test-vectors [test-vectors](https://github.com/fluffylabs/test-vectors) 
repository needs to be checked out with ref matching our tests. Then to run tests:

```bash
$ npm run test:e2e -w @typeberry/rpc
```

### Adding a new component / package

```bash
$ npm init -w ./packages/core/mycomponent
$ npm init -w ./packages/jam/mycomponent
```

This command will automatically update the `workspaces` field in top-level `package.json`.

## Codestyle

A brief, but evolving description of our codestyle and guideliness is availabe
in [CODESTYLE](./CODESTYLE.md).

## Add Typeberry's remote notes to Gray Paper Reader

1. Open **Gray Paper Reader** and go to **Notes** > **Settings** (⚙️).<br/>
![gpr-source-notes-1](https://github.com/user-attachments/assets/945152f4-a8f1-4167-af86-9c1e41102615)
2. Click **"+ New Source"**.
![gpr-source-notes-2](https://github.com/user-attachments/assets/7356dbe3-fa05-4fcb-99c3-28cb4b9553df)
3. Set **Source Name** to **Typeberry**.
4. Paste the following in **Source URL:**
```
https://fluffylabs.dev/typeberry/links.json
```
5. Select **All Versions**.
![gpr-source-notes-3](https://github.com/user-attachments/assets/877a6494-75fd-4c0c-b531-55af6f676c89)
6. Click **OK**.
7. Ensure the ✅ next to **Typeberry** is enabled.

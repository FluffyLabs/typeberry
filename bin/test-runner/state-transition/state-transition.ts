import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import type { TestContext } from "node:test";
import { Block, emptyBlock, Header } from "@typeberry/block";
import { blockFromJson, headerFromJson } from "@typeberry/block-json";
import { codec, Decoder, Encoder } from "@typeberry/codec";
import { ChainSpec, PvmBackend, tinyChainSpec } from "@typeberry/config";
import { InMemoryBlocks } from "@typeberry/database";
import { Blake2b, keccak, WithHash } from "@typeberry/hash";
import type { FromJson } from "@typeberry/json-parser";
import { tryAsU32 } from "@typeberry/numbers";
import { serializeStateUpdate } from "@typeberry/state-merkleization";
import { TransitionHasher } from "@typeberry/transition";
import { BlockVerifier } from "@typeberry/transition/block-verifier.js";
import { OnChain } from "@typeberry/transition/chain-stf.js";
import { deepEqual, resultToString } from "@typeberry/utils";
import { loadState, TestState } from "./state-loader.js";

export class StateTransitionGenesis {
  static fromJson: FromJson<StateTransitionGenesis> = {
    header: headerFromJson,
    state: TestState.fromJson,
  };

  static Codec = codec.object({
    header: Header.Codec,
    state: TestState.Codec,
  });

  header!: Header;
  state!: TestState;
}

export class StateTransition {
  static fromJson: FromJson<StateTransition> = {
    pre_state: TestState.fromJson,
    post_state: TestState.fromJson,
    block: blockFromJson(tinyChainSpec),
  };

  static Codec = codec.object({
    pre_state: TestState.Codec,
    block: Block.Codec,
    post_state: TestState.Codec,
  });

  pre_state!: TestState;
  post_state!: TestState;
  block!: Block;
}

const keccakHasher = keccak.KeccakHasher.create();

const cachedBlocks = new Map<string, Block[]>();
function loadBlocks(testPath: string, spec: ChainSpec) {
  const dir = path.dirname(testPath);
  const fromCache = cachedBlocks.get(dir);
  if (fromCache !== undefined) {
    return fromCache;
  }

  const blocks: Block[] = [];
  for (const file of fs.readdirSync(dir)) {
    if (!file.endsWith(".bin")) {
      continue;
    }
    const data = fs.readFileSync(path.join(dir, file));
    try {
      if (file.endsWith("genesis.bin")) {
        const genesis = Decoder.decodeObject(StateTransitionGenesis.Codec, data, spec);
        const genesisBlock = Block.create({ header: genesis.header, extrinsic: emptyBlock().extrinsic });
        blocks.push(genesisBlock);
      } else {
        const block = Decoder.decodeObject(Block.Codec, data, spec);
        blocks.push(block);
      }
    } catch {
      // some blocks might be invalid, but that's fine. We just ignore them.
    }
  }

  blocks.sort((a, b) => a.header.timeSlotIndex - b.header.timeSlotIndex);
  cachedBlocks.set(dir, blocks);
  return blocks;
}

function blockAsView(spec: ChainSpec, block: Block) {
  const encodedBlock = Encoder.encodeObject(Block.Codec, block, spec);
  const blockView = Decoder.decodeObject(Block.Codec.View, encodedBlock, spec);
  return blockView;
}

// A special chain spec, just for some conformance 0.7.0 tests
// that were run pre-V1 fuzzer version.
const jamConformance070V0Spec = new ChainSpec({
  ...tinyChainSpec,
  maxLookupAnchorAge: tryAsU32(14_400),
});

export async function runStateTransition(
  testContent: StateTransition,
  testPath: string,
  t: TestContext,
  chainSpec: ChainSpec,
) {
  const blake2b = await Blake2b.createHasher();
  // a bit of a hack, but the new value for `maxLookupAnchorAge` was proposed with V1
  // version of the fuzzer, yet these tests were still depending on the older value.
  // To simplify the chain spec, we just special case this one vector here.
  const spec = testPath.includes("fuzz-reports/0.7.0/traces/1756548916/00000082.json")
    ? jamConformance070V0Spec
    : chainSpec;
  const preState = loadState(spec, blake2b, testContent.pre_state.keyvals);
  const postState = loadState(spec, blake2b, testContent.post_state.keyvals);

  const preStateRoot = preState.backend.getRootHash(blake2b);
  const postStateRoot = postState.backend.getRootHash(blake2b);

  const blockView = blockAsView(spec, testContent.block);
  const allBlocks = loadBlocks(testPath, spec);
  const myBlockIndex = allBlocks.findIndex(
    ({ header }) => header.timeSlotIndex === testContent.block.header.timeSlotIndex,
  );
  const previousBlocks = allBlocks.slice(0, myBlockIndex);

  const hasher = new TransitionHasher(spec, await keccakHasher, blake2b);

  const blocksDb = InMemoryBlocks.fromBlocks(
    previousBlocks.map((block) => {
      const blockView = blockAsView(spec, block);
      const headerHash = hasher.header(blockView.header.view());
      return new WithHash(headerHash.hash, blockView);
    }),
  );

  const stf = new OnChain(spec, preState, blocksDb, hasher, PvmBackend.BuiltIn);

  // verify that we compute the state root exactly the same.
  assert.deepStrictEqual(testContent.pre_state.state_root.toString(), preStateRoot.toString());
  assert.deepStrictEqual(testContent.post_state.state_root.toString(), postStateRoot.toString());

  const shouldBlockBeRejected = testContent.pre_state.state_root.isEqualTo(testContent.post_state.state_root);

  const verifier = new BlockVerifier(stf.hasher, blocksDb);
  // NOTE [ToDr] we skip full verification here, since we can run tests in isolation
  // (i.e. no block history)
  const headerHash = verifier.hashHeader(blockView);

  // now perform the state transition
  const stfResult = await stf.transition(blockView, headerHash.hash);
  if (shouldBlockBeRejected) {
    assert.strictEqual(stfResult.isOk, false, "The block should be rejected, yet we imported it.");
    // there should be no changes.
    const root = preState.backend.getRootHash(blake2b);
    deepEqual(preState, postState);
    assert.deepStrictEqual(root.toString(), postStateRoot.toString());
    return;
  }

  if (stfResult.isError) {
    assert.fail(`Expected the transition to go smoothly, got error: ${resultToString(stfResult)}`);
  }

  preState.backend.applyUpdate(serializeStateUpdate(spec, blake2b, stfResult.ok));

  // some conformance test vectors have an empty state, we run them, yet do not perform any assertions.
  if (testContent.post_state.keyvals.length === 0) {
    t.skip(`Successfuly run a test vector with empty post state!. Please verify: ${testPath}`);
    return;
  }

  // if the stf was successful compare the resulting state and the root (redundant, but double checking).
  const root = preState.backend.getRootHash(blake2b);
  deepEqual(preState, postState);
  assert.deepStrictEqual(root.toString(), postStateRoot.toString());
}

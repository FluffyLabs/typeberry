import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { Block, type BlockView } from "@typeberry/block";
import { blockFromJson } from "@typeberry/block-json";
import { Decoder, Encoder } from "@typeberry/codec";
import { type ChainSpec, tinyChainSpec } from "@typeberry/config";
import { LmdbBlocks, LmdbRoot, LmdbStates } from "@typeberry/database-lmdb";
import { SimpleAllocator, WithHash, keccak } from "@typeberry/hash";
import { type FromJson, parseFromJson } from "@typeberry/json-parser";
import { TransitionHasher } from "@typeberry/transition";
import { BlockVerifier } from "@typeberry/transition/block-verifier.js";
import { OnChain } from "@typeberry/transition/chain-stf.js";
import { TestState, loadState } from "./state-loader.js";

const CURRENT_FLAVOR = tinyChainSpec;

export class StateTransition {
  static fromJson: FromJson<StateTransition> = {
    pre_state: TestState.fromJson,
    post_state: TestState.fromJson,
    block: blockFromJson(CURRENT_FLAVOR),
  };
  pre_state!: TestState;
  post_state!: TestState;
  block!: Block;
}

const keccakHasher = keccak.KeccakHasher.create();
const cachedBlocks = new Map<string, Block[]>();

export function createDb(name: string, testDdPath: string, { readOnly = false }: { readOnly?: boolean } = {}) {
  const dbPath = `${testDdPath}/${name}`;

  return {
    dbPath,
    rootDb: new LmdbRoot(dbPath, readOnly),
  };
}

export async function initDb(_spec: ChainSpec, _rootDb: LmdbRoot) {
  // TODO: [MaSo] write init db logic
}

export function loadBlocks(blockPath: string): Block[] {
  const dir = path.dirname(blockPath);
  const cachedBlock = cachedBlocks.get(dir);
  if (cachedBlock !== undefined) {
    return cachedBlock;
  }

  const blocks: Block[] = [];
  for (const file of fs.readdirSync(dir)) {
    if (!file.endsWith(".json")) {
      continue;
    }
    const data = fs.readFileSync(path.join(dir, file), "utf8");
    const parsed = JSON.parse(data);
    const st = parseFromJson(parsed, StateTransition.fromJson);
    blocks.push(st.block);
  }

  blocks.sort((a, b) => a.header.timeSlotIndex - b.header.timeSlotIndex);
  cachedBlocks.set(dir, blocks);
  return blocks;
}

function blockToView(block: Block, spec: ChainSpec): BlockView {
  return Decoder.decodeObject(Block.Codec.View, Encoder.encodeObject(Block.Codec, block, spec), spec);
}

export async function importBlocks(
  blocks: Block[],
  stf: OnChain,
  blocksDb: LmdbBlocks,
  statesDb: LmdbStates,
  verifier: BlockVerifier,
) {
  for (const block of blocks) {
    const blockView = blockToView(block, CURRENT_FLAVOR);
    const verify = await verifier.verifyBlock(blockView);
    if (verify.isError) {
      assert.fail(`Expected block to be valid: [${verify.error}] ${verify.details}`);
    }
    const hash = verify.ok;
    const stfResult = await stf.transition(blockView, hash);
    if (stfResult.isError) {
      assert.fail(`Expected stf to go smoothly: [${stfResult.error}] ${stfResult.details}`);
    }
    const update = stfResult.ok;
    const bestHeader = blocksDb.getBestHeaderHash();
    const state = statesDb.getState(bestHeader);
    if (state === null) {
      assert.fail(`Unable to load best state from header: ${bestHeader}`);
    }
    const updateResult = await statesDb.updateAndSetState(hash, state, update);
    if (updateResult.isError) {
      assert.fail(`Unable to update state: [${updateResult.error}] ${updateResult.details}`);
    }
    const newState = statesDb.getState(hash);
    if (newState === null) {
      assert.fail(`State not updated for hash: ${hash}`);
    }
    state.updateBackend(newState.backend);
    const writeBlocks = blocksDb.insertBlock(new WithHash(hash, blockView));

    const stateRoot = await statesDb.getStateRoot(newState);
    const writeStateRoot = blocksDb.setPostStateRoot(hash, stateRoot);

    await Promise.all([writeBlocks, writeStateRoot]);
    await blocksDb.setBestHeaderHash(hash);
  }
}

export async function runStateTransition(testContent: StateTransition, testPath: string) {
  const spec = CURRENT_FLAVOR;
  const _preState = loadState(spec, testContent.pre_state.keyvals);
  const _postState = loadState(spec, testContent.post_state.keyvals);
  const _block = testContent.block;
  // TODO: [MaSo] create db or continue using db of current test
  const db = createDb(path.basename(testPath), "../test-database");
  // TODO: [MaSo] initialize genesis state with first preState when empty database for test
  initDb(spec, db.rootDb);
  // initialize const required to manipulate database
  const blocksDb = new LmdbBlocks(spec, db.rootDb);
  const stateDb = new LmdbStates(spec, db.rootDb);
  const hasher = new TransitionHasher(spec, await keccakHasher, new SimpleAllocator());
  const verifier = new BlockVerifier(hasher, blocksDb);
  const initState = stateDb.getState(blocksDb.getBestHeaderHash());
  if (initState === null) {
    assert.fail("Initial state not initialized");
  }
  const stf = new OnChain(spec, initState, blocksDb, hasher, { enableParallelSealVerification: false });
  // import blocks one by one
  const blocks = loadBlocks(testPath);
  importBlocks(blocks, stf, blocksDb, stateDb, verifier);
  // check if post state is same as expected post state
  // if not, throw data for debugging
}

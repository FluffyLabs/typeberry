import assert from "node:assert";
import path from "node:path";
import { Block } from "@typeberry/block";
import { blockFromJson } from "@typeberry/block-json";
import { Decoder, Encoder } from "@typeberry/codec";
import { tinyChainSpec } from "@typeberry/config";
import { InMemoryBlocks } from "@typeberry/database";
import { SimpleAllocator, keccak } from "@typeberry/hash";
import type { FromJson } from "@typeberry/json-parser";
import { SafroleErrorCode } from "@typeberry/safrole/safrole";
import { SafroleSealError } from "@typeberry/safrole/safrole-seal";
import { merkelizeState, serializeState } from "@typeberry/state-merkleization";
import { TransitionHasher } from "@typeberry/transition";
import { BlockVerifier } from "@typeberry/transition/block-verifier";
import { OnChain, StfErrorKind, stfError } from "@typeberry/transition/chain-stf";
import { OK, Result } from "@typeberry/utils";
import { TestState, loadState } from "./stateLoader";

export class StateTransitionFuzzed {
  static fromJson: FromJson<StateTransitionFuzzed> = {
    pre_state: TestState.fromJson,
    block: blockFromJson(tinyChainSpec),
  };
  pre_state!: TestState;
  block!: Block;
}

const keccakHasher = keccak.KeccakHasher.create();

export async function runStateTransitionFuzzed(testContent: StateTransitionFuzzed, testPath: string) {
  const fileName = path.basename(testPath);
  const spec = tinyChainSpec;
  const preState = loadState(testContent.pre_state.keyvals);
  const preStateSerialized = serializeState(preState, spec);

  const preStateRoot = merkelizeState(preStateSerialized);

  const encodedBlock = Encoder.encodeObject(Block.Codec, testContent.block, spec);
  const blockView = Decoder.decodeObject(Block.Codec.View, encodedBlock, spec);
  const blocksDb = new InMemoryBlocks();

  const stf = new OnChain(
    spec,
    preState,
    blocksDb,
    new TransitionHasher(spec, await keccakHasher, new SimpleAllocator()),
    { enableParallelSealVerification: false },
  );

  // verify that we compute the state root exactly the same.
  assert.deepStrictEqual(testContent.pre_state.state_root.toString(), preStateRoot.toString());

  const verifier = new BlockVerifier(stf.hasher, blocksDb);
  // NOTE [ToDr] we skip full verification here, since we can run tests in isolation
  // (i.e. no block history)
  const headerHash = verifier.hashHeader(blockView);

  // now perform the state transition
  const stfResult = await stf.transition(blockView, headerHash.hash);
  const errorType = Object.keys(expectedErrors).find((x) => fileName.endsWith(x));

  const expectedResult = errorType !== undefined ? expectedErrors[errorType] : Result.ok(OK);
  assert.deepEqual(stfResult, expectedResult);
}

const expectedErrors: { [key: string]: string | Awaited<ReturnType<OnChain["transition"]>> } = {
  // TODO [ToDr] investigate why different error than in general case?
  "1_001_T5_EpochLotteryOver.json": safroleSealError(SafroleSealError.InvalidValidator),
  "1_001_T6_TimeslotNotMonotonic.json": safroleSealError(SafroleSealError.InvalidValidator),
  "1_002_T2_TicketAlreadyInState.json": safroleError(SafroleErrorCode.BadTicketOrder),
  "1_002_T5_EpochLotteryOver.json": safroleSealError(SafroleSealError.InvalidValidator),
  "1_002_T6_TimeslotNotMonotonic.json": safroleSealError(SafroleSealError.InvalidValidator),
  "1_003_T5_EpochLotteryOver.json": safroleSealError(SafroleSealError.InvalidValidator),
  "1_003_T6_TimeslotNotMonotonic.json": safroleSealError(SafroleSealError.InvalidValidator),
  "1_004_T2_TicketAlreadyInState.json": safroleError(SafroleErrorCode.BadTicketOrder),
  "1_004_T5_EpochLotteryOver.json": safroleSealError(SafroleSealError.InvalidValidator),
  "1_004_T6_TimeslotNotMonotonic.json": safroleSealError(SafroleSealError.InvalidValidator),
  "2_001_T2_TicketAlreadyInState.json": safroleError(SafroleErrorCode.BadTicketOrder),
  "2_002_T2_TicketAlreadyInState.json": safroleError(SafroleErrorCode.BadTicketOrder),
  "2_003_T2_TicketAlreadyInState.json": safroleError(SafroleErrorCode.BadTicketOrder),
  "3_001_T2_TicketAlreadyInState.json": safroleError(SafroleErrorCode.BadTicketOrder),
  "4_002_T2_TicketAlreadyInState.json": safroleError(SafroleErrorCode.BadTicketOrder),
  "4_003_T2_TicketAlreadyInState.json": safroleError(SafroleErrorCode.BadTicketOrder),
  // Generally sensible errors:
  "EpochLotteryOver.json": safroleError(SafroleErrorCode.UnexpectedTicket),
  "TimeslotNotMonotonic.json": safroleError(SafroleErrorCode.BadSlot),
  "TicketAlreadyInState.json": safroleError(SafroleErrorCode.DuplicateTicket),
  "TicketsBadOrder.json": safroleError(SafroleErrorCode.BadTicketOrder),
  "BadRingProof.json": safroleError(SafroleErrorCode.BadTicketProof),
};

function safroleError(error: SafroleErrorCode) {
  const err = Result.error(error);
  if (err.isOk) throw new Error("unreachable");
  return stfError(StfErrorKind.Safrole, err);
}

function safroleSealError(error: SafroleSealError) {
  const err = Result.error(error);
  if (err.isOk) throw new Error("unreachable");
  return stfError(StfErrorKind.SafroleSeal, err);
}

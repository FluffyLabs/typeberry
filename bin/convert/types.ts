import { Block, Header, tryAsTimeSlot } from "@typeberry/block";
import { WorkItem } from "@typeberry/block/work-item.js";
import { WorkPackage } from "@typeberry/block/work-package.js";
import { WorkReport } from "@typeberry/block/work-report.js";
import { blockFromJson, headerFromJson, workReportFromJson } from "@typeberry/block-json";
import { codec, type Decode, Decoder, type Encode, Encoder } from "@typeberry/codec";
import type { ChainSpec } from "@typeberry/config";
import { JipChainSpec } from "@typeberry/config-node";
import { v1 } from "@typeberry/fuzz-proto";
import { type Blake2b, HASH_SIZE } from "@typeberry/hash";
import type { FromJson } from "@typeberry/json-parser";
import { decodeStandardProgram } from "@typeberry/pvm-interpreter/spi-decoder/index.js";
import type { InMemoryState } from "@typeberry/state";
import { fullStateDumpFromJson } from "@typeberry/state-json";
import { SerializedState, StateEntries } from "@typeberry/state-merkleization";
import { inMemoryStateCodec } from "@typeberry/state-merkleization/in-memory-state-codec.js";
import { StateTransition, StateTransitionGenesis, type TestState } from "@typeberry/state-vectors";
import { workItemFromJson } from "@typeberry/test-runner/w3f/codec/work-item.js";
import { workPackageFromJson } from "@typeberry/test-runner/w3f/codec/work-package.js";
import { PvmTest } from "@typeberry/test-runner/w3f/pvm.js";

export type ProcessOutput<T> = {
  value: T;
  encode?: Encode<T>;
};

function looseType<T>(output: ProcessOutput<T>): ProcessOutput<unknown> {
  return {
    value: output.value,
    encode: output.encode as Encode<unknown>,
  };
}

export type SupportedType = {
  name: string;
  // biome-ignore lint/suspicious/noExplicitAny: We need to handle any possible output
  encode?: Encode<any> | ((spec: ChainSpec) => Encode<any>);
  // biome-ignore lint/suspicious/noExplicitAny: We need to handle any possible output
  decode?: Decode<any> | ((spec: ChainSpec) => Decode<any>);
  // biome-ignore lint/suspicious/noExplicitAny: We need to handle any possible output
  json?: (spec: ChainSpec) => FromJson<any>;
  process?: {
    options: readonly string[];
    run: (spec: ChainSpec, data: unknown, option: string, blake2b: Blake2b) => ProcessOutput<unknown>;
  };
};

export const SUPPORTED_TYPES: readonly SupportedType[] = [
  {
    name: "block",
    encode: Block.Codec,
    decode: Block.Codec,
    json: blockFromJson,
  },
  {
    name: "header",
    encode: Header.Codec,
    decode: Header.Codec,
    json: (_spec: ChainSpec) => headerFromJson,
    process: {
      options: ["as-hash"],
      run(spec, data, option, blake2b) {
        const header = data as Header;
        if (option === "as-hash") {
          return looseType({
            value: blake2b.hashBytes(Encoder.encodeObject(Header.Codec, header, spec)),
            encode: codec.bytes(HASH_SIZE),
          });
        }

        throw new Error(`Invalid processing option: ${option}`);
      },
    },
  },
  {
    name: "work-report",
    encode: WorkReport.Codec,
    decode: WorkReport.Codec,
    json: (_spec: ChainSpec) => workReportFromJson,
  },
  {
    name: "work-package",
    encode: WorkPackage.Codec,
    decode: WorkPackage.Codec,
    json: (_spec: ChainSpec) => workPackageFromJson,
  },
  {
    name: "work-item",
    encode: WorkItem.Codec,
    decode: WorkItem.Codec,
    json: (_spec: ChainSpec) => workItemFromJson,
  },
  {
    name: "spi",
    decode: {
      decode(x) {
        return decodeStandardProgram(x.remainingBytes().raw, new Uint8Array());
      },
    },
  },
  {
    name: "test-vector-pvm",
    json: (_spec: ChainSpec) => PvmTest.fromJson,
  },
  {
    name: "state-dump",
    encode: inMemoryStateCodec,
    decode: inMemoryStateCodec,
    json: fullStateDumpFromJson,
    process: {
      options: ["as-root-hash", "as-entries"],
      run(spec: ChainSpec, data: unknown, option: string, blake2b: Blake2b) {
        const state = data as InMemoryState;
        if (option === "as-entries") {
          return looseType({
            value: Object.fromEntries(StateEntries.serializeInMemory(spec, blake2b, state)),
          });
        }

        if (option === "as-root-hash") {
          return looseType({
            value: StateEntries.serializeInMemory(spec, blake2b, state).getRootHash(blake2b),
            encode: codec.bytes(HASH_SIZE),
          });
        }

        throw new Error(`Invalid processing option: ${option}`);
      },
    },
  },
  {
    name: "stf-genesis",
    encode: StateTransitionGenesis.Codec,
    decode: StateTransitionGenesis.Codec,
    json: () => StateTransitionGenesis.fromJson,
    process: {
      options: ["as-state", "as-jip4", "as-fuzz-message"],
      run(spec: ChainSpec, data: unknown, option: string, blake2b) {
        const test = data as StateTransitionGenesis;
        if (option === "as-state") {
          return looseType({
            value: stateFromKeyvals(spec, blake2b, test.state),
          });
        }

        if (option === "as-jip4") {
          const genesisState = new Map(test.state.keyvals.map((x) => [x.key, x.value]));
          return looseType({
            value: JipChainSpec.create({
              genesisHeader: Encoder.encodeObject(Header.Codec, test.header, spec),
              genesisState,
            }),
          });
        }

        if (option === "as-fuzz-message") {
          const init = v1.Initialize.create({
            header: test.header,
            keyvals: test.state.keyvals,
            ancestry: [],
          });
          const msg: v1.MessageData = {
            type: v1.MessageType.Initialize,
            value: init,
          };
          return looseType({
            value: msg,
            encode: v1.messageCodec,
          });
        }

        throw new Error(`Invalid processing option: ${option}`);
      },
    },
  },
  {
    name: "stf-vector",
    encode: StateTransition.Codec,
    decode: StateTransition.Codec,
    json: () => StateTransition.fromJson,
    process: {
      options: [
        "as-pre-state",
        "as-post-state",
        "as-fuzz-message",
        "as-block-fuzz-message",
        "as-state-fuzz-message",
        "as-block",
      ],
      run(spec: ChainSpec, data: unknown, option: string, blake2b) {
        const test = data as StateTransition;
        if (option === "as-pre-state") {
          return looseType({
            value: stateFromKeyvals(spec, blake2b, test.pre_state),
          });
        }

        if (option === "as-post-state") {
          return looseType({
            value: stateFromKeyvals(spec, blake2b, test.post_state),
          });
        }

        if (option === "as-block") {
          return looseType({
            encode: Block.Codec,
            value: test.block,
          });
        }

        if (option === "as-fuzz-message") {
          // biome-ignore lint/suspicious/noConsole: deprevation warning
          console.warn(
            "⚠️  Warning: 'as-fuzz-message' is deprecated and will be removed in version 0.6.0. Use 'as-block-fuzz-message' instead.",
          );
        }

        if (option === "as-block-fuzz-message" || option === "as-fuzz-message") {
          const encoded = Encoder.encodeObject(Block.Codec, test.block, spec);
          const blockView = Decoder.decodeObject(Block.Codec.View, encoded, spec);
          const msg: v1.MessageData = {
            type: v1.MessageType.ImportBlock,
            value: blockView,
          };
          return looseType({
            value: msg,
            encode: v1.messageCodec,
          });
        }

        if (option === "as-state-fuzz-message") {
          const init = v1.Initialize.create({
            header: Header.empty(),
            keyvals: test.pre_state.keyvals,
            ancestry: [
              v1.AncestryItem.create({
                headerHash: test.block.header.parentHeaderHash,
                slot: tryAsTimeSlot(tryAsTimeSlot(Math.max(0, test.block.header.timeSlotIndex - 1))),
              }),
            ],
          });
          const msg: v1.MessageData = {
            type: v1.MessageType.Initialize,
            value: init,
          };
          return looseType({
            value: msg,
            encode: v1.messageCodec,
          });
        }

        throw new Error(`Invalid processing option: ${option}`);
      },
    },
  },
  {
    name: "fuzz-message",
    encode: v1.messageCodec,
    decode: v1.messageCodec,
  },
];

const stateFromKeyvals = (spec: ChainSpec, blake2b: Blake2b, state: TestState) => {
  const entries = StateEntries.fromEntriesUnsafe(state.keyvals.map((x) => [x.key, x.value]));
  return SerializedState.fromStateEntries(spec, blake2b, entries);
};

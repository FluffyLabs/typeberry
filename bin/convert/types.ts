import { Block, Header } from "@typeberry/block";
import { WorkItem } from "@typeberry/block/work-item.js";
import { WorkPackage } from "@typeberry/block/work-package.js";
import { WorkReport } from "@typeberry/block/work-report.js";
import { blockFromJson, headerFromJson, workReportFromJson } from "@typeberry/block-json";
import { codec, type Decode, Decoder, type Encode, Encoder } from "@typeberry/codec";
import type { ChainSpec } from "@typeberry/config";
import { JipChainSpec } from "@typeberry/config-node";
import type { MessageData } from "@typeberry/ext-ipc/fuzz/v1/index.js";
import { Initialize, MessageType, messageCodec } from "@typeberry/ext-ipc/fuzz/v1/types.js";
import { blake2b, HASH_SIZE } from "@typeberry/hash";
import type { FromJson } from "@typeberry/json-parser";
import { decodeStandardProgram } from "@typeberry/pvm-spi-decoder";
import type { InMemoryState } from "@typeberry/state";
import { fullStateDumpFromJson } from "@typeberry/state-json";
import { SerializedState, StateEntries } from "@typeberry/state-merkleization";
import { inMemoryStateCodec } from "@typeberry/state-merkleization/in-memory-state-codec.js";
import type { TestState } from "@typeberry/test-runner/state-transition/state-loader.js";
import { StateTransition, StateTransitionGenesis } from "@typeberry/test-runner/state-transition/state-transition.js";
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
  encode?: Encode<any>;
  // biome-ignore lint/suspicious/noExplicitAny: We need to handle any possible output
  decode?: Decode<any>;
  // biome-ignore lint/suspicious/noExplicitAny: We need to handle any possible output
  json?: (spec: ChainSpec) => FromJson<any>;
  process?: {
    options: readonly string[];
    run: (spec: ChainSpec, data: unknown, option: string) => ProcessOutput<unknown>;
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
      run(spec, data, option) {
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
      run(spec: ChainSpec, data: unknown, option: string) {
        const state = data as InMemoryState;
        if (option === "as-entries") {
          return looseType({
            value: Object.fromEntries(StateEntries.serializeInMemory(spec, state)),
          });
        }

        if (option === "as-root-hash") {
          return looseType({
            value: StateEntries.serializeInMemory(spec, state).getRootHash(),
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
      run(spec: ChainSpec, data: unknown, option: string) {
        const test = data as StateTransitionGenesis;
        if (option === "as-state") {
          return looseType({
            value: stateFromKeyvals(spec, test.state),
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
          const init = Initialize.create({
            header: test.header,
            keyvals: test.state.keyvals,
            ancestry: [],
          });
          const msg: MessageData = {
            type: MessageType.Initialize,
            value: init,
          };
          return looseType({
            value: msg,
            encode: messageCodec,
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
      options: ["as-pre-state", "as-post-state", "as-fuzz-message"],
      run(spec: ChainSpec, data: unknown, option: string) {
        const test = data as StateTransition;
        if (option === "as-pre-state") {
          return looseType({
            value: stateFromKeyvals(spec, test.pre_state),
          });
        }

        if (option === "as-post-state") {
          return looseType({
            value: stateFromKeyvals(spec, test.post_state),
          });
        }

        if (option === "as-fuzz-message") {
          const encoded = Encoder.encodeObject(Block.Codec, test.block, spec);
          const blockView = Decoder.decodeObject(Block.Codec.View, encoded, spec);
          const msg: MessageData = {
            type: MessageType.ImportBlock,
            value: blockView,
          };
          return looseType({
            value: msg,
            encode: messageCodec,
          });
        }

        throw new Error(`Invalid processing option: ${option}`);
      },
    },
  },
  {
    name: "fuzz-message",
    encode: messageCodec,
    decode: messageCodec,
  },
];

const stateFromKeyvals = (spec: ChainSpec, state: TestState) => {
  const entries = StateEntries.fromEntriesUnsafe(state.keyvals.map((x) => [x.key, x.value]));
  return SerializedState.fromStateEntries(spec, entries);
};

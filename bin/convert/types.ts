import { Block, Header } from "@typeberry/block";
import { blockFromJson, headerFromJson, workReportFromJson } from "@typeberry/block-json";
import { WorkItem } from "@typeberry/block/work-item.js";
import { WorkPackage } from "@typeberry/block/work-package.js";
import { WorkReport } from "@typeberry/block/work-report.js";
import type { Decode, Encode } from "@typeberry/codec";
import type { ChainSpec } from "@typeberry/config";
import { TruncatedHashDictionary } from "@typeberry/database";
import type { FromJson } from "@typeberry/json-parser";
import { decodeStandardProgram } from "@typeberry/pvm-spi-decoder";
import { InMemoryState } from "@typeberry/state";
import { fullStateDumpFromJson } from "@typeberry/state-json";
import { SerializedState, StateEntries } from "@typeberry/state-merkleization";
import { inMemoryStateCodec } from "@typeberry/state-merkleization/in-memory-state-codec.js";
import { workItemFromJson } from "../test-runner/w3f/codec/work-item.js";
import { workPackageFromJson } from "../test-runner/w3f/codec/work-package.js";
import { PvmTest } from "../test-runner/w3f/pvm.js";
import { StateTransition } from "../test-runner/w3f/state-transition.js";

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
    run: (spec: ChainSpec, data: unknown, option: string) => unknown;
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
      options: ["as-root-hash", "as-entries", "as-truncated-entries"],
      run(spec: ChainSpec, data: unknown, option: string) {
        const state = data as InMemoryState;
        if (option === "as-entries") {
          return StateEntries.serializeInMemory(spec, state).entries;
        }

        if (option === "as-truncated-entries") {
          const entries = Array.from(StateEntries.serializeInMemory(spec, state).entries.data).map(([key, value]) => [
            key.toString().substring(2, 64),
            value.toString().substring(2),
          ]);
          return Object.fromEntries(entries);
        }

        if (option === "as-root-hash") {
          return StateEntries.serializeInMemory(spec, state).getRootHash();
        }
      },
    },
  },
  {
    name: "state-transition-vector",
    encode: StateTransition.Codec,
    decode: StateTransition.Codec,
    json: () => StateTransition.fromJson,
    process: {
      options: ["as-pre-state-dump", "as-post-state-dump"],
      run(spec: ChainSpec, data: unknown, option: string) {
        const test = data as StateTransition;

        if (option === "as-pre-state-dump") {
          const dict = TruncatedHashDictionary.fromEntries(
            test.post_state.keyvals.map((x) => [x.key.asOpaque(), x.value]),
          );
          const entries = StateEntries.fromTruncatedDictionaryUnsafe(dict);
          const state = SerializedState.fromStateEntries(spec, entries);
          return InMemoryState.copyFrom(state, new Map());
        }

        if (option === "as-post-state-dump") {
          const dict = TruncatedHashDictionary.fromEntries(
            test.post_state.keyvals.map((x) => [x.key.asOpaque(), x.value]),
          );
          const entries = StateEntries.fromTruncatedDictionaryUnsafe(dict);
          const state = SerializedState.fromStateEntries(spec, entries);
          return InMemoryState.copyFrom(state, new Map());
        }
      },
    },
  },
];

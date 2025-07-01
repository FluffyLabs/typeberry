import { Block, Header } from "@typeberry/block";
import { blockFromJson, headerFromJson, workReportFromJson } from "@typeberry/block-json";
import { WorkItem } from "@typeberry/block/work-item.js";
import { WorkPackage } from "@typeberry/block/work-package.js";
import { WorkReport } from "@typeberry/block/work-report.js";
import type { Decode, Encode } from "@typeberry/codec";
import type { ChainSpec } from "@typeberry/config";
import type { FromJson } from "@typeberry/json-parser";
import { decodeStandardProgram } from "@typeberry/pvm-spi-decoder";
import type { InMemoryState } from "@typeberry/state";
import { fullStateDumpFromJson } from "@typeberry/state-json";
import { StateEntries } from "@typeberry/state-merkleization";
import { inMemoryStateCodec } from "@typeberry/state-merkleization/in-memory-state-codec.js";
import { workItemFromJson } from "../test-runner/w3f/codec/work-item.js";
import { workPackageFromJson } from "../test-runner/w3f/codec/work-package.js";
import { PvmTest } from "../test-runner/w3f/pvm.js";

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
      options: ["root-hash", "entries", "truncated-entries"],
      run(spec: ChainSpec, data: unknown, option: string) {
        const state = data as InMemoryState;
        if (option === "entries") {
          return StateEntries.serializeInMemory(spec, state).entries;
        }

        if (option === "truncated-entries") {
          const entries = Array.from(StateEntries.serializeInMemory(spec, state).entries).map(([key, value]) => [
            key.toString().substring(2, 64),
            value.toString().substring(2),
          ]);
          return Object.fromEntries(entries);
        }

        if (option === "root-hash") {
          return StateEntries.serializeInMemory(spec, state).getRootHash();
        }
      },
    },
  },
];

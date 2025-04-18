import { json } from "@typeberry/json-parser";

import {
  BLS_KEY_BYTES,
  type BlsKey,
  type CodeHash,
  type HeaderHash,
  type ServiceId,
  type StateRootHash,
  type TimeSlot,
} from "@typeberry/block";
import { fromJson, workReportFromJson } from "@typeberry/block-json";
import type { PreimageHash } from "@typeberry/block/preimage";
import { type ExportsRootHash, type WorkPackageHash, WorkPackageInfo, WorkReport } from "@typeberry/block/work-report";
import { Encoder } from "@typeberry/codec";
import { HashDictionary } from "@typeberry/collections";
import { fullChainSpec, tinyChainSpec } from "@typeberry/config";
import { type OpaqueHash, WithHash, blake2b } from "@typeberry/hash";
import { type U32, type U64, tryAsU64 } from "@typeberry/numbers";
import type { SmallGas } from "@typeberry/pvm-interpreter";
import {
  AvailabilityAssignment,
  type BlockState,
  PreimageItem,
  Service,
  ServiceAccountInfo,
  VALIDATOR_META_BYTES,
  ValidatorData,
} from "@typeberry/state";
import { Bytes, BytesBlob } from "@typeberry/trie";

export function getChainSpec(path: string) {
  if (path.includes("tiny")) {
    return tinyChainSpec;
  }

  return fullChainSpec;
}

export const validatorDataFromJson = json.object<ValidatorData>(
  {
    ed25519: fromJson.bytes32(),
    bandersnatch: fromJson.bytes32(),
    bls: json.fromString((v) => Bytes.parseBytes(v, BLS_KEY_BYTES) as BlsKey),
    metadata: json.fromString((v) => Bytes.parseBytes(v, VALIDATOR_META_BYTES)),
  },
  ({ ed25519, bandersnatch, bls, metadata }) => new ValidatorData(bandersnatch, ed25519, bls, metadata),
);

export class TestAvailabilityAssignment {
  static fromJson = json.object<TestAvailabilityAssignment, AvailabilityAssignment>(
    {
      report: workReportFromJson,
      timeout: "number",
    },
    ({ report, timeout }) => {
      const workReportHash = blake2b.hashBytes(Encoder.encodeObject(WorkReport.Codec, report)).asOpaque();
      return new AvailabilityAssignment(new WithHash(workReportHash, report), timeout);
    },
  );

  report!: WorkReport;
  timeout!: TimeSlot;
}

export class TestWorkPackageInfo {
  static fromJson = json.object<TestWorkPackageInfo, WorkPackageInfo>(
    {
      hash: fromJson.bytes32(),
      exports_root: fromJson.bytes32(),
    },
    ({ hash, exports_root }) => {
      return new WorkPackageInfo(hash, exports_root);
    },
  );

  hash!: WorkPackageHash;
  exports_root!: ExportsRootHash;
}

export class TestBlockState {
  static fromJson = json.object<TestBlockState, BlockState>(
    {
      header_hash: fromJson.bytes32(),
      mmr: {
        peaks: json.array(json.nullable(fromJson.bytes32())),
      },
      state_root: fromJson.bytes32(),
      reported: json.array(TestWorkPackageInfo.fromJson),
    },
    ({ header_hash, mmr, state_root, reported }) => {
      return {
        headerHash: header_hash,
        mmr,
        postStateRoot: state_root,
        reported: HashDictionary.fromEntries(reported.map((x) => [x.workPackageHash, x])),
      };
    },
  );

  header_hash!: HeaderHash;
  mmr!: {
    peaks: Array<OpaqueHash | null>;
  };
  state_root!: StateRootHash;
  reported!: WorkPackageInfo[];
}

class TestServiceInfo {
  static fromJson = json.object<TestServiceInfo, ServiceAccountInfo>(
    {
      code_hash: fromJson.bytes32(),
      balance: json.fromNumber((x) => tryAsU64(x)),
      min_item_gas: "number",
      min_memo_gas: "number",
      bytes: json.fromNumber((x) => tryAsU64(x)),
      items: "number",
    },
    ({ code_hash, balance, min_item_gas, min_memo_gas, bytes, items }) => {
      return ServiceAccountInfo.fromCodec({
        codeHash: code_hash,
        balance,
        accumulateMinGas: min_item_gas,
        onTransferMinGas: min_memo_gas,
        storageUtilisationBytes: bytes,
        storageUtilisationCount: items,
      });
    },
  );

  code_hash!: CodeHash;
  balance!: U64;
  min_item_gas!: SmallGas;
  min_memo_gas!: SmallGas;
  bytes!: U64;
  items!: U32;
}

class TestPreimageItem {
  static fromJson = json.object<TestPreimageItem, PreimageItem>(
    {
      hash: fromJson.bytes32(),
      blob: json.fromString(BytesBlob.parseBlob),
    },
    ({ hash, blob }) => new PreimageItem(hash, blob),
  );

  hash!: PreimageHash;
  blob!: BytesBlob;
}

export class TestAccountItem {
  static fromJson = json.object<TestAccountItem, Service>(
    {
      id: "number",
      data: {
        service: TestServiceInfo.fromJson,
        preimages: json.optional(json.array(TestPreimageItem.fromJson)),
      },
    },
    ({ id, data }) =>
      new Service(id, {
        info: data.service,
        preimages: HashDictionary.fromEntries((data.preimages ?? []).map((x) => [x.hash, x])),
        storage: [],
        lookupHistory: HashDictionary.new(),
      }),
  );

  id!: ServiceId;
  data!: { service: ServiceAccountInfo; preimages?: TestPreimageItem[] };
}

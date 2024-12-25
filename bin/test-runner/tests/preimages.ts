import type { TimeSlot } from "@typeberry/block";
import type { PreimagesExtrinsic } from "@typeberry/block/preimage";
import { BytesBlob } from "@typeberry/bytes";
import type { OpaqueHash } from "@typeberry/hash";
import { type FromJson, json } from "@typeberry/json-parser";
import { preimagesExtrinsicFromJson } from "./codec/preimages-extrinsic";
import { commonFromJson } from "./common-types";

class Input {
  static fromJson: FromJson<Input> = {
    preimages: preimagesExtrinsicFromJson,
    slot: "number",
  };

  preimages!: PreimagesExtrinsic;
  slot!: TimeSlot;
}

class TestPreimagesItem {
  static fromJson: FromJson<TestPreimagesItem> = {
    hash: commonFromJson.bytes32(),
    blob: json.fromString(BytesBlob.parseBlob),
  };

  hash!: OpaqueHash;
  blob!: BytesBlob;
}

class TestHistoryItem {
  static fromJson: FromJson<TestHistoryItem> = {
    key: {
      hash: commonFromJson.bytes32(),
      length: "number",
    },
    value: ["array", "number"],
  };
  key!: {
    hash: OpaqueHash;
    length: number;
  };
  value!: number[];
}

class TestAccountsMapEntry {
  static fromJson: FromJson<TestAccountsMapEntry> = {
    id: "number",
    info: {
      preimages: json.array(TestPreimagesItem.fromJson),
      history: json.array(TestHistoryItem.fromJson),
    },
  };
  id!: number;
  info!: {
    preimages: TestPreimagesItem[];
    history: TestHistoryItem[];
  };
}

class TestState {
  static fromJson: FromJson<TestState> = {
    accounts: json.array(TestAccountsMapEntry.fromJson),
  };
  accounts!: TestAccountsMapEntry[];
}

enum PreimagesErrorCode {
  PreimageUnneeded = "preimage_unneeded",
}

export class Output {
  static fromJson: FromJson<Output> = {
    ok: json.optional(json.fromAny(() => null)),
    err: json.optional("string"),
  };

  ok?: null;
  err?: PreimagesErrorCode;
}

export class PreImagesTest {
  static fromJson: FromJson<PreImagesTest> = {
    input: Input.fromJson,
    pre_state: TestState.fromJson,
    output: Output.fromJson,
    post_state: TestState.fromJson,
  };
  input!: Input;
  pre_state!: TestState;
  output!: Output;
  post_state!: TestState;
}

export async function runPreImagesTest(_testContent: PreImagesTest) {
  // TODO [MaSi] Implement
}

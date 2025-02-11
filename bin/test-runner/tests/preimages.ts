import assert from "node:assert";
import { type TimeSlot, tryAsServiceId, tryAsTimeSlot } from "@typeberry/block";
import type { PreimagesExtrinsic } from "@typeberry/block/preimage";
import { BytesBlob } from "@typeberry/bytes";
import { HashDictionary } from "@typeberry/collections";
import { type OpaqueHash, blake2b } from "@typeberry/hash";
import { type FromJson, json } from "@typeberry/json-parser";
import { type Account, type PreimageHash, Preimages, historyKey } from "@typeberry/transition";
import { Result } from "@typeberry/utils";
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
    hash: PreimageHash;
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

export async function runPreImagesTest(testContent: PreImagesTest) {
  const preState = {
    accounts: new Map(
      testContent.pre_state.accounts.map((account) => [
        tryAsServiceId(account.id),
        testAccountsMapEntryToAccount(account),
      ]),
    ),
  };
  const postState = {
    accounts: new Map(
      testContent.post_state.accounts.map((account) => [
        tryAsServiceId(account.id),
        testAccountsMapEntryToAccount(account),
      ]),
    ),
  };
  const preimages = new Preimages(preState);
  const result = preimages.integrate(testContent.input);

  assert.deepEqual(result, testOutputToResult(testContent.output));
  assert.deepEqual(preimages.state, postState);
}

function testAccountsMapEntryToAccount(entry: TestAccountsMapEntry): Account {
  const preimages = new HashDictionary<PreimageHash, BytesBlob>();

  for (const preimage of entry.info.preimages) {
    preimages.set(blake2b.hashBytes(preimage.blob).asOpaque(), preimage.blob);
  }

  const history = new Map();

  for (const item of entry.info.history) {
    history.set(historyKey(item.key.hash, item.key.length), {
      slots: item.value.map((slot) => tryAsTimeSlot(slot)),
    });
  }

  return {
    id: tryAsServiceId(entry.id),
    info: {
      preimages,
      history,
    },
  };
}

function testOutputToResult(testOutput: Output) {
  return testOutput.err ? Result.error(testOutput.err) : Result.ok(testOutput.ok);
}

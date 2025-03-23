import assert from "node:assert";
import { type TimeSlot, tryAsServiceId, tryAsTimeSlot } from "@typeberry/block";
import type { PreimageHash, PreimagesExtrinsic } from "@typeberry/block/preimage";
import { BytesBlob } from "@typeberry/bytes";
import { HashDictionary } from "@typeberry/collections";
import { type OpaqueHash, blake2b } from "@typeberry/hash";
import { type FromJson, json } from "@typeberry/json-parser";
import type { U32 } from "@typeberry/numbers";
import {
  type Account,
  LookupHistoryItem,
  Preimages,
  type PreimagesErrorCode,
  tryAsLookupHistorySlots,
} from "@typeberry/transition";
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
    data: {
      preimages: json.array(TestPreimagesItem.fromJson),
      lookup_meta: json.array(TestHistoryItem.fromJson),
    },
  };
  id!: number;
  data!: {
    preimages: TestPreimagesItem[];
    lookup_meta: TestHistoryItem[];
  };
}

class TestState {
  static fromJson: FromJson<TestState> = {
    accounts: json.array(TestAccountsMapEntry.fromJson),
  };
  accounts!: TestAccountsMapEntry[];
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
  const preimages = HashDictionary.new<PreimageHash, BytesBlob>();

  for (const preimage of entry.data.preimages) {
    preimages.set(blake2b.hashBytes(preimage.blob).asOpaque(), preimage.blob);
  }

  const lookupHistory = HashDictionary.new<PreimageHash, LookupHistoryItem[]>();
  for (const item of entry.data.lookup_meta) {
    const slots = tryAsLookupHistorySlots(item.value.map((slot) => tryAsTimeSlot(slot)));

    const arr = lookupHistory.get(item.key.hash) ?? [];
    arr.push(new LookupHistoryItem(item.key.hash, item.key.length as U32, slots));
    lookupHistory.set(item.key.hash, arr);
  }

  return {
    id: tryAsServiceId(entry.id),
    data: {
      preimages,
      lookupHistory,
    },
  };
}

function testOutputToResult(testOutput: Output) {
  return testOutput.err !== undefined ? Result.error(testOutput.err) : Result.ok(testOutput.ok);
}

import assert from "node:assert";
import { type TimeSlot, tryAsServiceGas, tryAsServiceId, tryAsTimeSlot } from "@typeberry/block";
import { fromJson, preimagesExtrinsicFromJson } from "@typeberry/block-json";
import type { PreimageHash, PreimagesExtrinsic } from "@typeberry/block/preimage";
import { Bytes, BytesBlob } from "@typeberry/bytes";
import { HashDictionary } from "@typeberry/collections";
import { tinyChainSpec } from "@typeberry/config";
import { HASH_SIZE, type OpaqueHash, blake2b } from "@typeberry/hash";
import { type FromJson, json } from "@typeberry/json-parser";
import { tryAsU32, tryAsU64 } from "@typeberry/numbers";
import {
  InMemoryService,
  InMemoryState,
  LookupHistoryItem,
  PreimageItem,
  ServiceAccountInfo,
  tryAsLookupHistorySlots,
} from "@typeberry/state";
import { Preimages, type PreimagesErrorCode } from "@typeberry/transition";
import { OK, Result, deepEqual } from "@typeberry/utils";

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
    hash: fromJson.bytes32(),
    blob: json.fromString(BytesBlob.parseBlob),
  };

  hash!: OpaqueHash;
  blob!: BytesBlob;
}

class TestHistoryItem {
  static fromJson: FromJson<TestHistoryItem> = {
    key: {
      hash: fromJson.bytes32(),
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
    ok: json.optional(json.fromAny(() => OK)),
    err: json.optional("string"),
  };

  ok?: OK;
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
  const preState = InMemoryState.partial(tinyChainSpec, {
    services: new Map(
      testContent.pre_state.accounts.map((account) => [
        tryAsServiceId(account.id),
        testAccountsMapEntryToAccount(account),
      ]),
    ),
  });
  const postState = InMemoryState.partial(tinyChainSpec, {
    services: new Map(
      testContent.post_state.accounts.map((account) => [
        tryAsServiceId(account.id),
        testAccountsMapEntryToAccount(account),
      ]),
    ),
  });
  const preimages = new Preimages(preState);
  const result = preimages.integrate(testContent.input);

  deepEqual(result, testOutputToResult(testContent.output), { ignore: ["ok"] });
  if (result.isOk) {
    preState.applyUpdate(result.ok);
  }
  assert.deepEqual(preState, postState);
}

function testAccountsMapEntryToAccount(entry: TestAccountsMapEntry): InMemoryService {
  const preimages = HashDictionary.fromEntries(
    entry.data.preimages
      .map((x) => {
        return PreimageItem.create({ hash: blake2b.hashBytes(x.blob).asOpaque(), blob: x.blob });
      })
      .map((x) => [x.hash, x]),
  );

  const lookupHistory = HashDictionary.new<PreimageHash, LookupHistoryItem[]>();
  for (const item of entry.data.lookup_meta) {
    const slots = tryAsLookupHistorySlots(item.value.map((slot) => tryAsTimeSlot(slot)));

    const arr = lookupHistory.get(item.key.hash) ?? [];
    arr.push(new LookupHistoryItem(item.key.hash, tryAsU32(item.key.length), slots));
    lookupHistory.set(item.key.hash, arr);
  }

  return new InMemoryService(tryAsServiceId(entry.id), {
    info: ServiceAccountInfo.create({
      codeHash: Bytes.zero(HASH_SIZE).asOpaque(),
      balance: tryAsU64(0),
      accumulateMinGas: tryAsServiceGas(0),
      onTransferMinGas: tryAsServiceGas(0),
      storageUtilisationBytes: tryAsU64(0),
      storageUtilisationCount: tryAsU32(0),
    }),
    storage: HashDictionary.new(),
    preimages,
    lookupHistory,
  });
}

function testOutputToResult(testOutput: Output): ReturnType<Preimages["integrate"]> {
  return testOutput.err !== undefined
    ? Result.error(testOutput.err)
    : Result.ok({
        preimages: [],
      });
}

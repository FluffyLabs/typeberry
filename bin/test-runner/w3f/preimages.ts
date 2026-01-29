import { type TimeSlot, tryAsServiceGas, tryAsServiceId, tryAsTimeSlot } from "@typeberry/block";
import type { PreimageHash, PreimagesExtrinsic } from "@typeberry/block/preimage.js";
import { fromJson, preimagesExtrinsicFromJson } from "@typeberry/block-json";
import { Bytes, BytesBlob } from "@typeberry/bytes";
import { HashDictionary } from "@typeberry/collections";
import { tinyChainSpec } from "@typeberry/config";
import { Blake2b, HASH_SIZE, type OpaqueHash } from "@typeberry/hash";
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
import { Compatibility, deepEqual, GpVersion, OK, Result } from "@typeberry/utils";

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

type JsonTestAccountPre072 = {
  id: number;
  data: {
    preimages: TestPreimagesItem[];
    lookup_meta: TestHistoryItem[];
  };
};

type JsonTestAccount = {
  id: number;
  data: {
    preimage_blobs: TestPreimagesItem[];
    preimage_requests: TestHistoryItem[];
  };
};

const testAccountFromJson = Compatibility.isGreaterOrEqual(GpVersion.V0_7_2)
  ? json.object<JsonTestAccountPre072, TestAccountsMapEntry>(
      {
        id: "number",
        data: {
          preimages: json.array(TestPreimagesItem.fromJson),
          lookup_meta: json.array(TestHistoryItem.fromJson),
        },
      },
      ({ data, id }) =>
        TestAccountsMapEntry.create({
          id,
          data: { preimage_blobs: data.preimages, preimage_requests: data.lookup_meta },
        }),
    )
  : json.object<JsonTestAccount, TestAccountsMapEntry>(
      {
        id: "number",
        data: {
          preimage_blobs: json.array(TestPreimagesItem.fromJson),
          preimage_requests: json.array(TestHistoryItem.fromJson),
        },
      },
      ({ data, id }) => TestAccountsMapEntry.create({ id, data }),
    );

class TestAccountsMapEntry {
  static create({
    id,
    data,
  }: {
    id: number;
    data: { preimage_blobs: TestPreimagesItem[]; preimage_requests: TestHistoryItem[] };
  }): TestAccountsMapEntry {
    const entry = new TestAccountsMapEntry();
    entry.id = id;
    entry.data = data;
    return entry;
  }

  id!: number;
  data!: {
    preimage_blobs: TestPreimagesItem[];
    preimage_requests: TestHistoryItem[];
  };
}

class TestState {
  static fromJson: FromJson<TestState> = {
    accounts: json.array(testAccountFromJson),
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
  const blake2b = await Blake2b.createHasher();
  const preState = InMemoryState.partial(tinyChainSpec, {
    services: new Map(
      testContent.pre_state.accounts.map((account) => [
        tryAsServiceId(account.id),
        testAccountsMapEntryToAccount(account, blake2b),
      ]),
    ),
  });
  const postState = InMemoryState.partial(tinyChainSpec, {
    services: new Map(
      testContent.post_state.accounts.map((account) => [
        tryAsServiceId(account.id),
        testAccountsMapEntryToAccount(account, blake2b),
      ]),
    ),
  });
  const preimages = new Preimages(preState, blake2b);
  const result = preimages.integrate(testContent.input);

  deepEqual(result, testOutputToResult(testContent.output), { ignore: ["ok", "details"] });
  if (result.isOk) {
    preState.applyUpdate(result.ok);
  }
  deepEqual(preState, postState);
}

function testAccountsMapEntryToAccount(entry: TestAccountsMapEntry, blake2b: Blake2b): InMemoryService {
  const preimages = HashDictionary.fromEntries(
    entry.data.preimage_blobs
      .map((x) => {
        return PreimageItem.create({ hash: blake2b.hashBytes(x.blob).asOpaque(), blob: x.blob });
      })
      .map((x) => [x.hash, x]),
  );

  const lookupHistory = HashDictionary.new<PreimageHash, LookupHistoryItem[]>();
  for (const item of entry.data.preimage_requests) {
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
      gratisStorage: tryAsU64(0),
      storageUtilisationCount: tryAsU32(0),
      created: tryAsTimeSlot(0),
      lastAccumulation: tryAsTimeSlot(0),
      parentService: tryAsServiceId(0),
    }),
    storage: new Map(),
    preimages,
    lookupHistory,
  });
}

function testOutputToResult(testOutput: Output): ReturnType<Preimages["integrate"]> {
  return testOutput.err !== undefined
    ? Result.error(testOutput.err, () => `Preimages integration failed: ${testOutput.err}`)
    : Result.ok({
        preimages: new Map(),
      });
}

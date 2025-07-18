import { type CodeHash, type ServiceGas, type ServiceId, tryAsServiceGas } from "@typeberry/block";
import { fromJson } from "@typeberry/block-json";
import type { PreimageHash } from "@typeberry/block/preimage.js";
import { Bytes, BytesBlob } from "@typeberry/bytes";
import { HashDictionary } from "@typeberry/collections";
import { HASH_SIZE, blake2b } from "@typeberry/hash";
import { json } from "@typeberry/json-parser";
import { type U32, type U64, tryAsU64, u32AsLeBytes } from "@typeberry/numbers";
import {
  InMemoryService,
  LookupHistoryItem,
  type LookupHistorySlots,
  PreimageItem,
  ServiceAccountInfo,
  StorageItem,
  type StorageKey,
} from "@typeberry/state";
import { Compatibility, GpVersion } from "@typeberry/utils";

class JsonServiceInfo {
  static fromJson = json.object<JsonServiceInfo, ServiceAccountInfo>(
    {
      code_hash: fromJson.bytes32(),
      balance: json.fromNumber((x) => tryAsU64(x)),
      min_item_gas: json.fromNumber((x) => tryAsServiceGas(x)),
      min_memo_gas: json.fromNumber((x) => tryAsServiceGas(x)),
      bytes: json.fromNumber((x) => tryAsU64(x)),
      items: "number",
    },
    ({ code_hash, balance, min_item_gas, min_memo_gas, bytes, items }) => {
      return ServiceAccountInfo.create({
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
  min_item_gas!: ServiceGas;
  min_memo_gas!: ServiceGas;
  bytes!: U64;
  items!: U32;
}

class JsonPreimageItem {
  static fromJson = json.object<JsonPreimageItem, PreimageItem>(
    {
      hash: fromJson.bytes32(),
      blob: json.fromString(BytesBlob.parseBlob),
    },
    ({ hash, blob }) => PreimageItem.create({ hash, blob }),
  );

  hash!: PreimageHash;
  blob!: BytesBlob;
}

class JsonStorageItem {
  static fromJson = {
    key: json.fromString(BytesBlob.parseBlob),
    value: json.fromString(BytesBlob.parseBlob),
  };

  key!: BytesBlob;
  value!: BytesBlob;
}

class Gp064JsonStorageItem {
  hash!: BytesBlob;
  blob!: BytesBlob;
}

const gp064stateItemFromJson = json.object<Gp064JsonStorageItem, JsonStorageItem>(
  {
    hash: fromJson.bytes32(),
    blob: json.fromString(BytesBlob.parseBlob),
  },
  ({ hash, blob }) => ({ key: hash, value: blob }),
);

const lookupMetaFromJson = json.object<JsonLookupMeta, LookupHistoryItem>(
  {
    key: {
      hash: fromJson.bytes32(),
      length: "number",
    },
    value: json.array("number"),
  },
  ({ key, value }) => new LookupHistoryItem(key.hash, key.length, value),
);

type JsonLookupMeta = {
  key: {
    hash: PreimageHash;
    length: U32;
  };
  value: LookupHistorySlots;
};

export class JsonService {
  static fromJson = json.object<JsonService, InMemoryService>(
    {
      id: "number",
      data: {
        service: JsonServiceInfo.fromJson,
        preimages: json.optional(json.array(JsonPreimageItem.fromJson)),
        storage: json.optional(
          json.array(Compatibility.is(GpVersion.V0_6_4) ? gp064stateItemFromJson : JsonStorageItem.fromJson),
        ),
        lookup_meta: json.optional(json.array(lookupMetaFromJson)),
      },
    },
    ({ id, data }) => {
      const lookupHistory = HashDictionary.new<PreimageHash, LookupHistoryItem[]>();
      for (const item of data.lookup_meta ?? []) {
        const data = lookupHistory.get(item.hash) ?? [];
        data.push(item);
        lookupHistory.set(item.hash, data);
      }
      const preimages = HashDictionary.fromEntries((data.preimages ?? []).map((x) => [x.hash, x]));
      const storage = HashDictionary.fromEntries(
        (data.storage ?? []).map(({ key, value }) => {
          const keyWithServiceId = BytesBlob.blobFromParts(u32AsLeBytes(id), key.raw);
          const keyHash = Compatibility.is(GpVersion.V0_6_4)
            ? Bytes.parseBytes(key.toString(), HASH_SIZE).asOpaque<StorageKey>()
            : blake2b.hashBytes(keyWithServiceId).asOpaque<StorageKey>();
          return [keyHash, StorageItem.create({ key: keyHash, value })];
        }),
      );

      return new InMemoryService(id, {
        info: data.service,
        preimages,
        storage,
        lookupHistory,
      });
    },
  );

  id!: ServiceId;
  data!: {
    service: ServiceAccountInfo;
    preimages?: JsonPreimageItem[];
    storage?: JsonStorageItem[];
    lookup_meta?: LookupHistoryItem[];
  };
}

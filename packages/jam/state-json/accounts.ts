import {
  type CodeHash,
  type ServiceGas,
  type ServiceId,
  type TimeSlot,
  tryAsServiceGas,
  tryAsServiceId,
  tryAsTimeSlot,
} from "@typeberry/block";
import { fromJson } from "@typeberry/block-json";
import type { PreimageHash } from "@typeberry/block/preimage.js";
import { BytesBlob } from "@typeberry/bytes";
import { HashDictionary } from "@typeberry/collections";
import { json } from "@typeberry/json-parser";
import { type U32, type U64, tryAsU64 } from "@typeberry/numbers";
import {
  InMemoryService,
  LookupHistoryItem,
  type LookupHistorySlots,
  PreimageItem,
  ServiceAccountInfo,
  StorageItem,
  type StorageKey,
} from "@typeberry/state";
import { asOpaqueType, Compatibility, GpVersion } from "@typeberry/utils";

class JsonServiceInfoPre067 {
  static fromJson = json.object<JsonServiceInfoPre067, ServiceAccountInfo>(
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
        // TODO [MaSo] Should be provided from json
        gratisStorage: tryAsU64(0),
        created: tryAsTimeSlot(0),
        lastAccumulation: tryAsTimeSlot(0),
        parentService: tryAsServiceId(0),
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

class JsonServiceInfo extends JsonServiceInfoPre067 {
  static fromJson = json.object<JsonServiceInfo, ServiceAccountInfo>(
    {
      code_hash: fromJson.bytes32(),
      balance: json.fromNumber((x) => tryAsU64(x)),
      min_item_gas: json.fromNumber((x) => tryAsServiceGas(x)),
      min_memo_gas: json.fromNumber((x) => tryAsServiceGas(x)),
      bytes: json.fromNumber((x) => tryAsU64(x)),
      items: "number",
      creation_slot: json.fromNumber((x) => tryAsTimeSlot(x)),
      deposit_offset: json.fromNumber((x) => tryAsU64(x)),
      last_accumulation_slot: json.fromNumber((x) => tryAsTimeSlot(x)),
      parent_service: json.fromNumber((x) => tryAsServiceId(x)),
    },
    ({
      code_hash,
      balance,
      min_item_gas,
      min_memo_gas,
      bytes,
      items,
      deposit_offset,
      creation_slot,
      last_accumulation_slot,
      parent_service,
    }) => {
      return ServiceAccountInfo.create({
        codeHash: code_hash,
        balance,
        accumulateMinGas: min_item_gas,
        onTransferMinGas: min_memo_gas,
        storageUtilisationBytes: bytes,
        storageUtilisationCount: items,
        gratisStorage: deposit_offset,
        created: creation_slot,
        lastAccumulation: last_accumulation_slot,
        parentService: parent_service,
      });
    },
  );

  creation_slot!: TimeSlot;
  deposit_offset!: U64;
  last_accumulation_slot!: TimeSlot;
  parent_service!: ServiceId;
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
        service: Compatibility.isGreaterOrEqual(GpVersion.V0_6_7)
          ? JsonServiceInfo.fromJson
          : JsonServiceInfoPre067.fromJson,
        preimages: json.optional(json.array(JsonPreimageItem.fromJson)),
        storage: json.optional(json.array(JsonStorageItem.fromJson)),
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
      const storage = new Map<string, StorageItem>();

      const entries = (data.storage ?? []).map(({ key, value }) => {
        const opaqueKey: StorageKey = asOpaqueType(key);
        return [opaqueKey, StorageItem.create({ key: opaqueKey, value })] as const;
      });

      for (const [key, item] of entries) {
        storage.set(key.toString(), item);
      }

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

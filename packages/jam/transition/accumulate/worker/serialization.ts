/**
 * Serialization layer for worker communication.
 *
 * Converts class instances to/from plain objects that survive structured clone.
 * All "Plain" types use only: primitives, bigint, Uint8Array, Map, arrays.
 */
import type { CodeHash, CoreIndex, PerValidator, ServiceGas, ServiceId, TimeSlot } from "@typeberry/block";
import type { PreimageHash } from "@typeberry/block/preimage.js";
import type { AuthorizerHash, ExportsRootHash, WorkPackageHash } from "@typeberry/block/refine-context.js";
import { WorkExecResult, WorkExecResultKind } from "@typeberry/block/work-result.js";
import { Bytes, BytesBlob } from "@typeberry/bytes";
import type { FixedSizeArray } from "@typeberry/collections";
import { asKnownSize } from "@typeberry/collections";
import { BANDERSNATCH_KEY_BYTES, BLS_KEY_BYTES, ED25519_KEY_BYTES } from "@typeberry/crypto";
import { HASH_SIZE, type OpaqueHash } from "@typeberry/hash";
import { PendingTransfer, type TRANSFER_MEMO_BYTES } from "@typeberry/jam-host-calls";
import { AccumulationStateUpdate } from "@typeberry/jam-host-calls/externalities/state-update.js";
import type { U32, U64 } from "@typeberry/numbers";
import {
  type AUTHORIZATION_QUEUE_SIZE,
  InMemoryService,
  LookupHistoryItem,
  PreimageItem,
  PrivilegedServices,
  type Service,
  ServiceAccountInfo,
  StorageItem,
  type StorageKey,
  tryAsLookupHistorySlots,
  UpdatePreimage,
  UpdatePreimageKind,
  UpdateService,
  UpdateServiceKind,
  UpdateStorage,
  UpdateStorageKind,
  VALIDATOR_META_BYTES,
  ValidatorData,
} from "@typeberry/state";
import { Operand } from "../operand.js";

// ── Plain types (structured-clone-safe) ──────────────────────────────────────

export type PlainServiceAccountInfo = {
  codeHash: Uint8Array;
  balance: U64;
  accumulateMinGas: ServiceGas;
  onTransferMinGas: ServiceGas;
  storageUtilisationBytes: U64;
  gratisStorage: U64;
  storageUtilisationCount: U32;
  created: TimeSlot;
  lastAccumulation: TimeSlot;
  parentService: ServiceId;
};

export type PlainLookupHistoryItem = {
  hash: Uint8Array;
  length: U32;
  slots: TimeSlot[];
};

export type PlainPreimageItem = {
  hash: Uint8Array;
  blob: Uint8Array;
};

export type PlainStorageItem = {
  key: Uint8Array;
  value: Uint8Array;
};

export type PlainUpdatePreimage =
  | { kind: UpdatePreimageKind.Provide; preimage: PlainPreimageItem; slot: TimeSlot | null; providedFor: ServiceId }
  | { kind: UpdatePreimageKind.Remove; hash: Uint8Array; length: U32 }
  | { kind: UpdatePreimageKind.UpdateOrAdd; item: PlainLookupHistoryItem };

export type PlainUpdateService =
  | { kind: UpdateServiceKind.Update; account: PlainServiceAccountInfo }
  | {
      kind: UpdateServiceKind.Create;
      account: PlainServiceAccountInfo;
      lookupHistory: PlainLookupHistoryItem | null;
    };

export type PlainUpdateStorage =
  | { kind: UpdateStorageKind.Set; storage: PlainStorageItem }
  | { kind: UpdateStorageKind.Remove; key: Uint8Array };

export type PlainPrivilegedServices = {
  manager: ServiceId;
  delegator: ServiceId;
  registrar: ServiceId;
  assigners: ServiceId[];
  autoAccumulateServices: Map<ServiceId, ServiceGas>;
};

export type PlainAccumulationStateUpdate = {
  created: ServiceId[];
  updated: Map<ServiceId, PlainUpdateService>;
  removed: ServiceId[];
  preimages: Map<ServiceId, PlainUpdatePreimage[]>;
  storage: Map<ServiceId, PlainUpdateStorage[]>;
  transfers: PlainPendingTransfer[];
  yieldedRoot: Uint8Array | null;
  authorizationQueues: Map<CoreIndex, Uint8Array[]>;
  validatorsData: PlainValidatorData[] | null;
  privilegedServices: PlainPrivilegedServices | null;
};

export type PlainPendingTransfer = {
  source: ServiceId;
  destination: ServiceId;
  amount: U64;
  memo: Uint8Array;
  gas: ServiceGas;
};

export type PlainOperand = {
  hash: Uint8Array;
  exportsRoot: Uint8Array;
  authorizerHash: Uint8Array;
  payloadHash: Uint8Array;
  gas: ServiceGas;
  result: { kind: number; okBlob?: Uint8Array };
  authorizationOutput: Uint8Array;
};

export type PlainValidatorData = {
  bandersnatch: Uint8Array;
  ed25519: Uint8Array;
  bls: Uint8Array;
  metadata: Uint8Array;
};

export type PlainService = {
  serviceId: ServiceId;
  info: PlainServiceAccountInfo;
  preimages: [Uint8Array, PlainPreimageItem][];
  lookupHistory: [Uint8Array, PlainLookupHistoryItem[]][];
  storage: [string, PlainStorageItem][];
};

// ── Serializers ──────────────────────────────────────────────────────────────

function toRaw(bytes: { raw: Uint8Array }): Uint8Array {
  return bytes.raw;
}

export function serializeServiceAccountInfo(info: ServiceAccountInfo): PlainServiceAccountInfo {
  return {
    codeHash: toRaw(info.codeHash),
    balance: info.balance,
    accumulateMinGas: info.accumulateMinGas,
    onTransferMinGas: info.onTransferMinGas,
    storageUtilisationBytes: info.storageUtilisationBytes,
    gratisStorage: info.gratisStorage,
    storageUtilisationCount: info.storageUtilisationCount,
    created: info.created,
    lastAccumulation: info.lastAccumulation,
    parentService: info.parentService,
  };
}

export function serializeLookupHistoryItem(item: LookupHistoryItem): PlainLookupHistoryItem {
  return { hash: toRaw(item.hash), length: item.length, slots: [...item.slots] };
}

export function serializePendingTransfer(t: PendingTransfer): PlainPendingTransfer {
  return { source: t.source, destination: t.destination, amount: t.amount, memo: toRaw(t.memo), gas: t.gas };
}

export function serializeOperand(o: Operand): PlainOperand {
  return {
    hash: toRaw(o.hash),
    exportsRoot: toRaw(o.exportsRoot),
    authorizerHash: toRaw(o.authorizerHash),
    payloadHash: toRaw(o.payloadHash),
    gas: o.gas,
    result:
      o.result.kind === WorkExecResultKind.ok
        ? { kind: o.result.kind, okBlob: o.result.okBlob !== null ? toRaw(o.result.okBlob) : new Uint8Array() }
        : { kind: o.result.kind },
    authorizationOutput: toRaw(o.authorizationOutput),
  };
}

function serializeUpdatePreimage(up: UpdatePreimage): PlainUpdatePreimage {
  switch (up.action.kind) {
    case UpdatePreimageKind.Provide:
      return {
        kind: UpdatePreimageKind.Provide,
        preimage: { hash: toRaw(up.action.preimage.hash), blob: toRaw(up.action.preimage.blob) },
        slot: up.action.slot,
        providedFor: up.action.providedFor,
      };
    case UpdatePreimageKind.Remove:
      return { kind: UpdatePreimageKind.Remove, hash: toRaw(up.action.hash), length: up.action.length };
    case UpdatePreimageKind.UpdateOrAdd:
      return { kind: UpdatePreimageKind.UpdateOrAdd, item: serializeLookupHistoryItem(up.action.item) };
  }
}

function serializeUpdateService(us: UpdateService): PlainUpdateService {
  if (us.action.kind === UpdateServiceKind.Create) {
    return {
      kind: UpdateServiceKind.Create,
      account: serializeServiceAccountInfo(us.action.account),
      lookupHistory: us.action.lookupHistory !== null ? serializeLookupHistoryItem(us.action.lookupHistory) : null,
    };
  }
  return { kind: UpdateServiceKind.Update, account: serializeServiceAccountInfo(us.action.account) };
}

function serializeUpdateStorage(us: UpdateStorage): PlainUpdateStorage {
  if (us.action.kind === UpdateStorageKind.Set) {
    return {
      kind: UpdateStorageKind.Set,
      storage: { key: toRaw(us.action.storage.key), value: toRaw(us.action.storage.value) },
    };
  }
  return { kind: UpdateStorageKind.Remove, key: toRaw(us.action.key) };
}

export function serializePrivilegedServices(ps: PrivilegedServices): PlainPrivilegedServices {
  return {
    manager: ps.manager,
    delegator: ps.delegator,
    registrar: ps.registrar,
    assigners: [...ps.assigners],
    autoAccumulateServices: new Map(ps.autoAccumulateServices),
  };
}

export function serializeAccumulationStateUpdate(su: AccumulationStateUpdate): PlainAccumulationStateUpdate {
  const updated = new Map<ServiceId, PlainUpdateService>();
  for (const [id, us] of su.services.updated) {
    updated.set(id, serializeUpdateService(us));
  }

  const preimages = new Map<ServiceId, PlainUpdatePreimage[]>();
  for (const [id, ups] of su.services.preimages) {
    preimages.set(id, ups.map(serializeUpdatePreimage));
  }

  const storage = new Map<ServiceId, PlainUpdateStorage[]>();
  for (const [id, uss] of su.services.storage) {
    storage.set(id, uss.map(serializeUpdateStorage));
  }

  const authorizationQueues = new Map<CoreIndex, Uint8Array[]>();
  for (const [core, queue] of su.authorizationQueues) {
    authorizationQueues.set(
      core,
      [...queue].map((h) => toRaw(h)),
    );
  }

  return {
    created: [...su.services.created],
    updated,
    removed: [...su.services.removed],
    preimages,
    storage,
    transfers: su.transfers.map(serializePendingTransfer),
    yieldedRoot: su.yieldedRoot !== null ? toRaw(su.yieldedRoot) : null,
    authorizationQueues,
    validatorsData:
      su.validatorsData !== null
        ? [...su.validatorsData].map((vd) => ({
            bandersnatch: toRaw(vd.bandersnatch),
            ed25519: toRaw(vd.ed25519),
            bls: toRaw(vd.bls),
            metadata: toRaw(vd.metadata),
          }))
        : null,
    privilegedServices: su.privilegedServices !== null ? serializePrivilegedServices(su.privilegedServices) : null,
  };
}

/**
 * Serialize a full InMemoryService including all its data.
 * Falls back to info-only for non-InMemoryService implementations.
 */
export function serializeService(service: Service): PlainService {
  const info = serializeServiceAccountInfo(service.getInfo());

  if (service instanceof InMemoryService) {
    const preimages: [Uint8Array, PlainPreimageItem][] = [];
    for (const [hash, item] of service.data.preimages.entries()) {
      preimages.push([toRaw(hash), { hash: toRaw(item.hash), blob: toRaw(item.blob) }]);
    }

    const lookupHistory: [Uint8Array, PlainLookupHistoryItem[]][] = [];
    for (const [hash, items] of service.data.lookupHistory.entries()) {
      lookupHistory.push([toRaw(hash), items.map(serializeLookupHistoryItem)]);
    }

    const storage: [string, PlainStorageItem][] = [];
    for (const [key, item] of service.data.storage) {
      storage.push([key, { key: toRaw(item.key), value: toRaw(item.value) }]);
    }

    return { serviceId: service.serviceId, info, preimages, lookupHistory, storage };
  }

  return { serviceId: service.serviceId, info, preimages: [], lookupHistory: [], storage: [] };
}

// ── Deserializers ────────────────────────────────────────────────────────────

function bytesFromRaw<T extends number>(raw: Uint8Array, len: T) {
  return Bytes.fromBlob(raw, len);
}

function hashFromRaw(raw: Uint8Array) {
  return bytesFromRaw(raw, HASH_SIZE);
}

export function deserializeServiceAccountInfo(p: PlainServiceAccountInfo): ServiceAccountInfo {
  return ServiceAccountInfo.create({
    codeHash: hashFromRaw(p.codeHash).asOpaque<CodeHash>(),
    balance: p.balance,
    accumulateMinGas: p.accumulateMinGas,
    onTransferMinGas: p.onTransferMinGas,
    storageUtilisationBytes: p.storageUtilisationBytes,
    gratisStorage: p.gratisStorage,
    storageUtilisationCount: p.storageUtilisationCount,
    created: p.created,
    lastAccumulation: p.lastAccumulation,
    parentService: p.parentService,
  });
}

function deserializeLookupHistoryItem(p: PlainLookupHistoryItem): LookupHistoryItem {
  return new LookupHistoryItem(
    hashFromRaw(p.hash).asOpaque<PreimageHash>(),
    p.length,
    tryAsLookupHistorySlots(p.slots),
  );
}

export function deserializePendingTransfer(p: PlainPendingTransfer): PendingTransfer {
  return PendingTransfer.create({
    source: p.source,
    destination: p.destination,
    amount: p.amount,
    memo: bytesFromRaw(p.memo, 32 as TRANSFER_MEMO_BYTES),
    gas: p.gas,
  });
}

export function deserializeOperand(p: PlainOperand): Operand {
  return Operand.new({
    hash: hashFromRaw(p.hash).asOpaque<WorkPackageHash>(),
    exportsRoot: hashFromRaw(p.exportsRoot).asOpaque<ExportsRootHash>(),
    authorizerHash: hashFromRaw(p.authorizerHash).asOpaque<AuthorizerHash>(),
    payloadHash: hashFromRaw(p.payloadHash).asOpaque<OpaqueHash>(),
    gas: p.gas,
    result:
      p.result.kind === WorkExecResultKind.ok
        ? WorkExecResult.ok(BytesBlob.blobFrom(p.result.okBlob ?? new Uint8Array()))
        : WorkExecResult.error(p.result.kind as Exclude<WorkExecResultKind, WorkExecResultKind.ok>),
    authorizationOutput: BytesBlob.blobFrom(p.authorizationOutput),
  });
}

function deserializeUpdatePreimage(p: PlainUpdatePreimage): UpdatePreimage {
  switch (p.kind) {
    case UpdatePreimageKind.Provide:
      return UpdatePreimage.provide({
        preimage: PreimageItem.create({
          hash: hashFromRaw(p.preimage.hash).asOpaque<PreimageHash>(),
          blob: BytesBlob.blobFrom(p.preimage.blob),
        }),
        slot: p.slot,
        providedFor: p.providedFor,
      });
    case UpdatePreimageKind.Remove:
      return UpdatePreimage.remove({
        hash: hashFromRaw(p.hash).asOpaque<PreimageHash>(),
        length: p.length,
      });
    case UpdatePreimageKind.UpdateOrAdd:
      return UpdatePreimage.updateOrAdd({
        lookupHistory: deserializeLookupHistoryItem(p.item),
      });
  }
}

function deserializeUpdateService(p: PlainUpdateService): UpdateService {
  if (p.kind === UpdateServiceKind.Create) {
    return UpdateService.create({
      serviceInfo: deserializeServiceAccountInfo(p.account),
      lookupHistory: p.lookupHistory !== null ? deserializeLookupHistoryItem(p.lookupHistory) : null,
    });
  }
  return UpdateService.update({
    serviceInfo: deserializeServiceAccountInfo(p.account),
  });
}

function deserializeUpdateStorage(p: PlainUpdateStorage): UpdateStorage {
  if (p.kind === UpdateStorageKind.Set) {
    return UpdateStorage.set({
      storage: StorageItem.create({
        key: BytesBlob.blobFrom(p.storage.key) as StorageKey,
        value: BytesBlob.blobFrom(p.storage.value),
      }),
    });
  }
  return UpdateStorage.remove({ key: BytesBlob.blobFrom(p.key) as StorageKey });
}

export function deserializePrivilegedServices(p: PlainPrivilegedServices): PrivilegedServices {
  return PrivilegedServices.create({
    manager: p.manager,
    delegator: p.delegator,
    registrar: p.registrar,
    assigners: asKnownSize(p.assigners),
    autoAccumulateServices: new Map(p.autoAccumulateServices),
  });
}

export function deserializeAccumulationStateUpdate(p: PlainAccumulationStateUpdate): AccumulationStateUpdate {
  const su = AccumulationStateUpdate.empty();

  su.services.created.push(...p.created);
  su.services.removed.push(...p.removed);

  for (const [id, pus] of p.updated) {
    su.services.updated.set(id, deserializeUpdateService(pus));
  }
  for (const [id, pups] of p.preimages) {
    su.services.preimages.set(id, pups.map(deserializeUpdatePreimage));
  }
  for (const [id, puss] of p.storage) {
    su.services.storage.set(id, puss.map(deserializeUpdateStorage));
  }

  su.transfers.push(...p.transfers.map(deserializePendingTransfer));
  su.yieldedRoot = p.yieldedRoot !== null ? hashFromRaw(p.yieldedRoot).asOpaque<OpaqueHash>() : null;

  for (const [core, queue] of p.authorizationQueues) {
    su.authorizationQueues.set(
      core,
      asKnownSize(queue.map((h) => hashFromRaw(h).asOpaque<AuthorizerHash>())) as FixedSizeArray<
        AuthorizerHash,
        AUTHORIZATION_QUEUE_SIZE
      >,
    );
  }

  if (p.validatorsData !== null) {
    su.validatorsData = asKnownSize(
      p.validatorsData.map((d) =>
        ValidatorData.create({
          bandersnatch: Bytes.fromBlob(d.bandersnatch, BANDERSNATCH_KEY_BYTES).asOpaque(),
          ed25519: Bytes.fromBlob(d.ed25519, ED25519_KEY_BYTES).asOpaque(),
          bls: Bytes.fromBlob(d.bls, BLS_KEY_BYTES).asOpaque(),
          metadata: Bytes.fromBlob(d.metadata, VALIDATOR_META_BYTES),
        }),
      ),
    ) as PerValidator<ValidatorData>;
  }

  if (p.privilegedServices !== null) {
    su.privilegedServices = deserializePrivilegedServices(p.privilegedServices);
  }

  return su;
}

/**
 * Reconstruct a Service-like object from PlainService.
 * Returns an object implementing the Service interface for use in PartiallyUpdatedState.
 */
export function deserializeService(p: PlainService): Service {
  const info = deserializeServiceAccountInfo(p.info);

  const preimageMap = new Map<string, { hash: PreimageHash; blob: BytesBlob }>();
  for (const [hashRaw, pi] of p.preimages) {
    const hash = hashFromRaw(hashRaw).asOpaque<PreimageHash>();
    preimageMap.set(hash.toString(), { hash, blob: BytesBlob.blobFrom(pi.blob) });
  }

  const lookupMap = new Map<string, LookupHistoryItem[]>();
  for (const [hashRaw, items] of p.lookupHistory) {
    const hash = hashFromRaw(hashRaw);
    lookupMap.set(hash.toString(), items.map(deserializeLookupHistoryItem));
  }

  const storageMap = new Map<string, BytesBlob>();
  for (const [key, si] of p.storage) {
    storageMap.set(key, BytesBlob.blobFrom(si.value));
  }

  return {
    serviceId: p.serviceId,
    getInfo: () => info,
    getStorage: (rawKey) => storageMap.get(rawKey.toString()) ?? null,
    hasPreimage: (hash) => preimageMap.has(hash.toString()),
    getPreimage: (hash) => preimageMap.get(hash.toString())?.blob ?? null,
    getLookupHistory: (hash, len) => {
      const items = lookupMap.get(hash.toString());
      if (items === undefined) {
        return null;
      }
      const found = items.find((x) => x.length === len);
      return found?.slots ?? null;
    },
  };
}

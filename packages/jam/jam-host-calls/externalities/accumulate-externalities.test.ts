import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  type CodeHash,
  type ServiceGas,
  type ServiceId,
  tryAsCoreIndex,
  tryAsServiceGas,
  tryAsServiceId,
  tryAsTimeSlot,
} from "@typeberry/block";
import { AUTHORIZATION_QUEUE_SIZE } from "@typeberry/block/gp-constants.js";
import type { PreimageHash } from "@typeberry/block/preimage.js";
import { Bytes, BytesBlob } from "@typeberry/bytes";
import { FixedSizeArray, HashDictionary, asKnownSize } from "@typeberry/collections";
import { tinyChainSpec } from "@typeberry/config";
import { BANDERSNATCH_KEY_BYTES, BLS_KEY_BYTES, ED25519_KEY_BYTES } from "@typeberry/crypto";
import { HASH_SIZE, type OpaqueHash, blake2b } from "@typeberry/hash";
import { type U32, type U64, tryAsU32, tryAsU64 } from "@typeberry/numbers";
import {
  AutoAccumulate,
  InMemoryService,
  InMemoryState,
  LookupHistoryItem,
  type LookupHistorySlots,
  PreimageItem,
  PrivilegedServices,
  type Service,
  ServiceAccountInfo,
  StorageItem,
  UpdatePreimage,
  UpdateService,
  VALIDATOR_META_BYTES,
  ValidatorData,
  tryAsLookupHistorySlots,
  tryAsPerCore,
} from "@typeberry/state";
import { testState } from "@typeberry/state/test.utils.js";
import { Compatibility, GpVersion, OK, Result, deepEqual, ensure } from "@typeberry/utils";
import { writeServiceIdAsLeBytes } from "../utils.js";
import { AccumulateExternalities } from "./accumulate-externalities.js";
import {
  EjectError,
  ForgetPreimageError,
  NewServiceError,
  PreimageStatusKind,
  ProvidePreimageError,
  RequestPreimageError,
  TRANSFER_MEMO_BYTES,
  TransferError,
} from "./partial-state.js";
import { PendingTransfer } from "./pending-transfer.js";
import { PartiallyUpdatedState } from "./state-update.js";

function partiallyUpdatedState() {
  return new PartiallyUpdatedState(testState());
}

describe("PartialState.checkPreimageStatus", () => {
  it("should check preimage status from state", () => {
    const state = partiallyUpdatedState();
    const partialState = new AccumulateExternalities(
      tinyChainSpec,
      state,
      tryAsServiceId(0),
      tryAsServiceId(10),
      tryAsTimeSlot(16),
    );
    const preimageHash = Bytes.parseBytes(
      "0xc16326432b5b3213dfd1609495e13c6b276cb474d679645337e5c2c09f19b53c",
      HASH_SIZE,
    ).asOpaque();

    const status = partialState.checkPreimageStatus(preimageHash, tryAsU64(35));
    assert.deepStrictEqual(status, {
      status: PreimageStatusKind.Available,
      data: [0],
    });
  });

  it("should return preimage status when its in updated state", () => {
    const state = partiallyUpdatedState();
    const serviceId = tryAsServiceId(0);
    const partialState = new AccumulateExternalities(
      tinyChainSpec,
      state,
      serviceId,
      tryAsServiceId(10),
      tryAsTimeSlot(16),
    );

    const preimageHash = Bytes.parseBytes(
      "0xc16326432b5b3213dfd1609495e13c6b276cb474d679645337e5c2c09f19b53c",
      HASH_SIZE,
    ).asOpaque();
    const length = tryAsU64(35);

    state.stateUpdate.services.preimages.push(
      UpdatePreimage.updateOrAdd({
        serviceId,
        lookupHistory: new LookupHistoryItem(preimageHash, tryAsU32(Number(length)), tryAsLookupHistorySlots([])),
      }),
    );

    const status = partialState.checkPreimageStatus(preimageHash, length);
    assert.deepStrictEqual(status, {
      status: PreimageStatusKind.Requested,
    });
  });
});

describe("PartialState.requestPreimage", () => {
  it("should request a preimage and update service info", () => {
    const state = partiallyUpdatedState();
    const serviceId = tryAsServiceId(0);
    const maybeService = state.state.services.get(serviceId);
    const service = ensure<Service | undefined, Service>(maybeService, maybeService !== undefined);

    const partialState = new AccumulateExternalities(
      tinyChainSpec,
      state,
      serviceId,
      tryAsServiceId(10),
      tryAsTimeSlot(16),
    );
    const preimageHash = Bytes.fill(HASH_SIZE, 0xa).asOpaque();

    const status = partialState.requestPreimage(preimageHash, tryAsU64(5));
    assert.deepStrictEqual(status, Result.ok(OK));

    assert.deepStrictEqual(state.stateUpdate.services.preimages, [
      UpdatePreimage.updateOrAdd({
        serviceId,
        lookupHistory: new LookupHistoryItem(preimageHash, tryAsU32(5), tryAsLookupHistorySlots([])),
      }),
    ]);
    assert.deepStrictEqual(state.stateUpdate.services.servicesUpdates, [
      UpdateService.update({
        serviceId,
        serviceInfo: ServiceAccountInfo.create({
          ...service.getInfo(),
          storageUtilisationBytes: tryAsU64(service.getInfo().storageUtilisationBytes + 5n + 81n),
          storageUtilisationCount: tryAsU32(service.getInfo().storageUtilisationCount + 2),
        }),
      }),
    ]);
  });

  it("should request a preimage and update service info", () => {
    const state = partiallyUpdatedState();
    const serviceId = tryAsServiceId(0);
    const maybeService = state.state.services.get(serviceId);
    const service = ensure<Service | undefined, Service>(maybeService, maybeService !== undefined);

    const partialState = new AccumulateExternalities(
      tinyChainSpec,
      state,
      tryAsServiceId(0),
      tryAsServiceId(10),
      tryAsTimeSlot(16),
    );
    const preimageHash = Bytes.fill(HASH_SIZE, 0xa).asOpaque();

    const status = partialState.requestPreimage(preimageHash, tryAsU64(5));
    assert.deepStrictEqual(status, Result.ok(OK));

    assert.deepStrictEqual(state.stateUpdate.services.preimages, [
      UpdatePreimage.updateOrAdd({
        serviceId,
        lookupHistory: new LookupHistoryItem(preimageHash, tryAsU32(5), tryAsLookupHistorySlots([])),
      }),
    ]);
    assert.deepStrictEqual(state.stateUpdate.services.servicesUpdates, [
      UpdateService.update({
        serviceId,
        serviceInfo: ServiceAccountInfo.create({
          ...service.getInfo(),
          storageUtilisationBytes: tryAsU64(service.getInfo().storageUtilisationBytes + 5n + 81n),
          storageUtilisationCount: tryAsU32(service.getInfo().storageUtilisationCount + 2),
        }),
      }),
    ]);
  });

  it("should fail if preimage is already requested", () => {
    const state = partiallyUpdatedState();
    const partialState = new AccumulateExternalities(
      tinyChainSpec,
      state,
      tryAsServiceId(0),
      tryAsServiceId(10),
      tryAsTimeSlot(16),
    );
    const preimageHash = Bytes.fill(HASH_SIZE, 0xa).asOpaque();

    const status = partialState.requestPreimage(preimageHash, tryAsU64(5));
    assert.deepStrictEqual(status, Result.ok(OK));

    const status2 = partialState.requestPreimage(preimageHash, tryAsU64(5));
    assert.deepStrictEqual(status2, Result.error(RequestPreimageError.AlreadyRequested));
  });

  it("should fail if preimage is already available", () => {
    const state = partiallyUpdatedState();
    const partialState = new AccumulateExternalities(
      tinyChainSpec,
      state,
      tryAsServiceId(0),
      tryAsServiceId(10),
      tryAsTimeSlot(16),
    );
    const preimageHash = Bytes.parseBytes(
      "0xc16326432b5b3213dfd1609495e13c6b276cb474d679645337e5c2c09f19b53c",
      HASH_SIZE,
    ).asOpaque();

    const status = partialState.requestPreimage(preimageHash, tryAsU64(35));
    assert.deepStrictEqual(status, Result.error(RequestPreimageError.AlreadyAvailable));
  });

  it("should fail if balance is insufficient", () => {
    const state = partiallyUpdatedState();
    const partialState = new AccumulateExternalities(
      tinyChainSpec,
      state,
      tryAsServiceId(0),
      tryAsServiceId(10),
      tryAsTimeSlot(16),
    );
    const preimageHash = Bytes.fill(HASH_SIZE, 0xa).asOpaque();

    const status = partialState.requestPreimage(preimageHash, tryAsU64(2n ** 64n - 1n));
    assert.deepStrictEqual(status, Result.error(RequestPreimageError.InsufficientFunds));
  });
});

describe("PartialState.forgetPreimage", () => {
  it("should error if preimage does not exist", () => {
    const state = partiallyUpdatedState();
    const partialState = new AccumulateExternalities(
      tinyChainSpec,
      state,
      tryAsServiceId(0),
      tryAsServiceId(10),
      tryAsTimeSlot(16),
    );
    const hash = Bytes.fill(HASH_SIZE, 0x01).asOpaque();

    const result = partialState.forgetPreimage(hash, tryAsU64(42));
    assert.deepStrictEqual(result, Result.error(ForgetPreimageError.NotFound));
  });

  it("should error if preimage is already forgotten", () => {
    const state = partiallyUpdatedState();
    const serviceId = tryAsServiceId(0);
    const hash = Bytes.parseBytes(
      "0xc16326432b5b3213dfd1609495e13c6b276cb474d679645337e5c2c09f19b53c",
      HASH_SIZE,
    ).asOpaque();
    const length = tryAsU64(35);

    const partialState = new AccumulateExternalities(
      tinyChainSpec,
      state,
      serviceId,
      tryAsServiceId(10),
      tryAsTimeSlot(50),
    );
    state.stateUpdate.services.preimages.push(
      UpdatePreimage.updateOrAdd({
        serviceId,
        lookupHistory: new LookupHistoryItem(
          hash,
          tryAsU32(Number(length)),
          tryAsLookupHistorySlots([tryAsTimeSlot(0), tryAsTimeSlot(1)]),
        ),
      }),
    );

    const result1 = partialState.forgetPreimage(hash, length);
    assert.deepStrictEqual(result1, Result.ok(OK));

    state.state.applyUpdate(state.stateUpdate.services);

    const result2 = partialState.forgetPreimage(hash, length);
    assert.deepStrictEqual(result2, Result.error(ForgetPreimageError.NotFound));
  });

  it("should forget a requested preimage", () => {
    const state = partiallyUpdatedState();
    const serviceId = tryAsServiceId(0);
    const hash = Bytes.fill(HASH_SIZE, 0x03).asOpaque();
    const length = tryAsU64(42);

    const partialState = new AccumulateExternalities(
      tinyChainSpec,
      state,
      serviceId,
      tryAsServiceId(10),
      tryAsTimeSlot(16),
    );
    partialState.requestPreimage(hash, length);

    const result = partialState.forgetPreimage(hash, length);
    assert.deepStrictEqual(result, Result.ok(OK));

    assert.deepStrictEqual(state.stateUpdate.services.preimages, [
      UpdatePreimage.updateOrAdd({
        serviceId,
        lookupHistory: new LookupHistoryItem(hash, tryAsU32(Number(length)), tryAsLookupHistorySlots([])),
      }),
      UpdatePreimage.remove({
        serviceId,
        hash,
        length: tryAsU32(Number(length)),
      }),
    ]);
  });

  it("should forget an unavailable preimage if it is old enough", () => {
    const state = partiallyUpdatedState();
    state.state.applyUpdate({
      timeslot: tryAsTimeSlot(100000),
    });

    const hash = Bytes.fill(HASH_SIZE, 0x04).asOpaque();
    const length = tryAsU64(42);
    const oldSlot = tryAsTimeSlot(0); // very old

    const partialState = new AccumulateExternalities(
      tinyChainSpec,
      state,
      tryAsServiceId(0),
      tryAsServiceId(10),
      tryAsTimeSlot(50),
    );
    state.stateUpdate.services.preimages.push(
      UpdatePreimage.updateOrAdd({
        serviceId: tryAsServiceId(0),
        lookupHistory: new LookupHistoryItem(
          hash,
          tryAsU32(Number(length)),
          tryAsLookupHistorySlots([oldSlot, oldSlot]),
        ),
      }),
    );

    const result = partialState.forgetPreimage(hash, length);
    assert.deepStrictEqual(result, Result.ok(OK));

    assert.deepStrictEqual(state.stateUpdate.services.preimages, [
      UpdatePreimage.updateOrAdd({
        serviceId: tryAsServiceId(0),
        lookupHistory: new LookupHistoryItem(
          hash,
          tryAsU32(Number(length)),
          tryAsLookupHistorySlots([oldSlot, oldSlot]),
        ),
      }),
      UpdatePreimage.remove({
        serviceId: tryAsServiceId(0),
        hash,
        length: tryAsU32(Number(length)),
      }),
    ]);
  });

  it("should not forget an unavailable preimage if it is recent", () => {
    const state = partiallyUpdatedState();
    state.state.applyUpdate({
      timeslot: tryAsTimeSlot(100),
    });

    const hash = Bytes.fill(HASH_SIZE, 0x05).asOpaque();
    const length = tryAsU64(42);
    const recentSlot = tryAsTimeSlot(90); // within expunge period

    const partialState = new AccumulateExternalities(
      tinyChainSpec,
      state,
      tryAsServiceId(0),
      tryAsServiceId(10),
      tryAsTimeSlot(16),
    );
    state.stateUpdate.services.preimages.push(
      UpdatePreimage.updateOrAdd({
        serviceId: tryAsServiceId(0),
        lookupHistory: new LookupHistoryItem(hash, tryAsU32(Number(length)), tryAsLookupHistorySlots([recentSlot])),
      }),
    );

    const result = partialState.forgetPreimage(hash, length);
    assert.deepStrictEqual(result, Result.ok(OK));
  });

  it("should update lookup history for available preimage", () => {
    const state = partiallyUpdatedState();
    state.state.applyUpdate({
      timeslot: tryAsTimeSlot(100),
    });

    const hash = Bytes.fill(HASH_SIZE, 0x06).asOpaque();
    const length = tryAsU64(42);
    const availableSlot = tryAsTimeSlot(80);

    const partialState = new AccumulateExternalities(
      tinyChainSpec,
      state,
      tryAsServiceId(0),
      tryAsServiceId(10),
      tryAsTimeSlot(100),
    );
    state.stateUpdate.services.preimages.push(
      UpdatePreimage.updateOrAdd({
        serviceId: tryAsServiceId(0),
        lookupHistory: new LookupHistoryItem(hash, tryAsU32(Number(length)), tryAsLookupHistorySlots([availableSlot])),
      }),
    );

    const result = partialState.forgetPreimage(hash, length);
    assert.deepStrictEqual(result, Result.ok(OK));

    assert.deepStrictEqual(state.stateUpdate.services.preimages, [
      UpdatePreimage.updateOrAdd({
        serviceId: tryAsServiceId(0),
        lookupHistory: new LookupHistoryItem(hash, tryAsU32(Number(length)), tryAsLookupHistorySlots([availableSlot])),
      }),
      UpdatePreimage.updateOrAdd({
        serviceId: tryAsServiceId(0),
        lookupHistory: new LookupHistoryItem(
          hash,
          tryAsU32(Number(length)),
          tryAsLookupHistorySlots([availableSlot, state.state.timeslot]),
        ),
      }),
    ]);
  });

  it("should update history for reavailable preimage if old", () => {
    const state = partiallyUpdatedState();
    state.state.applyUpdate({
      timeslot: tryAsTimeSlot(100000),
    });

    const hash = Bytes.fill(HASH_SIZE, 0x07).asOpaque();
    const length = tryAsU64(42);
    const y = tryAsTimeSlot(0);
    const z = tryAsTimeSlot(70);

    const partialState = new AccumulateExternalities(
      tinyChainSpec,
      state,
      tryAsServiceId(0),
      tryAsServiceId(10),
      tryAsTimeSlot(100000),
    );
    state.stateUpdate.services.preimages.push(
      UpdatePreimage.updateOrAdd({
        serviceId: tryAsServiceId(0),
        lookupHistory: new LookupHistoryItem(
          hash,
          tryAsU32(Number(length)),
          tryAsLookupHistorySlots([tryAsTimeSlot(0), y, z]),
        ),
      }),
    );

    const result = partialState.forgetPreimage(hash, length);
    assert.deepStrictEqual(result, Result.ok(OK));

    assert.deepStrictEqual(state.stateUpdate.services.preimages, [
      UpdatePreimage.updateOrAdd({
        serviceId: tryAsServiceId(0),
        lookupHistory: new LookupHistoryItem(
          hash,
          tryAsU32(Number(length)),
          tryAsLookupHistorySlots([tryAsTimeSlot(0), y, z]),
        ),
      }),
      UpdatePreimage.updateOrAdd({
        serviceId: tryAsServiceId(0),
        lookupHistory: new LookupHistoryItem(
          hash,
          tryAsU32(Number(length)),
          tryAsLookupHistorySlots([z, state.state.timeslot]),
        ),
      }),
    ]);
  });

  it("should not forget reavailable preimage if too recent", () => {
    const state = partiallyUpdatedState();
    state.state.applyUpdate({
      timeslot: tryAsTimeSlot(100),
    });

    const hash = Bytes.fill(HASH_SIZE, 0x08).asOpaque();
    const length = tryAsU64(42);
    const y = tryAsTimeSlot(95); // too recent
    const z = tryAsTimeSlot(70);

    const partialState = new AccumulateExternalities(
      tinyChainSpec,
      state,
      tryAsServiceId(0),
      tryAsServiceId(10),
      tryAsTimeSlot(100),
    );
    state.stateUpdate.services.preimages.push(
      UpdatePreimage.updateOrAdd({
        serviceId: tryAsServiceId(0),
        lookupHistory: new LookupHistoryItem(
          hash,
          tryAsU32(Number(length)),
          tryAsLookupHistorySlots([tryAsTimeSlot(0), y, z]),
        ),
      }),
    );

    const result = partialState.forgetPreimage(hash, length);
    assert.deepStrictEqual(result, Result.error(ForgetPreimageError.NotExpired));
  });

  it("should not forget unavailable preimage if too recent", () => {
    const state = partiallyUpdatedState();

    const hash = Bytes.fill(HASH_SIZE, 0x08).asOpaque();
    const length = tryAsU64(42);

    const partialState = new AccumulateExternalities(
      tinyChainSpec,
      state,
      tryAsServiceId(0),
      tryAsServiceId(10),
      tryAsTimeSlot(2),
    );
    state.stateUpdate.services.preimages.push(
      UpdatePreimage.updateOrAdd({
        serviceId: tryAsServiceId(0),
        lookupHistory: new LookupHistoryItem(
          hash,
          tryAsU32(Number(length)),
          tryAsLookupHistorySlots([tryAsTimeSlot(0), tryAsTimeSlot(1)]),
        ),
      }),
    );

    const result = partialState.forgetPreimage(hash, length);
    assert.deepStrictEqual(result, Result.error(ForgetPreimageError.NotExpired));
  });
});

describe("PartialState.newService", () => {
  const itPost067 = Compatibility.isGreaterOrEqual(GpVersion.V0_6_7) ? it : it.skip;
  it("should create a new service and update balance + next service ID", () => {
    const state = partiallyUpdatedState();
    const maybeService = state.state.services.get(tryAsServiceId(0));
    const service = ensure<InMemoryService | undefined, InMemoryService>(maybeService, maybeService !== undefined);

    const partialState = new AccumulateExternalities(
      tinyChainSpec,
      state,
      tryAsServiceId(0),
      tryAsServiceId(10),
      tryAsTimeSlot(16),
    );

    const codeHash = Bytes.fill(HASH_SIZE, 0x11).asOpaque();
    const codeLength = tryAsU32(100);
    const codeLengthU64 = tryAsU64(codeLength);
    const accumulateMinGas = tryAsServiceGas(10n);
    const onTransferMinGas = tryAsServiceGas(20n);
    // NOTE compatibility is neede here, as we are using `calculateThresholdBalance`
    // which throws an error when `gratisStorage > 0` is provided for GP versions earlier than 0.6.7.
    const gratisStorage = Compatibility.isGreaterOrEqual(GpVersion.V0_6_7) ? tryAsU64(50) : tryAsU64(0);

    const items = tryAsU32(2); // 2 * 1 + 0
    const bytes = tryAsU64(81 + codeLength);
    const thresholdForNew = ServiceAccountInfo.calculateThresholdBalance(items, bytes, gratisStorage);
    const expectedBalance = tryAsU64(service.data.info.balance - thresholdForNew);

    // when
    const result = partialState.newService(codeHash, codeLengthU64, accumulateMinGas, onTransferMinGas, gratisStorage);

    // then
    const expectedServiceId = tryAsServiceId(10);

    assert.deepStrictEqual(result, Result.ok(expectedServiceId));

    // Verify service updates
    assert.deepStrictEqual(state.stateUpdate.services.servicesUpdates, [
      UpdateService.update({
        serviceId: tryAsServiceId(0),
        serviceInfo: ServiceAccountInfo.create({
          ...service.data.info,
          balance: expectedBalance,
        }),
      }),
      UpdateService.create({
        serviceId: expectedServiceId,
        serviceInfo: ServiceAccountInfo.create({
          codeHash,
          balance: thresholdForNew,
          accumulateMinGas,
          onTransferMinGas,
          storageUtilisationBytes: bytes,
          gratisStorage: gratisStorage,
          storageUtilisationCount: items,
          created: tryAsTimeSlot(16),
          lastAccumulation: tryAsTimeSlot(0),
          parentService: service.serviceId,
        }),
        lookupHistory: new LookupHistoryItem(codeHash, codeLength, tryAsLookupHistorySlots([])),
      }),
    ]);

    // Verify next service ID bumped
    assert.deepStrictEqual(partialState.getNextNewServiceId(), tryAsServiceId(4294966836));
  });

  it("should return an error if there are insufficient funds", () => {
    const state = partiallyUpdatedState();
    const maybeService = state.state.services.get(tryAsServiceId(0));
    const service = ensure<InMemoryService | undefined, InMemoryService>(maybeService, maybeService !== undefined);

    const updatedService = new InMemoryService(service.serviceId, {
      ...service.data,
      info: ServiceAccountInfo.create({
        ...service.data.info,
        // lower the balance a bit
        balance: tryAsU64(2 ** 24),
      }),
    });
    state.state.services.set(tryAsServiceId(0), updatedService);

    const partialState = new AccumulateExternalities(
      tinyChainSpec,
      state,
      tryAsServiceId(0),
      tryAsServiceId(10),
      tryAsTimeSlot(16),
    );

    const codeHash = Bytes.fill(HASH_SIZE, 0x12).asOpaque();
    // artificially large to exceed balance
    const codeLength = tryAsU64(2 ** 32 + 1);
    const accumulateMinGas = tryAsServiceGas(10n);
    const onTransferMinGas = tryAsServiceGas(20n);
    // NOTE compatibility is needed since newService uses calculateThresholdBalance internally
    const gratisStorage = Compatibility.isGreaterOrEqual(GpVersion.V0_6_7) ? tryAsU64(1024) : tryAsU64(0);

    // when
    const result = partialState.newService(codeHash, codeLength, accumulateMinGas, onTransferMinGas, gratisStorage);

    // then
    assert.deepStrictEqual(result, Result.error(NewServiceError.InsufficientFunds));

    // Verify no side effects
    assert.deepStrictEqual(state.stateUpdate.services.servicesUpdates, []);
  });

  itPost067("should return an error if service is unprivileged to set gratis storage", () => {
    const state = partiallyUpdatedState();
    // setting different service than our privileged manager
    state.stateUpdate.privilegedServices = {
      ...state.state.privilegedServices,
      manager: tryAsServiceId(1),
    };
    const maybeService = state.state.services.get(tryAsServiceId(0));
    const service = ensure<InMemoryService | undefined, InMemoryService>(maybeService, maybeService !== undefined);

    const updatedService = new InMemoryService(service.serviceId, {
      ...service.data,
      info: ServiceAccountInfo.create({
        ...service.data.info,
        balance: tryAsU64(2 ** 32),
      }),
    });
    state.state.services.set(tryAsServiceId(0), updatedService);

    const partialState = new AccumulateExternalities(
      tinyChainSpec,
      state,
      tryAsServiceId(0),
      tryAsServiceId(10),
      tryAsTimeSlot(16),
    );

    const codeHash = Bytes.fill(HASH_SIZE, 0x12).asOpaque();
    const codeLength = tryAsU64(1024);
    const accumulateMinGas = tryAsServiceGas(10n);
    const onTransferMinGas = tryAsServiceGas(20n);
    // setting gratisStorage
    const gratisStorage = tryAsU64(1024);

    // when
    const result = partialState.newService(codeHash, codeLength, accumulateMinGas, onTransferMinGas, gratisStorage);

    // then
    assert.deepStrictEqual(result, Result.error(NewServiceError.UnprivilegedService));

    // Verify no side effects
    assert.deepStrictEqual(state.stateUpdate.services.servicesUpdates, []);
  });
});

describe("PartialState.updateValidatorsData", () => {
  it("should update validators data", () => {
    const state = partiallyUpdatedState();
    const partialState = new AccumulateExternalities(
      tinyChainSpec,
      state,
      tryAsServiceId(0),
      tryAsServiceId(10),
      tryAsTimeSlot(16),
    );

    // when
    partialState.updateValidatorsData(
      asKnownSize([
        ValidatorData.create({
          bandersnatch: Bytes.fill(BANDERSNATCH_KEY_BYTES, 0x1).asOpaque(),
          ed25519: Bytes.fill(ED25519_KEY_BYTES, 0x2).asOpaque(),
          bls: Bytes.fill(BLS_KEY_BYTES, 0x3).asOpaque(),
          metadata: Bytes.fill(VALIDATOR_META_BYTES, 0x4).asOpaque(),
        }),
      ]),
    );

    // then
    assert.deepStrictEqual(state.stateUpdate.validatorsData?.length, 1);
  });
});

describe("PartialState.checkpoint", () => {
  it("should checkpoint the updates", () => {
    const state = partiallyUpdatedState();
    const partialState = new AccumulateExternalities(
      tinyChainSpec,
      state,
      tryAsServiceId(0),
      tryAsServiceId(10),
      tryAsTimeSlot(16),
    );
    const preimageHash = Bytes.fill(HASH_SIZE, 0xa).asOpaque();
    // put something into updated state
    const status = partialState.requestPreimage(preimageHash, tryAsU64(5));
    assert.deepStrictEqual(status, Result.ok(OK));

    // when
    partialState.checkpoint();

    // then
    assert.deepStrictEqual(partialState.getStateUpdates()[1], state.stateUpdate);
  });
});

describe("PartialState.upgradeService", () => {
  it("should update the service with new code hash and gas limits", () => {
    const state = partiallyUpdatedState();
    const maybeService = state.state.services.get(tryAsServiceId(0));
    const service = ensure<Service | undefined, Service>(maybeService, maybeService !== undefined);

    const partialState = new AccumulateExternalities(
      tinyChainSpec,
      state,
      tryAsServiceId(0),
      tryAsServiceId(10),
      tryAsTimeSlot(16),
    );

    const codeHash = Bytes.fill(HASH_SIZE, 0xcd).asOpaque();
    const gas = tryAsU64(1_000n);
    const allowance = tryAsU64(2_000n);

    // when
    partialState.upgradeService(codeHash, gas, allowance);

    // then
    assert.deepStrictEqual(state.stateUpdate.services.servicesUpdates, [
      UpdateService.update({
        serviceId: tryAsServiceId(0),
        serviceInfo: ServiceAccountInfo.create({
          ...service.getInfo(),
          codeHash,
          accumulateMinGas: tryAsServiceGas(gas),
          onTransferMinGas: tryAsServiceGas(allowance),
        }),
      }),
    ]);
  });
});

describe("PartialState.updateAuthorizationQueue", () => {
  it("should update the authorization queue for a given core index", () => {
    const state = partiallyUpdatedState();
    const partialState = new AccumulateExternalities(
      tinyChainSpec,
      state,
      tryAsServiceId(0),
      tryAsServiceId(10),
      tryAsTimeSlot(16),
    );

    const coreIndex = tryAsCoreIndex(0);
    const queue = FixedSizeArray.new(
      Array.from({ length: AUTHORIZATION_QUEUE_SIZE }, () => Bytes.fill(HASH_SIZE, 0xee).asOpaque()),
      AUTHORIZATION_QUEUE_SIZE,
    );

    // when
    partialState.updateAuthorizationQueue(coreIndex, queue);

    // then
    assert.deepStrictEqual(state.stateUpdate.authorizationQueues.get(coreIndex), queue);
  });
});

describe("PartialState.updatePrivilegedServices", () => {
  it("should update privileged services", () => {
    const state = partiallyUpdatedState();
    const partialState = new AccumulateExternalities(
      tinyChainSpec,
      state,
      tryAsServiceId(0),
      tryAsServiceId(10),
      tryAsTimeSlot(16),
    );

    const manager = tryAsServiceId(1);
    const authManager = tryAsPerCore(new Array(tinyChainSpec.coresCount).fill(tryAsServiceId(2)), tinyChainSpec);
    const validatorsManager = tryAsServiceId(3);
    const autoAccumulate: [ServiceId, ServiceGas][] = [
      [tryAsServiceId(4), tryAsServiceGas(10n)],
      [tryAsServiceId(5), tryAsServiceGas(20n)],
    ];

    // when
    partialState.updatePrivilegedServices(manager, authManager, validatorsManager, autoAccumulate);

    // then
    assert.deepStrictEqual(
      state.stateUpdate.privilegedServices,
      PrivilegedServices.create({
        manager,
        authManager,
        validatorsManager,
        autoAccumulateServices: autoAccumulate.map(([service, gasLimit]) =>
          AutoAccumulate.create({ gasLimit, service }),
        ),
      }),
    );
  });
});

describe("PartialState.transfer", () => {
  const partiallyUpdatedStateWithSecondService = () => {
    const state = partiallyUpdatedState();
    const maybeService = state.state.services.get(tryAsServiceId(0));
    const service = ensure<InMemoryService | undefined, InMemoryService>(maybeService, maybeService !== undefined);
    state.state.services.set(
      tryAsServiceId(1),
      new InMemoryService(tryAsServiceId(1), {
        info: ServiceAccountInfo.create({
          ...service.data.info,
          onTransferMinGas: tryAsServiceGas(1000),
        }),
        preimages: HashDictionary.new(),
        lookupHistory: HashDictionary.new(),
        storage: HashDictionary.new(),
      }),
    );
    return {
      state,
      service,
    };
  };

  it("should perform a successful transfer", () => {
    const { state, service } = partiallyUpdatedStateWithSecondService();
    const partialState = new AccumulateExternalities(
      tinyChainSpec,
      state,
      tryAsServiceId(0),
      tryAsServiceId(10),
      tryAsTimeSlot(16),
    );

    const destinationId = tryAsServiceId(1);
    const amount = tryAsU64(500n);
    const gas = tryAsServiceGas(1_000n);
    const memo = Bytes.fill(TRANSFER_MEMO_BYTES, 0xaa);

    const newBalance = service.data.info.balance - amount;

    // when
    const result = partialState.transfer(destinationId, amount, gas, memo);

    // then
    assert.deepStrictEqual(result, Result.ok(OK));
    assert.deepStrictEqual(state.stateUpdate.transfers, [
      PendingTransfer.create({
        source: tryAsServiceId(0),
        destination: destinationId,
        amount,
        memo,
        gas,
      }),
    ]);
    assert.deepStrictEqual(state.stateUpdate.services.servicesUpdates, [
      UpdateService.update({
        serviceId: tryAsServiceId(0),
        serviceInfo: ServiceAccountInfo.create({
          ...service.data.info,
          balance: tryAsU64(newBalance),
        }),
      }),
    ]);
  });

  it("should return DestinationNotFound error if destination doesnt exist", () => {
    const { state } = partiallyUpdatedStateWithSecondService();
    const partialState = new AccumulateExternalities(
      tinyChainSpec,
      state,
      tryAsServiceId(0),
      tryAsServiceId(10),
      tryAsTimeSlot(16),
    );

    const amount = tryAsU64(100n);
    const gas = tryAsServiceGas(1_000n);
    const memo = Bytes.fill(TRANSFER_MEMO_BYTES, 0xbb);

    // when
    const result = partialState.transfer(tryAsServiceId(4), amount, gas, memo);

    // then
    assert.deepStrictEqual(result, Result.error(TransferError.DestinationNotFound));
  });

  it("should return GasTooLow error if gas is below destination's minimum", () => {
    const { state } = partiallyUpdatedStateWithSecondService();
    const partialState = new AccumulateExternalities(
      tinyChainSpec,
      state,
      tryAsServiceId(0),
      tryAsServiceId(10),
      tryAsTimeSlot(16),
    );

    const destinationId = tryAsServiceId(1);
    const amount = tryAsU64(100n);
    const gas = tryAsServiceGas(999n); // too low
    const memo = Bytes.fill(TRANSFER_MEMO_BYTES, 0xcc);

    // when
    const result = partialState.transfer(destinationId, amount, gas, memo);

    // then
    assert.deepStrictEqual(result, Result.error(TransferError.GasTooLow));
  });

  it("should return BalanceBelowThreshold error if balance would fall too low", () => {
    const { state } = partiallyUpdatedStateWithSecondService();
    const partialState = new AccumulateExternalities(
      tinyChainSpec,
      state,
      tryAsServiceId(0),
      tryAsServiceId(10),
      tryAsTimeSlot(16),
    );

    const destinationId = tryAsServiceId(1);
    const amount = tryAsU64(9_999_999_999n); // dangerously high
    const gas = tryAsServiceGas(1_000n);
    const memo = Bytes.fill(TRANSFER_MEMO_BYTES, 0xdd);

    // when
    const result = partialState.transfer(destinationId, amount, gas, memo);

    // then
    assert.deepStrictEqual(result, Result.error(TransferError.BalanceBelowThreshold));
  });
});

describe("PartialState.yield", () => {
  it("should yield root", () => {
    const currentServiceId = tryAsServiceId(0);
    const state = partiallyUpdatedState();
    const partialState = new AccumulateExternalities(
      tinyChainSpec,
      state,
      currentServiceId,
      tryAsServiceId(10),
      tryAsTimeSlot(16),
    );
    const expectedYieldedRoots = new Map<ServiceId, Bytes<32>>();
    expectedYieldedRoots.set(currentServiceId, Bytes.fill(HASH_SIZE, 0xef));
    // when
    partialState.yield(Bytes.fill(HASH_SIZE, 0xef));

    // then
    deepEqual(state.stateUpdate.yieldedRoots, expectedYieldedRoots);
  });
});

describe("PartialState.providePreimage", () => {
  const partiallyUpdatedStateWithSecondService = ({
    requested = false,
    available = false,
    self = false,
  }: {
    requested?: boolean;
    available?: boolean;
    self?: boolean;
  } = {}) => {
    const state = partiallyUpdatedState();
    const maybeService = state.state.services.get(tryAsServiceId(0));
    const service = ensure<InMemoryService | undefined, InMemoryService>(maybeService, maybeService !== undefined);

    const preimageBlob = BytesBlob.blobFromNumbers([0xaa, 0xbb, 0xcc, 0xdd]);
    const preimage = PreimageItem.create({
      hash: blake2b.hashBytes(preimageBlob).asOpaque(),
      blob: preimageBlob,
    });

    const preimages = HashDictionary.fromEntries(available ? [[preimage.hash, preimage]] : []);
    const lookupHistory = HashDictionary.fromEntries(
      requested
        ? [
            [
              preimage.hash,
              [new LookupHistoryItem(preimage.hash, tryAsU32(preimage.blob.length), tryAsLookupHistorySlots([]))],
            ],
          ]
        : [],
    );

    if (self) {
      // we need to replace the existing service
      state.state.services.set(
        service.serviceId,
        new InMemoryService(service.serviceId, {
          ...service.data,
          preimages,
          lookupHistory,
        }),
      );
    }

    const secondService = new InMemoryService(tryAsServiceId(1), {
      info: ServiceAccountInfo.create({
        ...service.data.info,
        onTransferMinGas: tryAsServiceGas(1000),
      }),
      preimages: self ? HashDictionary.new() : preimages,
      lookupHistory: self ? HashDictionary.new() : lookupHistory,
      storage: HashDictionary.new(),
    });
    state.state.services.set(secondService.serviceId, secondService);

    return {
      state,
      preimage,
    };
  };

  it("should provide a preimage for other service", () => {
    const { state, preimage } = partiallyUpdatedStateWithSecondService({
      self: false,
      requested: true,
    });

    const partialState = new AccumulateExternalities(
      tinyChainSpec,
      state,
      tryAsServiceId(0),
      tryAsServiceId(10),
      tryAsTimeSlot(16),
    );

    const serviceId = tryAsServiceId(1);
    assert.deepStrictEqual(state.stateUpdate.services.preimages.length, 0);

    // when
    const result = partialState.providePreimage(serviceId, preimage.blob);

    // then
    assert.deepStrictEqual(result, Result.ok(OK));
    assert.deepStrictEqual(state.stateUpdate.services.preimages, [
      UpdatePreimage.provide({
        serviceId: tryAsServiceId(1),
        preimage: PreimageItem.create({
          hash: preimage.hash,
          blob: preimage.blob,
        }),
        slot: state.state.timeslot,
      }),
    ]);
  });

  it("should provide a preimage for itself", () => {
    const { state, preimage } = partiallyUpdatedStateWithSecondService({ self: true, requested: true });

    const partialState = new AccumulateExternalities(
      tinyChainSpec,
      state,
      tryAsServiceId(0),
      tryAsServiceId(10),
      tryAsTimeSlot(16),
    );

    const serviceId = tryAsServiceId(0);
    assert.deepStrictEqual(state.stateUpdate.services.preimages.length, 0);

    // when
    const result = partialState.providePreimage(serviceId, preimage.blob);

    // then
    assert.deepStrictEqual(result, Result.ok(OK));
    assert.deepStrictEqual(state.stateUpdate.services.preimages, [
      UpdatePreimage.provide({
        serviceId: tryAsServiceId(0),
        preimage: PreimageItem.create({
          hash: preimage.hash,
          blob: preimage.blob,
        }),
        slot: state.state.timeslot,
      }),
    ]);
  });

  it("should return error if preimage was not requested", () => {
    const { state, preimage } = partiallyUpdatedStateWithSecondService({
      self: false,
      requested: false,
    });

    const partialState = new AccumulateExternalities(
      tinyChainSpec,
      state,
      tryAsServiceId(0),
      tryAsServiceId(10),
      tryAsTimeSlot(16),
    );

    const serviceId = tryAsServiceId(1);
    assert.deepStrictEqual(state.stateUpdate.services.preimages.length, 0);

    // when
    const result = partialState.providePreimage(serviceId, preimage.blob);

    // then
    assert.deepStrictEqual(result, Result.error(ProvidePreimageError.WasNotRequested));
    assert.deepStrictEqual(state.stateUpdate.services.preimages.length, 0);
  });

  it("should return error if preimage is requested and already available for other service", () => {
    const { state, preimage } = partiallyUpdatedStateWithSecondService({
      self: false,
      requested: true,
      available: true,
    });

    const partialState = new AccumulateExternalities(
      tinyChainSpec,
      state,
      tryAsServiceId(0),
      tryAsServiceId(10),
      tryAsTimeSlot(16),
    );
    state.stateUpdate.services.preimages.push(
      UpdatePreimage.provide({
        serviceId: tryAsServiceId(1),
        preimage: PreimageItem.create({
          hash: preimage.hash,
          blob: preimage.blob,
        }),
        slot: state.state.timeslot,
      }),
    );

    const serviceId = tryAsServiceId(1);

    // when
    const result = partialState.providePreimage(serviceId, preimage.blob);

    // then
    assert.deepStrictEqual(result, Result.error(ProvidePreimageError.WasNotRequested));
    assert.deepStrictEqual(state.stateUpdate.services.preimages, [
      UpdatePreimage.provide({
        serviceId: tryAsServiceId(1),
        preimage: PreimageItem.create({
          hash: preimage.hash,
          blob: preimage.blob,
        }),
        slot: state.state.timeslot,
      }),
    ]);
  });

  it("should return error if preimage is requested and already provided for self", () => {
    const { state, preimage } = partiallyUpdatedStateWithSecondService({
      self: true,
      requested: true,
      available: true,
    });

    const partialState = new AccumulateExternalities(
      tinyChainSpec,
      state,
      tryAsServiceId(0),
      tryAsServiceId(10),
      tryAsTimeSlot(16),
    );
    const serviceId = tryAsServiceId(0);

    // when
    const result = partialState.providePreimage(serviceId, preimage.blob);

    // then
    assert.deepStrictEqual(result, Result.error(ProvidePreimageError.AlreadyProvided));
    assert.deepStrictEqual(state.stateUpdate.services.preimages, []);
  });

  it("should return ok and then error if preimage is provided twice for self", () => {
    const { state, preimage } = partiallyUpdatedStateWithSecondService({
      self: true,
      requested: true,
      available: false,
    });

    const partialState = new AccumulateExternalities(
      tinyChainSpec,
      state,
      tryAsServiceId(0),
      tryAsServiceId(10),
      tryAsTimeSlot(16),
    );

    const serviceId = tryAsServiceId(0);
    assert.deepStrictEqual(state.stateUpdate.services.preimages, []);

    // when
    const resultok = partialState.providePreimage(serviceId, preimage.blob);
    const resulterr = partialState.providePreimage(serviceId, preimage.blob);

    // then
    assert.deepStrictEqual(resultok, Result.ok(OK));
    assert.deepStrictEqual(resulterr, Result.error(ProvidePreimageError.WasNotRequested));
    assert.deepStrictEqual(state.stateUpdate.services.preimages, [
      UpdatePreimage.provide({
        serviceId: tryAsServiceId(0),
        preimage: PreimageItem.create({
          hash: preimage.hash,
          blob: preimage.blob,
        }),
        slot: state.state.timeslot,
      }),
    ]);
  });

  it("should return ok and then error if preimage is provided twice for other", () => {
    const { state, preimage } = partiallyUpdatedStateWithSecondService({
      self: false,
      requested: true,
      available: false,
    });

    const partialState = new AccumulateExternalities(
      tinyChainSpec,
      state,
      tryAsServiceId(0),
      tryAsServiceId(10),
      tryAsTimeSlot(16),
    );

    const serviceId = tryAsServiceId(1);
    assert.deepStrictEqual(state.stateUpdate.services.preimages, []);

    // when
    const resultok = partialState.providePreimage(serviceId, preimage.blob);
    const resulterr = partialState.providePreimage(serviceId, preimage.blob);

    // then
    assert.deepStrictEqual(resultok, Result.ok(OK));
    assert.deepStrictEqual(resulterr, Result.error(ProvidePreimageError.WasNotRequested));
    assert.deepStrictEqual(state.stateUpdate.services.preimages, [
      UpdatePreimage.provide({
        serviceId: tryAsServiceId(1),
        preimage: PreimageItem.create({
          hash: preimage.hash,
          blob: preimage.blob,
        }),
        slot: state.state.timeslot,
      }),
    ]);
  });
});

describe("PartialState.eject", () => {
  function setupEjectableService(
    stateUpdate: InMemoryState,
    overrides: {
      codeHash?: CodeHash;
      storageUtilisationCount?: U32;
      storageUtilisationBytes?: U64;
      tombstone?: {
        hash: PreimageHash;
        length: U32;
        slots: LookupHistorySlots;
      };
    } = {},
  ): ServiceId {
    const destinationId = tryAsServiceId(1);

    const baseService = stateUpdate.services.get(tryAsServiceId(0));
    if (baseService === undefined) {
      throw new Error("Missing required service!");
    }
    const codeHash =
      overrides.codeHash ??
      (() => {
        const expected = Bytes.zero(HASH_SIZE).asOpaque<CodeHash>();
        writeServiceIdAsLeBytes(tryAsServiceId(0), expected.raw);
        return expected;
      })();

    const storageUtilisationCount = overrides.storageUtilisationCount ?? tryAsU32(2);

    const storageUtilisationBytes =
      overrides.storageUtilisationBytes ?? tryAsU64(81 + (overrides.tombstone?.length ?? 0));

    let preimages = HashDictionary.new<PreimageHash, PreimageItem>();
    let lookupHistory = HashDictionary.new<PreimageHash, LookupHistoryItem[]>();
    if (overrides.tombstone !== undefined) {
      const { hash, length, slots } = overrides.tombstone;
      const item = new LookupHistoryItem(hash, length, slots);
      lookupHistory = HashDictionary.fromEntries([[hash, [item]]]);
      if (item.slots.length === 1 || item.slots.length === 2) {
        preimages = HashDictionary.fromEntries([
          [
            hash,
            PreimageItem.create({
              hash,
              blob: BytesBlob.blobFrom(new Uint8Array(length)),
            }),
          ],
        ]);
      }
    }

    const destinationService = new InMemoryService(destinationId, {
      info: ServiceAccountInfo.create({
        ...baseService.data.info,
        codeHash,
        storageUtilisationCount,
        storageUtilisationBytes,
      }),
      preimages,
      lookupHistory,
      storage: HashDictionary.new(),
    });

    stateUpdate.services.set(destinationId, destinationService);
    return destinationId;
  }
  it("should return InvalidService if destination is null", () => {
    const state = partiallyUpdatedState();
    const partialState = new AccumulateExternalities(
      tinyChainSpec,
      state,
      tryAsServiceId(0),
      tryAsServiceId(10),
      tryAsTimeSlot(16),
    );

    const tombstone = Bytes.fill(HASH_SIZE, 0xef).asOpaque();

    // when
    const result = partialState.eject(null, tombstone);

    // then
    assert.deepStrictEqual(result, Result.error(EjectError.InvalidService, "Service missing"));
    assert.deepStrictEqual(state.stateUpdate.services.servicesRemoved, []);
  });

  it("should return InvalidService if destination service does not exist", () => {
    const state = partiallyUpdatedState();
    const partialState = new AccumulateExternalities(
      tinyChainSpec,
      state,
      tryAsServiceId(0),
      tryAsServiceId(10),
      tryAsTimeSlot(16),
    );

    const nonExistentServiceId = tryAsServiceId(99); // not present in stateUpdate
    const tombstone = Bytes.fill(HASH_SIZE, 0xee).asOpaque();

    // when
    const result = partialState.eject(nonExistentServiceId, tombstone);

    // then
    assert.deepStrictEqual(result, Result.error(EjectError.InvalidService, "Service missing"));
    assert.deepStrictEqual(state.stateUpdate.services.servicesRemoved, []);
  });

  it("should return InvalidService if destination service codeHash does not match expected pattern", () => {
    const state = partiallyUpdatedState();
    const destinationId = setupEjectableService(state.state, {
      codeHash: Bytes.fill(HASH_SIZE, 0x99).asOpaque(), // wrong codeHash
    });

    const tombstone = Bytes.fill(HASH_SIZE, 0xec).asOpaque();
    const partialState = new AccumulateExternalities(
      tinyChainSpec,
      state,
      tryAsServiceId(0),
      tryAsServiceId(10),
      tryAsTimeSlot(16),
    );

    // when
    const result = partialState.eject(destinationId, tombstone);

    // then
    assert.deepStrictEqual(result, Result.error(EjectError.InvalidService, "Invalid code hash"));
    assert.deepStrictEqual(state.stateUpdate.services.servicesRemoved, []);
  });

  it("should return InvalidPreimage if storageUtilisationCount is not equal to required value", () => {
    const state = partiallyUpdatedState();
    const destinationId = setupEjectableService(state.state, {
      storageUtilisationCount: tryAsU32(2 + 1), // off by 1
    });

    const tombstone = Bytes.fill(HASH_SIZE, 0xeb).asOpaque();
    const partialState = new AccumulateExternalities(
      tinyChainSpec,
      state,
      tryAsServiceId(0),
      tryAsServiceId(10),
      tryAsTimeSlot(16),
    );

    // when
    const result = partialState.eject(destinationId, tombstone);

    // then
    assert.deepStrictEqual(result, Result.error(EjectError.InvalidPreimage, "Too many storage items"));
    assert.deepStrictEqual(state.stateUpdate.services.servicesRemoved, []);
  });

  it("should return InvalidPreimage if the tombstone preimage is missing", () => {
    const state = partiallyUpdatedState();
    const tombstone = Bytes.fill(HASH_SIZE, 0xea).asOpaque();

    // destination service has valid codeHash and config, but no preimage or lookup history
    const destinationId = setupEjectableService(state.state);

    const partialState = new AccumulateExternalities(
      tinyChainSpec,
      state,
      tryAsServiceId(0),
      tryAsServiceId(10),
      tryAsTimeSlot(16),
    );

    // when
    const result = partialState.eject(destinationId, tombstone);

    // then
    assert.deepStrictEqual(result, Result.error(EjectError.InvalidPreimage, "Previous code available: wrong status"));
    assert.deepStrictEqual(state.stateUpdate.services.servicesRemoved, []);
  });

  it("should return InvalidPreimage if tombstone preimage exists but has wrong status", () => {
    const state = partiallyUpdatedState();
    const tombstone = Bytes.fill(HASH_SIZE, 0xe9).asOpaque<PreimageHash>();
    const length = tryAsU32(100);

    const destinationId = setupEjectableService(state.state, {
      tombstone: {
        hash: tombstone,
        length,
        // available
        slots: tryAsLookupHistorySlots([1].map((x) => tryAsTimeSlot(x))),
      },
    });

    const partialState = new AccumulateExternalities(
      tinyChainSpec,
      state,
      tryAsServiceId(0),
      tryAsServiceId(10),
      tryAsTimeSlot(16),
    );

    // when
    const result = partialState.eject(destinationId, tombstone);

    // then
    assert.deepStrictEqual(result, Result.error(EjectError.InvalidPreimage, "Previous code available: wrong status"));
    assert.deepStrictEqual(state.stateUpdate.services.servicesRemoved, []);
  });

  it("should return InvalidPreimage if tombstone preimage exists but is not expired", () => {
    const state = partiallyUpdatedState();
    const tombstone = Bytes.fill(HASH_SIZE, 0xe9).asOpaque<PreimageHash>();
    const length = tryAsU32(13);

    const destinationId = setupEjectableService(state.state, {
      tombstone: {
        hash: tombstone,
        length,
        // unavailable
        slots: tryAsLookupHistorySlots([1, 11].map((x) => tryAsTimeSlot(x))),
      },
    });

    const partialState = new AccumulateExternalities(
      tinyChainSpec,
      state,
      tryAsServiceId(0),
      tryAsServiceId(10),
      tryAsTimeSlot(17),
    );

    // when
    const result = partialState.eject(destinationId, tombstone);

    // then
    assert.deepStrictEqual(result, Result.error(EjectError.InvalidPreimage, "Previous code available: not expired"));
    assert.deepStrictEqual(state.stateUpdate.services.servicesRemoved, []);
  });

  it("should return InvalidService if summing balances would overflow", () => {
    const state = partiallyUpdatedState();
    state.state.applyUpdate({
      timeslot: tryAsTimeSlot(1_000_000),
    });
    const tombstone = Bytes.fill(HASH_SIZE, 0xe8).asOpaque();
    const length = tryAsU32(100);

    const destinationId = setupEjectableService(state.state, {
      tombstone: {
        hash: tombstone,
        length,
        slots: tryAsLookupHistorySlots([0, 1].map((x) => tryAsTimeSlot(x))),
      },
    });

    const partialState = new AccumulateExternalities(
      tinyChainSpec,
      state,
      tryAsServiceId(0),
      tryAsServiceId(10),
      tryAsTimeSlot(50),
    );

    // set the balance to overflow
    const currentService = state.state.services.get(tryAsServiceId(0));
    if (currentService === undefined) {
      throw new Error("missing required service!");
    }

    state.updateServiceInfo(
      tryAsServiceId(0),
      ServiceAccountInfo.create({
        ...currentService.data.info,
        balance: tryAsU64(2n ** 64n - 1n),
      }),
    );

    // when
    const result = partialState.eject(destinationId, tombstone);

    // then
    assert.deepStrictEqual(result, Result.error(EjectError.InvalidService, "Balance overflow"));
    assert.deepStrictEqual(state.stateUpdate.services.servicesRemoved, []);
  });

  it("should return OK", () => {
    const state = partiallyUpdatedState();
    state.state.applyUpdate({
      timeslot: tryAsTimeSlot(1_000_000),
    });
    const tombstone = Bytes.fill(HASH_SIZE, 0xe8).asOpaque();
    const length = tryAsU32(100);

    const destinationId = setupEjectableService(state.state, {
      tombstone: {
        hash: tombstone,
        length,
        slots: tryAsLookupHistorySlots([0, 1].map((x) => tryAsTimeSlot(x))),
      },
    });

    const partialState = new AccumulateExternalities(
      tinyChainSpec,
      state,
      tryAsServiceId(0),
      tryAsServiceId(10),
      tryAsTimeSlot(50),
    );

    // when
    const result = partialState.eject(destinationId, tombstone);

    // then
    assert.deepStrictEqual(result, Result.ok(OK));
    assert.deepStrictEqual(state.stateUpdate.services.servicesRemoved, [destinationId]);
  });
});

describe("AccumulateServiceExternalities", () => {
  const prepareState = (serviceArray: InMemoryService[] = []) => {
    const services = new Map<ServiceId, InMemoryService>();

    for (const service of serviceArray) {
      services.set(service.serviceId, service);
    }

    const state = InMemoryState.empty(tinyChainSpec);
    state.services = services;
    return new PartiallyUpdatedState(state);
  };

  const prepareService = (
    serviceId: ServiceId,
    {
      storage,
      preimages,
      info,
    }: {
      storage?: HashDictionary<OpaqueHash, StorageItem>;
      preimages?: HashDictionary<PreimageHash, PreimageItem>;
      info?: Partial<ServiceAccountInfo>;
    } = {},
  ) => {
    const initialStorage = storage ?? HashDictionary.new();
    const storageUtilisationBytes = Array.from(initialStorage.values()).reduce(
      (sum, item) => sum + (item?.value.length ?? 0),
      0,
    );
    const serviceComp = Compatibility.isGreaterOrEqual(GpVersion.V0_6_7)
      ? {
          gratisStorage: tryAsU64(1024),
          created: tryAsTimeSlot(10),
          lastAccumulation: tryAsTimeSlot(15),
          parentService: tryAsServiceId(1),
        }
      : {
          gratisStorage: tryAsU64(0),
          created: tryAsTimeSlot(0),
          lastAccumulation: tryAsTimeSlot(0),
          parentService: tryAsServiceId(0),
        };

    return new InMemoryService(serviceId, {
      info: ServiceAccountInfo.create({
        balance: tryAsU64(2 ** 32),
        accumulateMinGas: tryAsServiceGas(1000),
        storageUtilisationBytes: tryAsU64(storageUtilisationBytes),
        storageUtilisationCount: tryAsU32(initialStorage.size),
        codeHash: Bytes.zero(HASH_SIZE).asOpaque(),
        onTransferMinGas: tryAsServiceGas(1000),
        ...serviceComp,
        ...info,
      }),
      storage: initialStorage,
      preimages: preimages ?? HashDictionary.new(),
      lookupHistory: HashDictionary.new(),
    });
  };

  const preparePreimages = (preimageArray: [PreimageHash, BytesBlob][]) => {
    const preimages: HashDictionary<PreimageHash, PreimageItem> = HashDictionary.new();

    for (const [hash, blob] of preimageArray) {
      const item = PreimageItem.create({ hash, blob });
      preimages.set(hash, item);
    }

    return preimages;
  };

  describe("getInfo", () => {
    it("should return null when serviceId is null", () => {
      const currentServiceId = tryAsServiceId(10_000);
      const serviceId: ServiceId | null = null;
      const state = prepareState([prepareService(currentServiceId)]);
      const expectedServiceInfo: ServiceAccountInfo | null = null;

      const accumulateServiceExternalities = new AccumulateExternalities(
        tinyChainSpec,
        state,
        currentServiceId,
        tryAsServiceId(42),
        tryAsTimeSlot(16),
      );

      const serviceInfo = accumulateServiceExternalities.getServiceInfo(serviceId);

      assert.strictEqual(serviceInfo, expectedServiceInfo);
    });

    it("should return null when serviceId is incorrect", () => {
      const currentServiceId = tryAsServiceId(10_000);
      const serviceId = tryAsServiceId(5);
      const state = prepareState([prepareService(currentServiceId)]);
      const expectedServiceInfo: ServiceAccountInfo | null = null;

      const accumulateServiceExternalities = new AccumulateExternalities(
        tinyChainSpec,
        state,
        currentServiceId,
        tryAsServiceId(42),
        tryAsTimeSlot(16),
      );

      const serviceInfo = accumulateServiceExternalities.getServiceInfo(serviceId);

      assert.strictEqual(serviceInfo, expectedServiceInfo);
    });

    it("should return correct service info", () => {
      const currentServiceId = tryAsServiceId(10_000);
      const serviceId = tryAsServiceId(5);
      const state = prepareState([prepareService(currentServiceId), prepareService(serviceId)]);
      const expectedServiceInfo = prepareService(serviceId).getInfo();

      const accumulateServiceExternalities = new AccumulateExternalities(
        tinyChainSpec,
        state,
        currentServiceId,
        tryAsServiceId(42),
        tryAsTimeSlot(16),
      );

      const serviceInfo = accumulateServiceExternalities.getServiceInfo(serviceId);

      assert.deepStrictEqual(serviceInfo, expectedServiceInfo);
    });
  });

  describe("lookup", () => {
    it("should return null when serviceId is null", () => {
      const currentServiceId = tryAsServiceId(10_000);
      const serviceId: ServiceId | null = null;
      const hash = Bytes.fill(HASH_SIZE, 1).asOpaque();
      const state = prepareState([prepareService(currentServiceId)]);
      const expectedResult: BytesBlob | null = null;

      const accumulateServiceExternalities = new AccumulateExternalities(
        tinyChainSpec,
        state,
        currentServiceId,
        tryAsServiceId(42),
        tryAsTimeSlot(16),
      );

      const result = accumulateServiceExternalities.lookup(serviceId, hash);

      assert.strictEqual(result, expectedResult);
    });

    it("should return null when service does not exist", () => {
      const currentServiceId = tryAsServiceId(10_000);
      const serviceId = tryAsServiceId(0);
      const hash = Bytes.fill(HASH_SIZE, 1).asOpaque();
      const state = prepareState([prepareService(currentServiceId)]);
      const expectedResult: BytesBlob | null = null;

      const accumulateServiceExternalities = new AccumulateExternalities(
        tinyChainSpec,
        state,
        currentServiceId,
        tryAsServiceId(42),
        tryAsTimeSlot(16),
      );

      const result = accumulateServiceExternalities.lookup(serviceId, hash);

      assert.strictEqual(result, expectedResult);
    });

    it("should return null when preimage does not exists", () => {
      const currentServiceId = tryAsServiceId(10_000);
      const requestedHash = Bytes.fill(HASH_SIZE, 1).asOpaque();
      const otherHash = Bytes.fill(HASH_SIZE, 2).asOpaque();
      const preimages = preparePreimages([[otherHash, BytesBlob.empty()]]);
      const service = prepareService(currentServiceId, { preimages });
      const state = prepareState([service]);
      const expectedResult: BytesBlob | null = null;

      const accumulateServiceExternalities = new AccumulateExternalities(
        tinyChainSpec,
        state,
        currentServiceId,
        tryAsServiceId(42),
        tryAsTimeSlot(16),
      );

      const result = accumulateServiceExternalities.lookup(currentServiceId, requestedHash);

      assert.strictEqual(result, expectedResult);
    });

    it("should return return a correct preimage", () => {
      const serviceId = tryAsServiceId(0);
      const expectedResult = BytesBlob.empty();
      const requestedHash = Bytes.fill(HASH_SIZE, 1).asOpaque();
      const preimages = preparePreimages([[requestedHash, expectedResult]]);
      const service = prepareService(serviceId, { preimages });
      const state = prepareState([service]);

      const accumulateServiceExternalities = new AccumulateExternalities(
        tinyChainSpec,
        state,
        serviceId,
        tryAsServiceId(42),
        tryAsTimeSlot(16),
      );

      const result = accumulateServiceExternalities.lookup(serviceId, requestedHash);

      assert.deepStrictEqual(result, expectedResult);
    });
  });

  describe("read / write", () => {
    it("should return null when serviceId is null ", () => {
      const currentServiceId = tryAsServiceId(10_000);
      const serviceId: ServiceId | null = null;
      const hash = Bytes.fill(HASH_SIZE, 1).asOpaque();
      const state = prepareState([prepareService(currentServiceId)]);

      const accumulateServiceExternalities = new AccumulateExternalities(
        tinyChainSpec,
        state,
        currentServiceId,
        tryAsServiceId(42),
        tryAsTimeSlot(16),
      );

      const result = accumulateServiceExternalities.read(serviceId, hash);

      assert.strictEqual(result, null);
    });

    it("should return null when service does not exist ", () => {
      const currentServiceId = tryAsServiceId(10_000);
      const serviceId = tryAsServiceId(33);
      const hash = Bytes.fill(HASH_SIZE, 1).asOpaque();
      const state = prepareState([prepareService(currentServiceId)]);
      const accumulateServiceExternalities = new AccumulateExternalities(
        tinyChainSpec,
        state,
        currentServiceId,
        tryAsServiceId(42),
        tryAsTimeSlot(16),
      );

      const result = accumulateServiceExternalities.read(serviceId, hash);

      assert.strictEqual(result, null);
    });

    it("should correctly read from storage", () => {
      const currentServiceId = tryAsServiceId(10_000);
      const serviceId = tryAsServiceId(33);
      const key = Bytes.fill(HASH_SIZE, 1).asOpaque();
      const initialStorage = HashDictionary.new<OpaqueHash, StorageItem>();
      const value = BytesBlob.empty();
      initialStorage.set(key, StorageItem.create({ key, value }));
      const service = prepareService(serviceId, { storage: initialStorage });
      const state = prepareState([prepareService(currentServiceId), service]);

      const accumulateServiceExternalities = new AccumulateExternalities(
        tinyChainSpec,
        state,
        currentServiceId,
        tryAsServiceId(42),
        tryAsTimeSlot(16),
      );

      const result = accumulateServiceExternalities.read(serviceId, key);

      assert.strictEqual(result, value);
    });

    it("should correctly write to storage", () => {
      const currentServiceId = tryAsServiceId(10_000);
      const hash = Bytes.fill(HASH_SIZE, 1).asOpaque();
      const blob = BytesBlob.empty();
      const state = prepareState([prepareService(currentServiceId)]);
      const accumulateServiceExternalities = new AccumulateExternalities(
        tinyChainSpec,
        state,
        currentServiceId,
        tryAsServiceId(42),
        tryAsTimeSlot(16),
      );

      assert.strictEqual(state.stateUpdate.services.storage.length, 0);

      accumulateServiceExternalities.write(hash, tryAsU64(1), blob);

      assert.strictEqual(state.stateUpdate.services.storage.length, 1);
    });

    it("should return new value if there was a write", () => {
      const currentServiceId = tryAsServiceId(10_000);
      const key = Bytes.fill(HASH_SIZE, 2).asOpaque();
      const initialStorage = HashDictionary.new<OpaqueHash, StorageItem>();
      const value = BytesBlob.empty();
      const newBlob = BytesBlob.parseBlob("0x11111111");
      initialStorage.set(key, StorageItem.create({ key, value }));

      const state = prepareState([prepareService(currentServiceId, { storage: initialStorage })]);
      const accumulateServiceExternalities = new AccumulateExternalities(
        tinyChainSpec,
        state,
        currentServiceId,
        tryAsServiceId(42),
        tryAsTimeSlot(16),
      );

      accumulateServiceExternalities.write(key, tryAsU64(1), newBlob);

      assert.strictEqual(state.stateUpdate.services.storage.length, 1);

      const result = accumulateServiceExternalities.read(currentServiceId, key);

      assert.deepStrictEqual(result, newBlob);
    });
  });

  describe("readSnapshotLength", () => {
    it("should correctly read from storage", () => {
      const serviceId = tryAsServiceId(33);
      const key = Bytes.fill(HASH_SIZE, 1).asOpaque();
      const initialStorage = HashDictionary.new<OpaqueHash, StorageItem>();
      const value = BytesBlob.empty();
      initialStorage.set(key, StorageItem.create({ key, value }));
      const service = prepareService(serviceId, { storage: initialStorage });
      const state = prepareState([service]);

      const accumulateServiceExternalities = new AccumulateExternalities(
        tinyChainSpec,
        state,
        serviceId,
        tryAsServiceId(42),
        tryAsTimeSlot(16),
      );

      const result = accumulateServiceExternalities.readSnapshotLength(key);

      assert.strictEqual(result, value.length);
    });

    it("should return snapshot length even if a new value if was written", () => {
      const currentServiceId = tryAsServiceId(10_000);
      const key = Bytes.fill(HASH_SIZE, 1).asOpaque();
      const initialStorage = HashDictionary.new<OpaqueHash, StorageItem>();
      const value = BytesBlob.empty();
      const newBlob = BytesBlob.parseBlob("0x11111111");
      initialStorage.set(key, StorageItem.create({ key, value }));
      const service = prepareService(currentServiceId, { storage: initialStorage });
      const state = prepareState([service]);
      const accumulateServiceExternalities = new AccumulateExternalities(
        tinyChainSpec,
        state,
        currentServiceId,
        tryAsServiceId(42),
        tryAsTimeSlot(16),
      );

      accumulateServiceExternalities.write(key, tryAsU64(0), newBlob);
      const result = accumulateServiceExternalities.readSnapshotLength(key);

      assert.deepStrictEqual(result, value.length);
    });
  });
});

import { type ServiceId, type TimeSlot, tryAsServiceGas } from "@typeberry/block";
import type { PreimageHash } from "@typeberry/block/preimage.js";
import { Encoder, codec } from "@typeberry/codec";
import type { ChainSpec } from "@typeberry/config";
import { AccumulateExternalities } from "@typeberry/jam-host-calls/externalities/accumulate-externalities.js";
import { PendingTransfer } from "@typeberry/jam-host-calls/externalities/pending-transfer.js";
import {
  AccumulationStateUpdate,
  PartiallyUpdatedState,
} from "@typeberry/jam-host-calls/externalities/state-update.js";
import { Logger } from "@typeberry/logger";
import { sumU64, tryAsU32 } from "@typeberry/numbers";
import { tryAsGas } from "@typeberry/pvm-interpreter";
import {
  ServiceAccountInfo,
  type ServicesUpdate,
  type State,
  type UpdatePreimage,
  UpdatePreimageKind,
  type UpdateService,
} from "@typeberry/state";
import { Result } from "@typeberry/utils";
import type { CountAndGasUsed } from "../statistics.js";
import { uniquePreserveOrder } from "./accumulate-utils.js";
import { PvmExecutor } from "./pvm-executor.js";

type DeferredTransfersInput = {
  pendingTransfers: PendingTransfer[];
  timeslot: TimeSlot;
  servicesUpdate: ServicesUpdate;
};

export type DeferredTransfersState = Pick<State, "timeslot" | "getService">;

export type DeferredTransfersResult = {
  servicesUpdate: ServicesUpdate;
  transferStatistics: Map<ServiceId, CountAndGasUsed>;
};

const ON_TRANSFER_ARGS_CODEC = codec.object({
  timeslot: codec.u32.asOpaque<TimeSlot>(),
  serviceId: codec.u32.asOpaque<ServiceId>(),
  transfers: codec.sequenceVarLen(PendingTransfer.Codec),
});

export enum DeferredTransfersErrorCode {
  ServiceBalanceOverflow = 1,
  ServiceInfoNotExist = 2,
}
const logger = Logger.new(import.meta.filename, "deferred-transfers");

export class DeferredTransfers {
  constructor(
    public readonly chainSpec: ChainSpec,
    private readonly state: Pick<State, "getService" | "timeslot">,
  ) {}

  private getPotentiallyUpdatedServiceInfo(
    serviceId: ServiceId,
    serviceUpdates: UpdateService[],
    servicesRemoved: ServiceId[],
  ) {
    if (servicesRemoved.includes(serviceId)) {
      return null;
    }

    const maybeUpdatedService = serviceUpdates.find((x) => x.serviceId === serviceId);

    if (maybeUpdatedService !== undefined) {
      return maybeUpdatedService.action.account;
    }

    return this.state.getService(serviceId)?.getInfo() ?? null;
  }

  private getPotentiallyUpdatedPreimage(preimages: UpdatePreimage[], serviceId: ServiceId, preimageHash: PreimageHash) {
    const preimageUpdate = preimages.findLast((x) => x.serviceId === serviceId && x.hash.isEqualTo(preimageHash));
    if (preimageUpdate === undefined) {
      return this.state.getService(serviceId)?.getPreimage(preimageHash) ?? null;
    }

    switch (preimageUpdate.action.kind) {
      case UpdatePreimageKind.Provide:
        return preimageUpdate.action.preimage.blob;
      case UpdatePreimageKind.Remove:
        return null;
      case UpdatePreimageKind.UpdateOrAdd:
        // TODO [MaSi]: It is possible to have `Provide` and `UpdateOrAdd` in `preimages` and it will return `null`.
        // We have to check if this situation is possible in real world and handle it
        return this.state.getService(serviceId)?.getPreimage(preimageHash) ?? null;
    }
  }
  /**
   * A method that merges changes that were made by services during accumulation.
   * It can modify: `services`, `privilegedServices`, `authQueues`,
   * and `designatedValidatorData` and is called after the whole accumulation finishes.
   */
  private mergeServiceStateUpdates(
    source: ServicesUpdate,
    stateUpdates: AccumulationStateUpdate[],
  ): AccumulationStateUpdate {
    const serviceUpdates: ServicesUpdate[] = [source];

    for (const stateUpdate of stateUpdates) {
      serviceUpdates.push(stateUpdate.services);
    }

    const servicesUpdate = serviceUpdates.reduce(
      (acc, update) => {
        acc.servicesRemoved.push(...update.servicesRemoved);
        acc.servicesUpdates.push(...update.servicesUpdates);
        acc.preimages.push(...update.preimages);
        acc.storage.push(...update.storage);
        return acc;
      },
      {
        servicesRemoved: [],
        servicesUpdates: [],
        preimages: [],
        storage: [],
      },
    );

    const accumulationStateUpdate = AccumulationStateUpdate.new(servicesUpdate);

    return accumulationStateUpdate;
  }

  async transition({
    pendingTransfers,
    timeslot,
    servicesUpdate,
  }: DeferredTransfersInput): Promise<Result<DeferredTransfersResult, DeferredTransfersErrorCode>> {
    const transferStatistics = new Map<ServiceId, CountAndGasUsed>();
    const services = uniquePreserveOrder(pendingTransfers.flatMap((x) => [x.source, x.destination]));
    const stateUpdates: AccumulationStateUpdate[] = [];

    for (const serviceId of services) {
      const transfers = pendingTransfers.filter((pendingTransfer) => pendingTransfer.destination === serviceId);

      const partiallyUpdatedState = new PartiallyUpdatedState(this.state, AccumulationStateUpdate.new(servicesUpdate));
      const partialState = new AccumulateExternalities(
        this.chainSpec,
        partiallyUpdatedState,
        serviceId,
        serviceId,
        timeslot,
      );
      const info = partialState.getServiceInfo(serviceId);
      if (info === null) {
        return Result.error(DeferredTransfersErrorCode.ServiceInfoNotExist);
      }
      const codeHash = info.codeHash;
      const code = partiallyUpdatedState.getPreimage(serviceId, codeHash.asOpaque());

      const newBalance = sumU64(info.balance, ...transfers.map((item) => item.amount));

      if (newBalance.overflow) {
        return Result.error(DeferredTransfersErrorCode.ServiceBalanceOverflow);
      }

      const newInfo = ServiceAccountInfo.create({ ...info, balance: newBalance.value });
      partiallyUpdatedState.updateServiceInfo(serviceId, newInfo);

      if (code === null || transfers.length === 0) {
        logger.trace(`Skipping ON_TRANSFER execution for service ${serviceId}, code is null or no transfers`);
        transferStatistics.set(serviceId, { count: tryAsU32(transfers.length), gasUsed: tryAsServiceGas(0) });
        continue;
      }

      const executor = PvmExecutor.createOnTransferExecutor(serviceId, code, { partialState });
      const args = Encoder.encodeObject(ON_TRANSFER_ARGS_CODEC, { timeslot, serviceId, transfers }, this.chainSpec);

      const gas = transfers.reduce((acc, item) => acc + item.gas, 0n);
      const { consumedGas } = await executor.run(args, tryAsGas(gas));
      transferStatistics.set(serviceId, { count: tryAsU32(transfers.length), gasUsed: tryAsServiceGas(consumedGas) });
      const [updatedState] = partialState.getStateUpdates();
      stateUpdates.push(updatedState);
    }

    const deferredTransfersStateUpdate = this.mergeServiceStateUpdates(servicesUpdate, stateUpdates);

    return Result.ok({
      servicesUpdate: deferredTransfersStateUpdate.services,
      transferStatistics,
    });
  }
}

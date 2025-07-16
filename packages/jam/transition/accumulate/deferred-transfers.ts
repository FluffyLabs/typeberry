import { type ServiceId, type TimeSlot, tryAsServiceGas } from "@typeberry/block";
import type { PreimageHash } from "@typeberry/block/preimage.js";
import { Encoder, codec } from "@typeberry/codec";
import { HashDictionary } from "@typeberry/collections";
import type { ChainSpec } from "@typeberry/config";
import { PartialStateDb } from "@typeberry/jam-host-calls/externalities/partial-state-db.js";
import { PendingTransfer } from "@typeberry/jam-host-calls/externalities/pending-transfer.js";
import { tryAsU32, tryAsU64 } from "@typeberry/numbers";
import { tryAsGas } from "@typeberry/pvm-interpreter";
import {
  InMemoryService,
  type Service,
  ServiceAccountInfo,
  type State,
  type UpdatePreimage,
  UpdatePreimageKind,
  UpdateService,
  UpdateServiceKind,
} from "@typeberry/state";
import { check } from "@typeberry/utils";
import type { CountAndGasUsed } from "../statistics.js";
import { uniquePreserveOrder } from "./accumulate-utils.js";
import { PvmExecutor } from "./pvm-executor.js";

type DeferredTransfersInput = {
  pendingTransfers: PendingTransfer[];
  timeslot: TimeSlot;
  servicesUpdates: UpdateService[];
  servicesRemoved: ServiceId[];
  preimages: UpdatePreimage[];
};

export type DeferredTransfersState = Pick<State, "timeslot" | "getService">;

export type DeferredTransfersResult = {
  servicesUpdates: UpdateService[];
  transferStatistics: Map<ServiceId, CountAndGasUsed>;
};

const ON_TRANSFER_ARGS_CODEC = codec.object({
  timeslot: codec.u32.asOpaque<TimeSlot>(),
  serviceId: codec.u32.asOpaque<ServiceId>(),
  transfers: codec.sequenceVarLen(PendingTransfer.Codec),
});

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
        return this.state.getService(serviceId)?.getPreimage(preimageUpdate.action.item.hash) ?? null;
    }
  }

  private getService(
    serviceId: ServiceId,
    serviceUpdates: UpdateService[],
    servicesRemoved: ServiceId[],
  ): Service | null {
    if (servicesRemoved.includes(serviceId)) {
      return null;
    }

    const maybeUpdatedService = serviceUpdates.find((x) => x.serviceId === serviceId);

    switch (maybeUpdatedService?.action.kind) {
      case UpdateServiceKind.Create: {
        return new InMemoryService(serviceId, {
          info: maybeUpdatedService?.action.account,
          lookupHistory: HashDictionary.new(),
          preimages: HashDictionary.new(),
          storage: HashDictionary.new(),
        });
      }
      case UpdateServiceKind.Update: {
        const service = this.state.getService(serviceId);
        const serviceInfo = service?.getInfo() ?? {};
        check(serviceInfo !== null, "Update service exists so the service has to exist as well!");
        return new InMemoryService(serviceId, {
          lookupHistory: HashDictionary.new(),
          preimages: HashDictionary.new(),
          storage: HashDictionary.new(),
          ...(service ?? {}),
          info: {
            ...serviceInfo,
            ...maybeUpdatedService?.action.account,
          },
        });
      }
    }
    return this.state.getService(serviceId) ?? null;
  }

  async transition({
    pendingTransfers,
    timeslot,
    servicesUpdates: servicesUpdatesInput,
    servicesRemoved,
    preimages,
  }: DeferredTransfersInput): Promise<DeferredTransfersResult> {
    const transferStatistics = new Map<ServiceId, CountAndGasUsed>();
    const servicesUpdates = [...servicesUpdatesInput];
    const services = uniquePreserveOrder(pendingTransfers.flatMap((x) => [x.source, x.destination]));

    for (const serviceId of services) {
      const transfers = pendingTransfers.filter((pendingTransfer) => pendingTransfer.destination === serviceId);

      const info = this.getPotentiallyUpdatedServiceInfo(serviceId, servicesUpdates, servicesRemoved);
      if (info === null) {
        continue;
      }
      const codeHash = info.codeHash;
      const code = this.getPotentiallyUpdatedPreimage(preimages, serviceId, codeHash.asOpaque());

      const existingUpdateIndex = servicesUpdates.findIndex((x) => x.serviceId === serviceId);
      const amount = transfers.reduce((acc, item) => acc + item.amount, 0n);
      if (existingUpdateIndex < 0 || servicesUpdates[existingUpdateIndex].action.kind === UpdateServiceKind.Create) {
        const update = UpdateService.update({
          serviceId,
          serviceInfo: ServiceAccountInfo.create({ ...info, balance: tryAsU64(info.balance + amount) }),
        });
        servicesUpdates.push(update);
      } else {
        const existingUpdate = servicesUpdates[existingUpdateIndex];
        const update = UpdateService.update({
          serviceId,
          serviceInfo: ServiceAccountInfo.create({
            ...existingUpdate.action.account,
            balance: tryAsU64(info.balance + amount),
          }),
        });
        servicesUpdates[existingUpdateIndex] = update;
      }

      if (code === null || transfers.length === 0) {
        transferStatistics.set(serviceId, { count: tryAsU32(transfers.length), gasUsed: tryAsServiceGas(0) });
        continue;
      }
      const partialState = new PartialStateDb(
        {
          getService: (serviceId: ServiceId) => this.getService(serviceId, servicesUpdates, servicesRemoved),
        },
        serviceId,
        serviceId,
        timeslot,
        this.chainSpec,
      );

      const executor = PvmExecutor.createOnTransferExecutor(serviceId, code, { partialState });
      const args = Encoder.encodeObject(ON_TRANSFER_ARGS_CODEC, { timeslot, serviceId, transfers }, this.chainSpec);

      const gas = transfers.reduce((acc, item) => acc + item.gas, 0n);
      const { consumedGas } = await executor.run(args, tryAsGas(gas));
      transferStatistics.set(serviceId, { count: tryAsU32(transfers.length), gasUsed: tryAsServiceGas(consumedGas) });
    }

    return {
      servicesUpdates,
      transferStatistics,
    };
  }
}

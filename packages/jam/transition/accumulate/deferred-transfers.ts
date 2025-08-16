import { type ServiceId, type TimeSlot, tryAsServiceGas } from "@typeberry/block";
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
import { ServiceAccountInfo, type ServicesUpdate, type State } from "@typeberry/state";
import { Result } from "@typeberry/utils";
import type { CountAndGasUsed } from "../statistics.js";
import { uniquePreserveOrder } from "./accumulate-utils.js";
import { PvmExecutor } from "./pvm-executor.js";

type DeferredTransfersInput = {
  pendingTransfers: PendingTransfer[];
  timeslot: TimeSlot;
  servicesUpdate: ServicesUpdate;
};

export type DeferredTransfersState = Pick<State, "timeslot" | "getService" | "privilegedServices">;

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

/**
 * https://graypaper.fluffylabs.dev/#/7e6ff6a/18df0118df01?v=0.6.7
 */
export class DeferredTransfers {
  constructor(
    public readonly chainSpec: ChainSpec,
    private readonly state: DeferredTransfersState,
  ) {}

  async transition({
    pendingTransfers,
    timeslot,
    servicesUpdate,
  }: DeferredTransfersInput): Promise<Result<DeferredTransfersResult, DeferredTransfersErrorCode>> {
    // https://graypaper.fluffylabs.dev/#/7e6ff6a/187a03187a03?v=0.6.7
    const transferStatistics = new Map<ServiceId, CountAndGasUsed>();
    const services = uniquePreserveOrder(pendingTransfers.flatMap((x) => [x.source, x.destination]));
    const partiallyUpdatedState = new PartiallyUpdatedState(this.state, AccumulationStateUpdate.new(servicesUpdate));

    for (const serviceId of services) {
      const transfers = pendingTransfers.filter((pendingTransfer) => pendingTransfer.destination === serviceId);

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
    }

    return Result.ok({
      servicesUpdate,
      transferStatistics,
    });
  }
}

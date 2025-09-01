import { type EntropyHash, type ServiceId, type TimeSlot, tryAsServiceGas } from "@typeberry/block";
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
import { Compatibility, GpVersion, Result, check } from "@typeberry/utils";
import { FetchExternalities } from "../externalities/fetch-externalities.js";
import type { CountAndGasUsed } from "../statistics.js";
import { uniquePreserveOrder } from "./accumulate-utils.js";
import { PvmExecutor } from "./pvm-executor.js";

type DeferredTransfersInput = {
  pendingTransfers: PendingTransfer[];
  timeslot: TimeSlot;
  servicesUpdate: ServicesUpdate;
  /** eta0' (after Safrole STF) - it is not eta0 from state! */
  entropy: EntropyHash;
};

export type DeferredTransfersState = Pick<State, "timeslot" | "getService" | "privilegedServices">;

export type DeferredTransfersResult = {
  servicesUpdate: ServicesUpdate;
  transferStatistics: Map<ServiceId, CountAndGasUsed>;
};

const ARGS_CODEC_PRE_067 = codec.object({
  timeslot: codec.u32.asOpaque<TimeSlot>(),
  serviceId: codec.u32.asOpaque<ServiceId>(),
  transfers: codec.sequenceVarLen(PendingTransfer.Codec),
});

const ARGS_CODEC = codec.object({
  timeslot: codec.varU32.asOpaque<TimeSlot>(),
  serviceId: codec.varU32.asOpaque<ServiceId>(),
  transfersLength: codec.varU32,
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
    servicesUpdate: inputServicesUpdate,
    entropy,
  }: DeferredTransfersInput): Promise<Result<DeferredTransfersResult, DeferredTransfersErrorCode>> {
    // https://graypaper.fluffylabs.dev/#/7e6ff6a/187a03187a03?v=0.6.7
    const transferStatistics = new Map<ServiceId, CountAndGasUsed>();
    const services = uniquePreserveOrder(pendingTransfers.flatMap((x) => [x.source, x.destination]));

    let currentStateUpdate = AccumulationStateUpdate.new(inputServicesUpdate);

    for (const serviceId of services) {
      const partiallyUpdatedState = new PartiallyUpdatedState(this.state, currentStateUpdate);
      const transfers = pendingTransfers.filter((pendingTransfer) => pendingTransfer.destination === serviceId);

      const info = partiallyUpdatedState.getServiceInfo(serviceId);
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

      const partialState = new AccumulateExternalities(
        this.chainSpec,
        partiallyUpdatedState,
        serviceId,
        serviceId,
        timeslot,
      );

      const fetchExternalities = FetchExternalities.createForOnTransfer({ entropy, transfers }, this.chainSpec);
      let consumedGas = tryAsGas(0);

      if (code === null || transfers.length === 0) {
        logger.trace(`Skipping ON_TRANSFER execution for service ${serviceId}, code is null or no transfers`);
      } else {
        const getArgs = () => {
          if (Compatibility.isGreaterOrEqual(GpVersion.V0_6_7)) {
            return Encoder.encodeObject(
              ARGS_CODEC,
              { timeslot, serviceId, transfersLength: tryAsU32(transfers.length) },
              this.chainSpec,
            );
          }
          return Encoder.encodeObject(
            ARGS_CODEC_PRE_067,
            { timeslot, serviceId, transfers: transfers },
            this.chainSpec,
          );
        };

        const executor = PvmExecutor.createOnTransferExecutor(serviceId, code, { partialState, fetchExternalities });
        const args = getArgs();

        const gas = transfers.reduce((acc, item) => acc + item.gas, 0n);
        consumedGas = (await executor.run(args, tryAsGas(gas))).consumedGas;
      }

      transferStatistics.set(serviceId, { count: tryAsU32(transfers.length), gasUsed: tryAsServiceGas(consumedGas) });
      const [updatedState, checkpointedState] = partialState.getStateUpdates();
      currentStateUpdate = updatedState;
      check(checkpointedState === null, "On transfer cannot invoke checkpoint.");
    }

    return Result.ok({
      // NOTE: we return only services, since it's impossible to update
      // anything else during `on_transfer` call.
      servicesUpdate: currentStateUpdate.services,
      transferStatistics,
    });
  }
}

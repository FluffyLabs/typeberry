import { type EntropyHash, type ServiceId, type TimeSlot, tryAsServiceGas } from "@typeberry/block";
import { W_C } from "@typeberry/block/gp-constants.js";
import { codec, Encoder } from "@typeberry/codec";
import type { ChainSpec, PVMBackend } from "@typeberry/config";
import type { Blake2b } from "@typeberry/hash";
import type { PendingTransfer } from "@typeberry/jam-host-calls/externalities/pending-transfer.js";
import {
  AccumulationStateUpdate,
  PartiallyUpdatedState,
} from "@typeberry/jam-host-calls/externalities/state-update.js";
import { Logger } from "@typeberry/logger";
import { sumU64, tryAsU32 } from "@typeberry/numbers";
import { tryAsGas } from "@typeberry/pvm-interface";
import { ServiceAccountInfo, type ServicesUpdate, type State } from "@typeberry/state";
import { check, Result } from "@typeberry/utils";
import { AccumulateExternalities } from "../externalities/accumulate-externalities.js";
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
    public readonly blake2b: Blake2b,
    private readonly state: DeferredTransfersState,
    private readonly pvm: PVMBackend,
  ) {}

  async transition({
    pendingTransfers,
    timeslot,
    servicesUpdate: inputServicesUpdate,
    entropy,
  }: DeferredTransfersInput): Promise<Result<DeferredTransfersResult, DeferredTransfersErrorCode>> {
    // https://graypaper.fluffylabs.dev/#/7e6ff6a/187a03187a03?v=0.6.7
    const transferStatistics = new Map<ServiceId, CountAndGasUsed>();
    const services = uniquePreserveOrder(pendingTransfers.map((x) => x.destination));

    let currentStateUpdate = AccumulationStateUpdate.new(inputServicesUpdate);

    for (const serviceId of services) {
      const partiallyUpdatedState = new PartiallyUpdatedState(this.state, currentStateUpdate);
      // https://graypaper.fluffylabs.dev/#/38c4e62/18750318ae03?v=0.7.0
      const transfers = pendingTransfers
        .filter((pendingTransfer) => pendingTransfer.destination === serviceId)
        .toSorted((a, b) => a.source - b.source);

      const info = partiallyUpdatedState.getServiceInfo(serviceId);
      if (info === null) {
        return Result.error(
          DeferredTransfersErrorCode.ServiceInfoNotExist,
          () => `Deferred transfers: service info not found for ${serviceId}`,
        );
      }
      const codeHash = info.codeHash;
      const code = partiallyUpdatedState.getPreimage(serviceId, codeHash.asOpaque());

      const newBalance = sumU64(info.balance, ...transfers.map((item) => item.amount));

      if (newBalance.overflow) {
        return Result.error(
          DeferredTransfersErrorCode.ServiceBalanceOverflow,
          () => `Deferred transfers: balance overflow for service ${serviceId}`,
        );
      }

      const newInfo = ServiceAccountInfo.create({ ...info, balance: newBalance.value });
      partiallyUpdatedState.updateServiceInfo(serviceId, newInfo);

      const partialState = new AccumulateExternalities(
        this.chainSpec,
        this.blake2b,
        partiallyUpdatedState,
        serviceId,
        serviceId,
        timeslot,
      );

      const fetchExternalities = FetchExternalities.createForOnTransfer({ entropy, transfers }, this.chainSpec);
      let consumedGas = tryAsGas(0);

      const hasTransfers = transfers.length > 0;
      const isCodeCorrect = code !== null && code.length <= W_C;
      if (!hasTransfers || !isCodeCorrect) {
        if (code === null) {
          logger.trace`Skipping ON_TRANSFER execution for service ${serviceId} because code is null`;
        } else if (!hasTransfers) {
          logger.trace`Skipping ON_TRANSFER execution for service ${serviceId} because there are no transfers`;
        } else {
          logger.trace`Skipping ON_TRANSFER execution for service ${serviceId} because code is too long`;
        }
      } else {
        const executor = PvmExecutor.createOnTransferExecutor(
          serviceId,
          code,
          { partialState, fetchExternalities },
          this.pvm,
        );
        const args = Encoder.encodeObject(
          ARGS_CODEC,
          { timeslot, serviceId, transfersLength: tryAsU32(transfers.length) },
          this.chainSpec,
        );

        const gas = transfers.reduce((acc, item) => acc + item.gas, 0n);
        consumedGas = (await executor.run(args, tryAsGas(gas))).consumedGas;
      }

      transferStatistics.set(serviceId, { count: tryAsU32(transfers.length), gasUsed: tryAsServiceGas(consumedGas) });
      const [updatedState, checkpointedState] = partialState.getStateUpdates();
      currentStateUpdate = updatedState;
      check`${checkpointedState === null} On transfer cannot invoke checkpoint.`;
    }

    return Result.ok({
      // NOTE: we return only services, since it's impossible to update
      // anything else during `on_transfer` call.
      servicesUpdate: currentStateUpdate.services,
      transferStatistics,
    });
  }
}

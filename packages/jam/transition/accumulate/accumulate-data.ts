import { type ServiceGas, type ServiceId, tryAsServiceGas } from "@typeberry/block";
import type { WorkReport } from "@typeberry/block/work-report.js";
import type { ArrayView } from "@typeberry/collections";
import type { PendingTransfer } from "@typeberry/jam-host-calls";
import { sumU64, tryAsU32, tryAsU64, type U32 } from "@typeberry/numbers";
import type { AutoAccumulate } from "@typeberry/state";
import { Operand } from "./operand.js";

const MAX_U64 = tryAsU64(2n ** 64n - 1n);

class AccumulateDataItem {
  private constructor(
    public operands: Operand[],
    public reportsLength: U32,
  ) {}

  static empty() {
    return new AccumulateDataItem([], tryAsU32(0));
  }
}

/**
 *  Utility class for transforming reports into a format that provides easy access to:
 * - all service ids that are under accumulation
 * - operands for each service (PVM invocation)
 * - gas cost and reports length for each service (statistics)
 */
export class AccumulateData {
  private readonly reportsDataByServiceId: Map<ServiceId, AccumulateDataItem>;
  private readonly transfersByServiceId: Map<ServiceId, PendingTransfer[]>;
  private readonly gasByServiceId: Map<ServiceId, ServiceGas>;
  private readonly serviceIds: ServiceId[];

  constructor(
    reports: ArrayView<WorkReport>,
    transfers: PendingTransfer[],
    autoAccumulateServices: readonly AutoAccumulate[],
  ) {
    const { serviceIds: serviceIdsFromAutoAccumulate, gasByServiceId: autoAccumulateGasByServiceId } =
      this.transformAutoAccumulateServices(autoAccumulateServices);
    const {
      reportsDataByServiceId,
      serviceIds: serviceIdsFromReports,
      gasByServiceId: reportsGasByServiceId,
    } = this.transformReports(reports);
    this.reportsDataByServiceId = reportsDataByServiceId;

    const {
      transfersByServiceId,
      serviceIds: serviceIdsFromTransfers,
      gasByServiceId: transfersGasByServiceId,
    } = this.transformTransfers(transfers);
    this.transfersByServiceId = transfersByServiceId;
    /**
     * Merge service ids from reports, auto-accumulate services and transfers.
     *
     * https://graypaper.fluffylabs.dev/#/ab2cdbd/173803174b03?v=0.7.2
     */
    this.serviceIds = this.mergeServiceIds(
      serviceIdsFromReports,
      serviceIdsFromAutoAccumulate,
      serviceIdsFromTransfers,
    );

    /**
     * Merge gas limits from reports, auto-accumulate services and transfers.
     *
     * https://graypaper.fluffylabs.dev/#/ab2cdbd/182001183701?v=0.7.2
     */
    this.gasByServiceId = this.mergeGasByServiceId(
      this.serviceIds,
      autoAccumulateGasByServiceId,
      reportsGasByServiceId,
      transfersGasByServiceId,
    );
  }

  /**
   * Calculate the gas limit implied by the selected deferred-transfers, work-reports and gas-privileges.
   *
   * https://graypaper.fluffylabs.dev/#/ab2cdbd/182001183701?v=0.7.2
   */
  private mergeGasByServiceId(serviceIds: ServiceId[], ...gasByServiceIdMaps: Map<ServiceId, ServiceGas>[]) {
    const gasByServiceId: Map<ServiceId, ServiceGas> = new Map();

    for (const serviceId of serviceIds) {
      const gas = gasByServiceIdMaps.reduce((gas, map) => {
        const valueToAdd = map.get(serviceId) ?? tryAsU64(0n);
        const { overflow, value } = sumU64(gas, valueToAdd);
        if (overflow) {
          return tryAsServiceGas(MAX_U64);
        }
        return tryAsServiceGas(value);
      }, tryAsServiceGas(0));

      gasByServiceId.set(serviceId, gas);
    }

    return gasByServiceId;
  }

  /** Merge two sets of service ids */
  private mergeServiceIds(...sources: Set<ServiceId>[]) {
    const merged = new Set<ServiceId>();

    for (const source of sources) {
      for (const serviceId of source) {
        merged.add(serviceId);
      }
    }

    return Array.from(merged);
  }

  /**
   * Transform the list of pending transfers into:
   * - map: transfers by service id
   * - map: gas limit by service id
   * - set: service ids
   */
  private transformTransfers(transfersToTransform: PendingTransfer[]) {
    const transfersByServiceId = new Map<ServiceId, PendingTransfer[]>();
    const serviceIds = new Set<ServiceId>();
    const gasByServiceId: Map<ServiceId, ServiceGas> = new Map();

    for (const transfer of transfersToTransform) {
      const serviceId = transfer.destination;
      const transfers = transfersByServiceId.get(serviceId) ?? [];
      const gas = gasByServiceId.get(serviceId) ?? tryAsServiceGas(0n);
      const { value, overflow } = sumU64(gas, transfer.gas);
      gasByServiceId.set(serviceId, tryAsServiceGas(overflow ? MAX_U64 : value));
      transfers.push(transfer);
      transfersByServiceId.set(serviceId, transfers);
      serviceIds.add(serviceId);
    }

    return { transfersByServiceId, serviceIds, gasByServiceId };
  }

  /**
   * Transform the list of auto accumulate services into:
   * - map: gas limit by service id
   * - set: service ids
   */
  private transformAutoAccumulateServices(autoAccumulateServices: readonly AutoAccumulate[]) {
    const serviceIds = new Set<ServiceId>();
    const gasByServiceId: Map<ServiceId, ServiceGas> = new Map();

    for (const autoAccumulate of autoAccumulateServices) {
      gasByServiceId.set(autoAccumulate.service, autoAccumulate.gasLimit);
      serviceIds.add(autoAccumulate.service);
    }

    return { serviceIds, gasByServiceId };
  }

  /**
   * A function that transform reports into a list of operands and data needed for statistics (gas cost and reports length).
   */

  /**
   * Transform the list of reports into:
   * - map: AccumulateDataItem by service id
   * - map: gas limit by service id
   * - set: service ids
   */
  private transformReports(reports: ArrayView<WorkReport>) {
    const reportsDataByServiceId = new Map<ServiceId, AccumulateDataItem>();
    const gasByServiceId: Map<ServiceId, ServiceGas> = new Map();
    const serviceIds = new Set<ServiceId>();

    for (const report of reports) {
      for (const result of report.results) {
        const serviceId = result.serviceId;
        serviceIds.add(serviceId);

        const item = reportsDataByServiceId.get(serviceId) ?? AccumulateDataItem.empty();
        const gas = gasByServiceId.get(serviceId) ?? tryAsServiceGas(0n);
        const { value, overflow } = sumU64(gas, result.gas);
        const newGas = tryAsServiceGas(overflow ? tryAsServiceGas(MAX_U64) : value);
        gasByServiceId.set(serviceId, newGas);

        /**
         * We count the report results and gas cost for each service to update service statistics.
         *
         * https://graypaper.fluffylabs.dev/#/ab2cdbd/180504182604?v=0.7.2
         */
        item.reportsLength = tryAsU32(item.reportsLength + 1);
        /**
         * Transform report into an operand
         *
         * https://graypaper.fluffylabs.dev/#/ab2cdbd/185901181402?v=0.7.2
         */
        item.operands.push(
          Operand.new({
            gas: result.gas, // g
            payloadHash: result.payloadHash, // y
            result: result.result, // d
            authorizationOutput: report.authorizationOutput, // o
            exportsRoot: report.workPackageSpec.exportsRoot, // e
            hash: report.workPackageSpec.hash, // h
            authorizerHash: report.authorizerHash, // a
          }),
        );

        reportsDataByServiceId.set(serviceId, item);
      }
    }

    return { reportsDataByServiceId, serviceIds, gasByServiceId };
  }

  /** Returns the list of operands for a given service id */
  getOperands(serviceId: ServiceId): Operand[] {
    return this.reportsDataByServiceId.get(serviceId)?.operands ?? [];
  }

  /** Returns the list of transfers for a given service id */
  getTransfers(serviceId: ServiceId): PendingTransfer[] {
    return this.transfersByServiceId.get(serviceId) ?? [];
  }

  /** Returns the number of reports to acccumulate for a given service id */
  getReportsLength(serviceId: ServiceId): U32 {
    return this.reportsDataByServiceId.get(serviceId)?.reportsLength ?? tryAsU32(0);
  }

  /** Returns the gas cost for a given service id */
  getGasCost(serviceId: ServiceId): ServiceGas {
    return this.gasByServiceId.get(serviceId) ?? tryAsServiceGas(0n);
  }

  /**
   * Returns a list of service ids that should be accumulated.
   *
   * https://graypaper.fluffylabs.dev/#/ab2cdbd/173803174a03?v=0.7.2
   */
  getServiceIds(): ServiceId[] {
    return this.serviceIds;
  }
}

import { type ServiceGas, type ServiceId, tryAsServiceGas } from "@typeberry/block";
import type { WorkReport } from "@typeberry/block/work-report.js";
import { type U32, tryAsU32 } from "@typeberry/numbers";
import type { AutoAccumulate } from "@typeberry/state";
import { Operand } from "./operand.js";

class AccumulateDataItem {
  private constructor(
    public operands: Operand[],
    public reportsLength: U32,
    public gasCost: ServiceGas,
  ) {}

  static empty() {
    return new AccumulateDataItem([], tryAsU32(0), tryAsServiceGas(0n));
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
  private readonly autoAccumulateServicesByServiceId: Map<ServiceId, AutoAccumulate>;
  private readonly serviceIds: ServiceId[];

  constructor(reports: readonly WorkReport[], autoAccumulateServices: readonly AutoAccumulate[]) {
    const { autoAccumulateServicesByServiceId, serviceIds: serviceIdsFromAutoAccumulate } =
      this.transformAutoAccumulateServices(autoAccumulateServices);
    this.autoAccumulateServicesByServiceId = autoAccumulateServicesByServiceId;
    const { reportsDataByServiceId, serviceIds: serviceIdsFromReports } = this.transformReports(reports);
    this.reportsDataByServiceId = reportsDataByServiceId;

    /**
     * Merge service ids from reports and auto-accumulate services.
     *
     * https://graypaper.fluffylabs.dev/#/68eaa1f/175f01175f01?v=0.6.4
     */
    this.serviceIds = this.mergeServiceIds(serviceIdsFromReports, serviceIdsFromAutoAccumulate);
  }

  /** Merge two sets of service ids */
  private mergeServiceIds(source1: Set<ServiceId>, source2: Set<ServiceId>) {
    const merged = new Set<ServiceId>();

    for (const serviceId of source1) {
      merged.add(serviceId);
    }

    for (const serviceId of source2) {
      merged.add(serviceId);
    }

    return Array.from(merged);
  }

  /** Transform the list of auto-accumulate services into a map by service id. */
  private transformAutoAccumulateServices(autoAccumulateServices: readonly AutoAccumulate[]) {
    const serviceIds = new Set<ServiceId>();
    const autoAccumulateServicesByServiceId = new Map<ServiceId, AutoAccumulate>();
    for (const autoAccumulate of autoAccumulateServices) {
      autoAccumulateServicesByServiceId.set(autoAccumulate.service, autoAccumulate);
      serviceIds.add(autoAccumulate.service);
    }
    return { autoAccumulateServicesByServiceId, serviceIds };
  }

  /**
   * A function that transform reports into a list of operands and data needed for statistics (gas cost and reports length).
   */
  private transformReports(reports: readonly WorkReport[]) {
    const reportsDataByServiceId = new Map<ServiceId, AccumulateDataItem>();
    const serviceIds = new Set<ServiceId>();

    for (const report of reports) {
      for (const result of report.results) {
        const serviceId = result.serviceId;
        serviceIds.add(serviceId);

        const item = reportsDataByServiceId.get(serviceId) ?? AccumulateDataItem.empty();

        /**
         * We count the report results and gas cost for each service to update service statistics.
         *
         * https://graypaper.fluffylabs.dev/#/68eaa1f/171e04174a04?v=0.6.4
         */
        item.reportsLength = tryAsU32(item.reportsLength + 1);
        item.gasCost = tryAsServiceGas(item.gasCost + result.gas);

        /**
         * Transform report into an operand
         *
         * https://graypaper.fluffylabs.dev/#/68eaa1f/17bf02176f03?v=0.6.4
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

    /**
     * Add initial gas cost - it is `U(f_s, 0)` from this formula:
     *
     * https://graypaper.fluffylabs.dev/#/68eaa1f/17b00217b002?v=0.6.4
     */
    for (const serviceId of serviceIds) {
      const item = reportsDataByServiceId.get(serviceId) ?? null;
      const autoAccumulateService = this.autoAccumulateServicesByServiceId.get(serviceId) ?? null;
      if (item !== null && autoAccumulateService !== null) {
        item.gasCost = tryAsServiceGas(item.gasCost + autoAccumulateService.gasLimit);
      }
    }

    for (const key of this.autoAccumulateServicesByServiceId.keys()) {
      serviceIds.add(key);
    }

    return { reportsDataByServiceId, serviceIds };
  }

  /** Returns the list of operands for a given service id */
  getOperands(serviceId: ServiceId): Operand[] {
    return this.reportsDataByServiceId.get(serviceId)?.operands ?? [];
  }

  /** Returns the gas cost for a given service id */
  getReportsLength(serviceId: ServiceId): U32 {
    return this.reportsDataByServiceId.get(serviceId)?.reportsLength ?? tryAsU32(0);
  }

  /** Returns the gas cost for a given service id */
  getGasCost(serviceId: ServiceId): ServiceGas {
    return this.reportsDataByServiceId.get(serviceId)?.gasCost ?? tryAsServiceGas(0n);
  }

  /**
   * Returns a list of service ids that should be accumulated.
   *
   * https://graypaper.fluffylabs.dev/#/68eaa1f/175f01175f01?v=0.6.4
   */
  getServiceIds(): ServiceId[] {
    return this.serviceIds;
  }
}

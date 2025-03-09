import type { EntropyHash, TimeSlot } from "@typeberry/block";
import type { WorkPackageHash, WorkReport } from "@typeberry/block/work-report";
import type { ChainSpec } from "@typeberry/config";
import type { OpaqueHash } from "@typeberry/hash";
import type { Service } from "@typeberry/state";
import { Result } from "@typeberry/utils";

export type AccumulateRoot = OpaqueHash;

export type AccumulateInput = {
  slot: TimeSlot;
  reports: WorkReport[];
};

export type ReadyRecordItem = {
  report: WorkReport;
  dependencies: WorkPackageHash[];
};

export type AccumulateState = {
  slot: TimeSlot;
  entropy: EntropyHash;
  readyQueue: ReadyRecordItem[][];
  accumulated: WorkPackageHash[][];
  privileges: {
    bless: number;
    assign: number;
    designate: number;
    alwaysAcc: { id: number; gas: number }[];
  };
  services: Service[];
};

export type AccumulateOutput = {
  ok: AccumulateRoot;
};

export class Accumulate {
  constructor(
    public readonly state: AccumulateState,
    private readonly chainSpec: ChainSpec,
  ) {}

  async transition(_input: AccumulateInput): Promise<Result<AccumulateOutput, null>> {
    return Result.error(null);
  }
}

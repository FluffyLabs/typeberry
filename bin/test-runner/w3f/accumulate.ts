import {
  type EntropyHash,
  type ServiceId,
  type TimeSlot,
  tryAsPerEpochBlock,
  tryAsServiceGas,
  tryAsServiceId,
} from "@typeberry/block";
import { fromJson, workReportFromJson } from "@typeberry/block-json";
import type { WorkPackageHash, WorkReport } from "@typeberry/block/work-report";
import { HashSet, asKnownSize } from "@typeberry/collections";
import { type ChainSpec, fullChainSpec, tinyChainSpec } from "@typeberry/config";
import { type FromJson, json } from "@typeberry/json-parser";
import { AutoAccumulate, PrivilegedServices, type Service } from "@typeberry/state";
import { JsonService } from "@typeberry/state-json/accounts";
import { NotYetAccumulatedReport } from "@typeberry/state/not-yet-accumulated";
import {
  Accumulate,
  type AccumulateInput,
  type AccumulateRoot,
  type AccumulateState,
} from "@typeberry/transition/accumulate";
import { Result, deepEqual } from "@typeberry/utils";

class Input {
  static fromJson: FromJson<Input> = {
    slot: "number",
    reports: json.array(workReportFromJson),
  };

  slot!: TimeSlot;
  reports!: WorkReport[];
}

function getTestStateClass(chainSpec: ChainSpec) {
  return class TestStateTemplate {
    static fromJson = json.object<TestStateTemplate, AccumulateState>(
      {
        slot: "number",
        entropy: fromJson.bytes32(),
        ready_queue: [
          "array",
          json.array({
            report: workReportFromJson,
            dependencies: json.array(fromJson.bytes32()),
          }),
        ],
        accumulated: ["array", json.array(fromJson.bytes32())],
        privileges: {
          bless: "number",
          assign: "number",
          designate: "number",
          always_acc: json.array({
            id: "number",
            gas: "number",
          }),
        },
        accounts: json.array(JsonService.fromJson),
      },
      ({ accounts, accumulated, entropy, privileges, ready_queue, slot }): AccumulateState => {
        const services: Map<ServiceId, Service> = new Map();

        for (const service of accounts) {
          services.set(service.id, service);
        }
        return {
          timeslot: slot,
          entropy,
          accumulationQueue: tryAsPerEpochBlock(
            ready_queue.map((queue) =>
              queue.map((item) =>
                NotYetAccumulatedReport.create({ report: item.report, dependencies: asKnownSize(item.dependencies) }),
              ),
            ),
            chainSpec,
          ),
          recentlyAccumulated: tryAsPerEpochBlock(
            accumulated.map((queue) => HashSet.from(queue)),
            chainSpec,
          ),
          privilegedServices: PrivilegedServices.create({
            manager: tryAsServiceId(privileges.bless),
            authManager: tryAsServiceId(privileges.assign),
            validatorsManager: tryAsServiceId(privileges.designate),
            autoAccumulateServices: privileges.always_acc.map(({ gas, id }) =>
              AutoAccumulate.create({ gasLimit: tryAsServiceGas(gas), service: tryAsServiceId(id) }),
            ),
          }),
          services,
        };
      },
    );

    slot!: TimeSlot;
    entropy!: EntropyHash;
    ready_queue!: { report: WorkReport; dependencies: WorkPackageHash[] }[][];
    accumulated!: WorkPackageHash[][];
    privileges!: {
      bless: number;
      assign: number;
      designate: number;
      always_acc: { id: number; gas: number }[];
    };
    accounts!: Service[];
  };
}

export const TestStateTiny = getTestStateClass(tinyChainSpec);
export const TestStateFull = getTestStateClass(fullChainSpec);

class Output {
  static fromJson: FromJson<Output> = {
    ok: fromJson.bytes32(),
  };

  ok!: AccumulateRoot;

  static toAccumulateOutput(output: Output): Result<AccumulateRoot, never> {
    return Result.ok(output.ok);
  }
}

export class AccumulateTestTiny {
  static fromJson: FromJson<AccumulateTestTiny> = {
    input: Input.fromJson,
    pre_state: TestStateTiny.fromJson,
    output: Output.fromJson,
    post_state: TestStateTiny.fromJson,
  };

  input!: AccumulateInput;
  pre_state!: AccumulateState;
  output!: Output;
  post_state!: AccumulateState;
}

export class AccumulateTestFull {
  static fromJson: FromJson<AccumulateTestTiny> = {
    input: Input.fromJson,
    pre_state: TestStateFull.fromJson,
    output: Output.fromJson,
    post_state: TestStateFull.fromJson,
  };

  input!: AccumulateInput;
  pre_state!: AccumulateState;
  output!: Output;
  post_state!: AccumulateState;
}

export async function runAccumulateTestTiny(test: AccumulateTestTiny) {
  const accumulate = new Accumulate(test.pre_state, tinyChainSpec);
  const result = await accumulate.transition(test.input);

  deepEqual(test.post_state, accumulate.state);
  deepEqual(test.output.ok, result);
}

export async function runAccumulateTestFull(test: AccumulateTestFull) {
  const accumulate = new Accumulate(test.pre_state, fullChainSpec);
  const result = await accumulate.transition(test.input);

  deepEqual(test.post_state, accumulate.state);
  deepEqual(test.output.ok, result);
}

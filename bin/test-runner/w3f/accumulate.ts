import { type EntropyHash, type ServiceId, type TimeSlot, tryAsServiceGas, tryAsServiceId } from "@typeberry/block";
import { fromJson, workReportFromJson } from "@typeberry/block-json";
import type { WorkPackageHash, WorkReport } from "@typeberry/block/work-report";
import { type FromJson, json } from "@typeberry/json-parser";
import { AutoAccumulate, PrivilegedServices, type Service } from "@typeberry/state";
import { JsonService } from "@typeberry/state-json/accounts";
import {
  Accumulate,
  type AccumulateInput,
  type AccumulateRoot,
  type AccumulateState,
} from "@typeberry/transition/accumulate";
import { Result, deepEqual } from "@typeberry/utils";
import { getChainSpec } from "./spec";

class Input {
  static fromJson: FromJson<Input> = {
    slot: "number",
    reports: json.array(workReportFromJson),
  };

  slot!: TimeSlot;
  reports!: WorkReport[];
}

class ReadyRecordItem {
  static fromJson: FromJson<ReadyRecordItem> = {
    report: workReportFromJson,
    dependencies: json.array(fromJson.bytes32()),
  };
  report!: WorkReport;
  dependencies!: WorkPackageHash[];
}

class TestState {
  static fromJson = json.object<TestState, AccumulateState>(
    {
      slot: "number",
      entropy: fromJson.bytes32(),
      ready_queue: ["array", json.array(ReadyRecordItem.fromJson)],
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
    ({ accounts, accumulated, entropy, privileges, ready_queue, slot }) => {
      const services: Map<ServiceId, Service> = new Map();

      for (const service of accounts) {
        services.set(service.id, service);
      }
      return {
        timeslot: slot,
        entropy,
        readyQueue: ready_queue,
        accumulated,
        privileges: PrivilegedServices.create({
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
  ready_queue!: ReadyRecordItem[][];
  accumulated!: WorkPackageHash[][];
  privileges!: {
    bless: number;
    assign: number;
    designate: number;
    always_acc: { id: number; gas: number }[];
  };
  accounts!: Service[];
}

class Output {
  static fromJson: FromJson<Output> = {
    ok: fromJson.bytes32(),
  };

  ok!: AccumulateRoot;

  static toAccumulateOutput(output: Output): Result<AccumulateRoot, never> {
    return Result.ok(output.ok);
  }
}

export class AccumulateTest {
  static fromJson: FromJson<AccumulateTest> = {
    input: Input.fromJson,
    pre_state: TestState.fromJson,
    output: Output.fromJson,
    post_state: TestState.fromJson,
  };

  input!: AccumulateInput;
  pre_state!: AccumulateState;
  output!: Output;
  post_state!: AccumulateState;
}

export async function runAccumulateTest(test: AccumulateTest, path: string) {
  const chainSpec = getChainSpec(path);

  const accumulate = new Accumulate(chainSpec, test.pre_state);
  const result = await accumulate.transition(test.input);

  deepEqual(test.post_state, accumulate.state);
  deepEqual(Output.toAccumulateOutput(test.output), result);
}

import type { EntropyHash, TimeSlot } from "@typeberry/block";
import { fromJson, workReportFromJson } from "@typeberry/block-json";
import type { WorkPackageHash, WorkReport } from "@typeberry/block/work-report";
import { type FromJson, json } from "@typeberry/json-parser";
import type { InMemoryService } from "@typeberry/state";
import { JsonService } from "@typeberry/state-json/accounts";
import {
  Accumulate,
  type AccumulateInput,
  type AccumulateOutput,
  type AccumulateRoot,
  type AccumulateState,
} from "@typeberry/transition/accumulate";
import { deepEqual } from "@typeberry/utils";
import { logger } from "../common";
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
    ({ accounts, accumulated, entropy, privileges, ready_queue, slot }) => ({
      slot,
      entropy,
      readyQueue: ready_queue,
      accumulated,
      privileges: {
        bless: privileges.bless,
        assign: privileges.assign,
        designate: privileges.designate,
        alwaysAcc: privileges.always_acc,
      },
      services: accounts,
    }),
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
  accounts!: InMemoryService[];
}

class Output {
  static fromJson: FromJson<Output> = {
    ok: fromJson.bytes32(),
  };

  ok!: AccumulateRoot;
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
  output!: AccumulateOutput;
  post_state!: AccumulateState;
}

export async function runAccumulateTest(test: AccumulateTest, path: string) {
  const chainSpec = getChainSpec(path);

  const accumulate = new Accumulate(chainSpec, test.pre_state);
  await accumulate.transition(test.input);

  if (path.length > 0) {
    logger.error(`Ignoring accumulate test: ${path}`);
  } else {
    deepEqual(test.post_state, accumulate.state);
  }
}

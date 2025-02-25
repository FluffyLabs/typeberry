import type { EntropyHash, TimeSlot } from "@typeberry/block";
import type { WorkPackageHash, WorkReport } from "@typeberry/block/work-report";
import { type FromJson, json } from "@typeberry/json-parser";
import type { Service } from "@typeberry/state";
import {
  Accumulate,
  type AccumulateInput,
  type AccumulateOutput,
  type AccumulateRoot,
  type AccumulateState,
} from "@typeberry/transition/accumulate";
import { workReportFromJson } from "./codec/work-report";
import { TestAccountItem, commonFromJson, getChainSpec } from "./common-types";

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
    dependencies: json.array(commonFromJson.bytes32()),
  };
  report!: WorkReport;
  dependencies!: WorkPackageHash[];
}

class TestState {
  static fromJson = json.object<TestState, AccumulateState>(
    {
      slot: "number",
      entropy: commonFromJson.bytes32(),
      ready_queue: ["array", json.array(ReadyRecordItem.fromJson)],
      accumulated: ["array", json.array(commonFromJson.bytes32())],
      privileges: {
        bless: "number",
        assign: "number",
        designate: "number",
        always_acc: json.array({
          id: "number",
          gas: "number",
        }),
      },
      accounts: json.array(TestAccountItem.fromJson),
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
  accounts!: Service[];
}

class Output {
  static fromJson: FromJson<Output> = {
    ok: commonFromJson.bytes32(),
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

  const accumulate = new Accumulate(test.pre_state, chainSpec);
  await accumulate.transition(test.input);

  // deepEqual(test.post_state, authorization.state);
}

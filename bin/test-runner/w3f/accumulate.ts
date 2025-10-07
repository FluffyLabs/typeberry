import assert from "node:assert";
import {
  type EntropyHash,
  type ServiceGas,
  type ServiceId,
  type TimeSlot,
  tryAsPerEpochBlock,
  tryAsServiceGas,
  tryAsServiceId,
} from "@typeberry/block";
import type { WorkPackageHash } from "@typeberry/block/refine-context.js";
import type { WorkReport } from "@typeberry/block/work-report.js";
import { fromJson, workReportFromJson } from "@typeberry/block-json";
import { asKnownSize, HashSet } from "@typeberry/collections";
import type { ChainSpec } from "@typeberry/config";
import { Blake2b } from "@typeberry/hash";
import { type FromJson, json } from "@typeberry/json-parser";
import type { InMemoryService } from "@typeberry/state";
import { AutoAccumulate, InMemoryState, PrivilegedServices, tryAsPerCore } from "@typeberry/state";
import { NotYetAccumulatedReport } from "@typeberry/state/not-yet-accumulated.js";
import { JsonService } from "@typeberry/state-json/accounts.js";
import { AccumulateOutput } from "@typeberry/transition/accumulate/accumulate-output.js";
import { Accumulate, type AccumulateRoot } from "@typeberry/transition/accumulate/index.js";
import { Compatibility, deepEqual, GpVersion, Result } from "@typeberry/utils";
import { getChainSpec } from "./spec.js";

class Input {
  static fromJson: FromJson<Input> = {
    slot: "number",
    reports: json.array(workReportFromJson),
  };

  slot!: TimeSlot;
  reports!: WorkReport[];
}

class TestState {
  static fromJson = json.object<TestState, TestState>(
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
        assign: json.array("number"),
        designate: "number",
        register: json.optional("number"),
        always_acc: json.array({
          id: "number",
          gas: json.fromNumber((x) => tryAsServiceGas(x)),
        }),
      },
      accounts: json.array(JsonService.fromJson),
    },
    (x) => x,
  );

  slot!: TimeSlot;
  entropy!: EntropyHash;
  ready_queue!: { report: WorkReport; dependencies: WorkPackageHash[] }[][];
  accumulated!: WorkPackageHash[][];
  privileges!: {
    bless: ServiceId;
    assign: ServiceId[];
    designate: ServiceId;
    register?: ServiceId;
    always_acc: { id: ServiceId; gas: ServiceGas }[];
  };
  accounts!: InMemoryService[];

  static toAccumulateState(
    { accounts, slot, ready_queue, accumulated, privileges }: TestState,
    chainSpec: ChainSpec,
  ): InMemoryState {
    if (Compatibility.isGreaterOrEqual(GpVersion.V0_7_1) && privileges.register === undefined)
      throw new Error("Privileges from version 0.7.1 should have register field!");
    return InMemoryState.partial(chainSpec, {
      timeslot: slot,
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
        manager: privileges.bless,
        assigners: tryAsPerCore(privileges.assign, chainSpec),
        delegator: privileges.designate,
        registrar: privileges.register ?? tryAsServiceId(0),
        autoAccumulateServices: privileges.always_acc.map(({ gas, id }) =>
          AutoAccumulate.create({ gasLimit: gas, service: id }),
        ),
      }),
      services: new Map(accounts.map((service) => [service.serviceId, service])),
    });
  }
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

  input!: Input;
  pre_state!: TestState;
  output!: Output;
  post_state!: TestState;
}

export async function runAccumulateTest(test: AccumulateTest, path: string) {
  const chainSpec = getChainSpec(path);

  /**
   * entropy has to be moved to input because state is incompatibile -
   * in test state we have: `entropy: EntropyHash;`
   * in typeberry state we have: `entropy: FixedSizeArray<EntropyHash, ENTROPY_ENTRIES>;`
   * The accumulation doesn't modify entropy so we can remove it safely from pre/post state
   */
  const entropy = test.pre_state.entropy;

  const state = TestState.toAccumulateState(test.pre_state as TestState, chainSpec);
  const accumulate = new Accumulate(chainSpec, await Blake2b.createHasher(), state);
  const accumulateOutput = new AccumulateOutput();
  const result = await accumulate.transition({ ...test.input, entropy });

  if (result.isError) {
    assert.fail(`Expected successfull accumulation, got: ${result}`);
  }
  const accumulateRoot = await accumulateOutput.transition({ accumulationOutputLog: result.ok.accumulationOutputLog });
  state.applyUpdate(result.ok.stateUpdate);

  const post_state = TestState.toAccumulateState(test.post_state as TestState, chainSpec);

  deepEqual(state, post_state);
  deepEqual(accumulateRoot, test.output.ok);
}

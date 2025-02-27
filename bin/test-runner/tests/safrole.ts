import {
  BANDERSNATCH_PROOF_BYTES,
  BANDERSNATCH_RING_ROOT_BYTES,
  type BandersnatchKey,
  type BandersnatchProof,
  type BandersnatchRingRoot,
  type Ed25519Key,
  type EntropyHash,
  type TimeSlot,
  tryAsPerValidator,
  tryAsTimeSlot,
} from "@typeberry/block";
import type { SignedTicket, Ticket } from "@typeberry/block/tickets";
import { Bytes, BytesBlob } from "@typeberry/bytes";
import { FixedSizeArray, SortedSet } from "@typeberry/collections";
import type { ChainSpec } from "@typeberry/config";
import { type FromJson, json } from "@typeberry/json-parser";
import { Safrole } from "@typeberry/safrole";
import type { Input, OkResult } from "@typeberry/safrole/safrole";
import { ENTROPY_ENTRIES, type ValidatorData, hashComparator } from "@typeberry/state";
import { deepEqual } from "@typeberry/utils";
import { commonFromJson, getChainSpec } from "./common-types";
namespace safroleFromJson {
  export const bytesBlob = json.fromString(BytesBlob.parseBlob);

  export const ticketBody: FromJson<Ticket> = {
    id: commonFromJson.bytes32(),
    attempt: "number",
  };

  export const ticketEnvelope: FromJson<SignedTicket> = {
    attempt: "number",
    signature: json.fromString((v) => Bytes.parseBytes(v, BANDERSNATCH_PROOF_BYTES) as BandersnatchProof),
  };
}

export class TicketsOrKeys {
  static fromJson: FromJson<TicketsOrKeys> = {
    keys: json.optional<BandersnatchKey[]>(json.array(commonFromJson.bytes32())),
    tickets: json.optional<Ticket[]>(json.array(safroleFromJson.ticketBody)),
  };

  keys?: BandersnatchKey[];
  tickets?: Ticket[];
}

class JsonState {
  static fromJson: FromJson<JsonState> = {
    tau: "number",
    eta: json.array(commonFromJson.bytes32()),
    lambda: json.array(commonFromJson.validatorData),
    kappa: json.array(commonFromJson.validatorData),
    gamma_k: json.array(commonFromJson.validatorData),
    iota: json.array(commonFromJson.validatorData),
    gamma_a: json.array(safroleFromJson.ticketBody),
    gamma_s: TicketsOrKeys.fromJson,
    gamma_z: json.fromString((v) => Bytes.parseBytes(v, BANDERSNATCH_RING_ROOT_BYTES).asOpaque()),
    post_offenders: json.array(commonFromJson.bytes32()),
  };
  // timeslot
  tau!: TimeSlot;
  // entropy
  eta!: [EntropyHash, EntropyHash, EntropyHash, EntropyHash];
  // previous validators
  lambda!: ValidatorData[];
  // current validators
  kappa!: ValidatorData[];
  // next validators
  gamma_k!: ValidatorData[];
  // designatedValidators
  iota!: ValidatorData[];
  // Sealing-key contest ticket accumulator.
  gamma_a!: Ticket[];
  // sealing-key series of current epoch
  gamma_s!: TicketsOrKeys;
  // bandersnatch ring comittment
  gamma_z!: BandersnatchRingRoot;
  // posterior offenders sequence
  post_offenders!: Ed25519Key[];

  static toSafroleState(state: JsonState, chainSpec: ChainSpec) {
    return {
      timeslot: state.tau,
      entropy: FixedSizeArray.new(state.eta, ENTROPY_ENTRIES),
      previousValidatorData: tryAsPerValidator(state.lambda, chainSpec),
      currentValidatorData: tryAsPerValidator(state.kappa, chainSpec),
      nextValidatorData: tryAsPerValidator(state.gamma_k, chainSpec),
      designatedValidatorData: tryAsPerValidator(state.iota, chainSpec),
      ticketsAccumulator: state.gamma_a,
      sealingKeySeries: state.gamma_s,
      epochRoot: state.gamma_z.asOpaque(),
      punishSet: SortedSet.fromSortedArray(hashComparator, state.post_offenders),
    };
  }
}

export class EpochMark {
  static fromJson: FromJson<EpochMark> = {
    entropy: commonFromJson.bytes32(),
    tickets_entropy: commonFromJson.bytes32(),
    validators: json.array(commonFromJson.bytes32()),
  };

  entropy!: EntropyHash;
  tickets_entropy!: EntropyHash;
  validators!: BandersnatchKey[];
}

export class OkOutput {
  static fromJson: FromJson<OkOutput> = {
    epoch_mark: json.optional(EpochMark.fromJson),
    tickets_mark: json.optional<Ticket[]>(json.array(safroleFromJson.ticketBody)),
  };
  epoch_mark?: EpochMark;
  tickets_mark?: Ticket[];
}

export class Output {
  static fromJson: FromJson<Output> = {
    ok: json.optional(OkOutput.fromJson),
    err: json.optional("string"),
  };

  ok?: OkOutput;
  err?: string;

  static toSafroleOutput(output: Output): OkResult | undefined {
    if (!output.ok) {
      return undefined;
    }

    const epochMark = !output.ok?.epoch_mark
      ? null
      : {
          entropy: output.ok.epoch_mark?.entropy,
          ticketsEntropy: output.ok.epoch_mark?.tickets_entropy,
          validators: output.ok.epoch_mark?.validators,
        };
    return {
      epochMark,
      ticketsMark: output.ok?.tickets_mark ?? null,
    };
  }
}

class TestInput {
  static fromJson = json.object<TestInput, Input>(
    {
      slot: "number",
      entropy: commonFromJson.bytes32(),
      extrinsic: json.array(safroleFromJson.ticketEnvelope),
    },
    ({ entropy, extrinsic, slot }) => ({ entropy, extrinsic, slot: tryAsTimeSlot(slot) }),
  );

  slot!: TimeSlot;
  entropy!: EntropyHash;
  extrinsic!: SignedTicket[];
}

export class SafroleTest {
  static fromJson: FromJson<SafroleTest> = {
    input: TestInput.fromJson,
    pre_state: JsonState.fromJson,
    output: Output.fromJson,
    post_state: JsonState.fromJson,
  };

  input!: TestInput;
  pre_state!: JsonState;
  output!: Output;
  post_state!: JsonState;
}

export async function runSafroleTest(testContent: SafroleTest, path: string) {
  const chainSpec = getChainSpec(path);
  const preState = JsonState.toSafroleState(testContent.pre_state, chainSpec);
  const safrole = new Safrole(preState, chainSpec);

  const result = await safrole.transition(testContent.input);
  const error = result.isError ? result.error : undefined;
  const ok = result.isOk ? result.ok : undefined;

  deepEqual(error, testContent.output.err);
  deepEqual(ok, Output.toSafroleOutput(testContent.output));
  deepEqual(safrole.state, JsonState.toSafroleState(testContent.post_state, chainSpec));
}

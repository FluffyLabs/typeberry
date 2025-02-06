import assert from "node:assert";
import {
  BANDERSNATCH_PROOF_BYTES,
  TimeSlot,
  type BandersnatchKey,
  type BandersnatchProof,
  type Ed25519Key,
  type EntropyHash,
} from "@typeberry/block";
import type { SignedTicket, Ticket } from "@typeberry/block/tickets";
import { Bytes, BytesBlob } from "@typeberry/bytes";
import { type FromJson, json } from "@typeberry/json-parser";
import type { State as SafroleState } from "@typeberry/safrole";
import { Safrole } from "@typeberry/safrole";
import type { ValidatorData } from "@typeberry/state";
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
    gamma_z: json.fromString((v) => Bytes.parseBytes(v, 144)),
    post_offenders: json.array(commonFromJson.bytes32()),
  };
  // timeslot
  tau!: number;
  // entropy
  eta!: [EntropyHash, EntropyHash, EntropyHash, EntropyHash];
  // previous validators
  lambda!: ValidatorData[];
  // current validators
  kappa!: ValidatorData[];
  // next validators
  gamma_k!: ValidatorData[];
  // designedValidators
  iota!: ValidatorData[];
  // Sealing-key contest ticket accumulator.
  gamma_a!: Ticket[];
  // sealing-key series of current epoch
  gamma_s!: TicketsOrKeys;
  // bandersnatch ring comittment
  gamma_z!: Bytes<144>;
  // posterior offenders sequence
  post_offenders!: Ed25519Key[];
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
}

class Input {
  static fromJson: FromJson<Input> = {
    slot: "number",
    entropy: commonFromJson.bytes32(),
    extrinsic: json.array(safroleFromJson.ticketEnvelope),
  };

  slot!: number;
  entropy!: EntropyHash;
  extrinsic!: SignedTicket[];

  static toSafroleInput(testInput: Input) {
    return {
      slot: testInput.slot as TimeSlot,
      entropy: testInput.entropy as EntropyHash,
      extrinsic: testInput.extrinsic as SignedTicket[],
    };
  }
}

export class SafroleTest {
  static fromJson: FromJson<SafroleTest> = {
    input: Input.fromJson,
    pre_state: JsonState.fromJson,
    output: Output.fromJson,
    post_state: JsonState.fromJson,
  };

  input!: Input;
  pre_state!: JsonState;
  output!: Output;
  post_state!: JsonState;
}

export async function runSafroleTest(testContent: SafroleTest, path: string) {
  const chainSpec = getChainSpec(path);
  const preState = convertPreStateToModel(testContent.pre_state);
  const safrole = new Safrole(preState, chainSpec);

  const result = await safrole.transition(Input.toSafroleInput(testContent.input));
  const error = result.isError ? result.error : undefined;
  const ok = result.isOk ? result.ok : undefined;

  assert.deepEqual(error, testContent.output.err);
  assert.deepEqual(ok, convertResultToModel(testContent.output));
  assert.deepEqual(safrole.state, convertPreStateToModel(testContent.post_state));
}

function convertPreStateToModel(preState: JsonState): SafroleState {
  return {
    timeslot: preState.tau,
    entropy: preState.eta,
    prevValidators: preState.lambda,
    currValidators: preState.kappa,
    nextValidators: preState.gamma_k,
    designedValidators: preState.iota,
    ticketsAccumulator: preState.gamma_a,
    sealingKeySeries: preState.gamma_s,
    epochRoot: preState.gamma_z.asOpaque(),
    postOffenders: preState.post_offenders,
  };
}

function convertResultToModel(output: Output) {
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
    ticketsMark: output.ok?.tickets_mark,
  };
}

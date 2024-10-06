import { Bytes, BytesBlob } from "@typeberry/bytes";
import { type FromJson, json } from "@typeberry/json-parser";
import { Logger } from "@typeberry/logger";
import type { EntropyHash, State as SafroleState } from "@typeberry/safrole";
import {
  Safrole,
  type StateDiff as SafroleStateDiff,
  type TicketBody,
  type TicketEnvelope,
  type ValidatorData,
} from "@typeberry/safrole";
import type { BandersnatchKey, BandersnatchRingSignature, BlsKey, Ed25519Key } from "@typeberry/safrole/crypto";

type SnakeToCamel<S extends string> = S extends `${infer T}_${infer U}` ? `${T}${Capitalize<SnakeToCamel<U>>}` : S;

function snakeToCamel<T extends string>(s: T): SnakeToCamel<T> {
  return s.replace(/(_\w)/g, (matches) => matches[1].toUpperCase()) as SnakeToCamel<T>;
}

namespace fromJson {
  export function bytes32<TInto extends Bytes<32>>() {
    return json.fromString((v) => Bytes.parseBytes(v, 32) as TInto);
  }

  export const bytesBlob = json.fromString(BytesBlob.parseBlob);

  export const validatorData: FromJson<ValidatorData> = {
    ed25519: bytes32(),
    bandersnatch: bytes32(),
    bls: json.fromString((v) => Bytes.parseBytes(v, 144) as BlsKey),
    metadata: bytesBlob,
  };

  export const ticketBody: FromJson<TicketBody> = {
    id: bytes32(),
    attempt: "number",
  };

  export const ticketEnvelope: FromJson<TicketEnvelope> = {
    attempt: "number",
    signature: json.fromString((v) => Bytes.parseBytes(v, 784) as BandersnatchRingSignature),
  };
}

export class TicketsOrKeys {
  static fromJson: FromJson<TicketsOrKeys> = {
    tickets: json.optional<TicketBody[]>(json.array(fromJson.ticketBody)),
    keys: json.optional<BandersnatchKey[]>(json.array(fromJson.bytes32())),
  };
  tickets?: TicketBody[];
  keys?: BandersnatchKey[];
}

class JsonState {
  static fromJson: FromJson<JsonState> = {
    tau: "number",
    eta: json.array(fromJson.bytes32()),
    lambda: json.array(fromJson.validatorData),
    kappa: json.array(fromJson.validatorData),
    gamma_k: json.array(fromJson.validatorData),
    iota: json.array(fromJson.validatorData),
    gamma_a: json.array(fromJson.ticketBody),
    gamma_s: TicketsOrKeys.fromJson,
    gamma_z: json.fromString((v) => Bytes.parseBytes(v, 144)),
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
  gamma_a!: TicketBody[];
  // sealing-key series of current epoch
  gamma_s!: TicketsOrKeys;
  // bandersnatch ring comittment
  gamma_z!: Bytes<144>;
}

export class EpochMark {
  static fromJson: FromJson<EpochMark> = {
    entropy: fromJson.bytes32(),
    validators: json.array(fromJson.bytes32()),
  };

  entropy!: EntropyHash;
  validators!: BandersnatchKey[];
}

export class OkOutput {
  static fromJson: FromJson<OkOutput> = {
    epoch_mark: json.optional(EpochMark.fromJson),
    tickets_mark: json.optional<TicketBody[]>(json.array(fromJson.ticketBody)),
  };
  epoch_mark?: EpochMark;
  tickets_mark?: TicketBody[];
}

export class Output {
  static fromJson: FromJson<Output> = {
    ok: json.optional(OkOutput.fromJson),
    err: json.optional("string"),
  };

  ok?: OkOutput;
  err?: string;
}

export class SafroleTest {
  static fromJson: FromJson<SafroleTest> = {
    input: {
      slot: "number",
      entropy: fromJson.bytes32(),
      offenders: json.array(fromJson.bytes32()),
      extrinsic: json.array(fromJson.ticketEnvelope),
    },
    pre_state: JsonState.fromJson,
    output: Output.fromJson,
    post_state: JsonState.fromJson,
  };

  input!: {
    slot: number;
    entropy: EntropyHash;
    offenders: Ed25519Key[];
    extrinsic: TicketEnvelope[];
  };
  pre_state!: JsonState;
  output!: Output;
  post_state!: JsonState;
}

const logger = Logger.new(__filename, "test-runner/safrole");

export async function runSafroleTest(testContent: SafroleTest) {
  const preState = convertPreStateToModel(testContent.pre_state);
  const safrole = new Safrole(preState);

  const output: Output = {};
  let error = "";
  let stateDiff: SafroleStateDiff = {};
  try {
    stateDiff = await safrole.transition(testContent.input);
    output.ok = {
      epoch_mark: undefined,
      tickets_mark: undefined,
    };
  } catch (e) {
    error = `${e}`;
    logger.error(error);
    output.err = "exception";
  }

  const postState = structuredClone(testContent.pre_state);
  // TODO [ToDr] Didn't find a better way to do this :sad:
  const unsafePostState = postState as unknown as { [key: string]: unknown };
  const unsafeStateDiff = stateDiff as unknown as { [key: string]: unknown };
  for (const k of Object.keys(postState)) {
    const diffKey = snakeToCamel(k);
    if (diffKey in stateDiff) {
      unsafePostState[k] = unsafeStateDiff[diffKey];
    }
  }

  // assert.deepStrictEqual(error, "RuntimeError: unreachable");
  //assert.deepStrictEqual(output, testContent.output);
  //assert.deepStrictEqual(postState, testContent.post_state);
}

function convertPreStateToModel(preState: JsonState): SafroleState {
  return {
    timeslot: () => preState.tau,
    entropy: () => preState.eta,
    prevValidators: () => preState.lambda,
    currValidators: () => preState.kappa,
    nextValidators: () => preState.gamma_k,
    designedValidators: () => preState.iota,
    ticketsAccumulator: () => preState.gamma_a,
  };
}

import { Bytes, BytesBlob } from "@typeberry/bytes";
import { newLogger } from "@typeberry/logger";
import type { EntropyHash, State as SafroleState } from "@typeberry/safrole";
import {
  Safrole,
  type StateDiff as SafroleStateDiff,
  type TicketBody,
  type TicketEnvelope,
  type ValidatorData,
} from "@typeberry/safrole";
import type { BandersnatchKey, BlsKey, Ed25519Key } from "@typeberry/safrole/crypto";
import { type FromJson, optional } from "../json-parser";

type SnakeToCamel<S extends string> = S extends `${infer T}_${infer U}` ? `${T}${Capitalize<SnakeToCamel<U>>}` : S;

function snakeToCamel<T extends string>(s: T): SnakeToCamel<T> {
  return s.replace(/(_\w)/g, (matches) => matches[1].toUpperCase()) as SnakeToCamel<T>;
}

const entropyHashFromJson: FromJson<EntropyHash> = ["string", (v: string) => Bytes.parseBytes(v, 32) as EntropyHash];

const ed25519FromJson: FromJson<Ed25519Key> = ["string", (v: string) => Bytes.parseBytes(v, 32) as Ed25519Key];

const validatorDataFromJson: FromJson<ValidatorData> = {
  ed25519: ed25519FromJson,
  bandersnatch: ["string", (v: string) => Bytes.parseBytes(v, 32) as BandersnatchKey],
  bls: ["string", (v: string) => Bytes.parseBytes(v, 144) as BlsKey],
  metadata: ["string", BytesBlob.parseBlob],
};

const ticketBodyFromJson: FromJson<TicketBody> = {
  id: ["string", (v: string) => Bytes.parseBytes(v, 32)],
  attempt: "number",
};

export class TicketsOrKeys {
  static fromJson = optional<TicketsOrKeys>(
    {
      tickets: ["array", ticketBodyFromJson],
      keys: ["array", ["string", (v: string) => Bytes.parseBytes(v, 32) as BandersnatchKey]],
    },
    ["tickets", "keys"],
  );
  tickets?: TicketBody[];
  keys?: BandersnatchKey[];
}

const ticketEnvelopeFromJson: FromJson<TicketEnvelope> = {
  attempt: "number",
  signature: ["string", (v: string) => Bytes.parseBytes(v, 784)],
};

class JsonState {
  static fromJson: FromJson<JsonState> = {
    tau: "number",
    eta: ["array", entropyHashFromJson],
    lambda: ["array", validatorDataFromJson],
    kappa: ["array", validatorDataFromJson],
    gamma_k: ["array", validatorDataFromJson],
    iota: ["array", validatorDataFromJson],
    gamma_a: ["array", ticketBodyFromJson],
    gamma_s: TicketsOrKeys.fromJson,
    gamma_z: ["string", (v: string) => Bytes.parseBytes(v, 144)],
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
    entropy: entropyHashFromJson,
    validators: ["array", ["string", (v: string) => Bytes.parseBytes(v, 32) as BandersnatchKey]],
  };

  entropy!: EntropyHash;
  validators!: BandersnatchKey[];
}

export class OkOutput {
  static fromJson = optional<OkOutput>(
    {
      epoch_mark: EpochMark.fromJson,
      tickets_mark: ["array", ticketBodyFromJson],
    },
    ["epoch_mark", "tickets_mark"],
  );
  epoch_mark?: EpochMark | null;
  tickets_mark?: TicketBody[] | null;
}

export class Output {
  static fromJson = optional<Output>(
    {
      ok: OkOutput.fromJson,
      err: "string",
    },
    ["ok", "err"],
  );

  ok?: OkOutput = undefined;
  err?: string = undefined;
}

export class SafroleTest {
  static fromJson: FromJson<SafroleTest> = {
    input: {
      slot: "number",
      entropy: entropyHashFromJson,
      offenders: ["array", ed25519FromJson],
      extrinsic: ["array", ticketEnvelopeFromJson],
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

const logger = newLogger(__filename, "test-runner/safrole");

export async function runSafroleTest(testContent: SafroleTest) {
  const preState = convertPreStateToModel(testContent.pre_state);
  const safrole = new Safrole(preState);

  const output: Output = {};
  let error = "";
  let stateDiff: SafroleStateDiff = {};
  try {
    stateDiff = await safrole.transition(testContent.input);
    output.ok = {
      epoch_mark: null,
      tickets_mark: null,
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

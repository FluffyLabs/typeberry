import { Bytes, BytesBlob } from "@typeberry/bytes";
import { Logger } from "@typeberry/logger";
import type { EntropyHash, State as SafroleState } from "@typeberry/safrole";
import {
  Safrole,
  type StateDiff as SafroleStateDiff,
  type TicketBody,
  type TicketEnvelope,
  type ValidatorData,
} from "@typeberry/safrole";
import type { BandersnatchKey, BlsKey, Ed25519Key } from "@typeberry/safrole/crypto";
import { type FromJson, STRING, NUMBER, ARRAY, OPTIONAL, OBJECT } from "../json-parser";

type SnakeToCamel<S extends string> = S extends `${infer T}_${infer U}` ? `${T}${Capitalize<SnakeToCamel<U>>}` : S;

function snakeToCamel<T extends string>(s: T): SnakeToCamel<T> {
  return s.replace(/(_\w)/g, (matches) => matches[1].toUpperCase()) as SnakeToCamel<T>;
}

const entropyHashFromJson: FromJson<EntropyHash> = STRING((v: string) => Bytes.parseBytes(v, 32) as EntropyHash);

const ed25519FromJson: FromJson<Ed25519Key> = STRING((v: string) => Bytes.parseBytes(v, 32) as Ed25519Key);

const validatorDataFromJson: FromJson<ValidatorData> = OBJECT({
  ed25519: ed25519FromJson,
  bandersnatch: STRING((v: string) => Bytes.parseBytes(v, 32) as BandersnatchKey),
  bls: STRING((v: string) => Bytes.parseBytes(v, 144) as BlsKey),
  metadata: STRING(BytesBlob.parseBlob),
});

const ticketBodyFromJson: FromJson<TicketBody> = OBJECT({
  id: STRING((v: string) => Bytes.parseBytes(v, 32)),
  attempt: NUMBER(),
});

export class TicketsOrKeys {
  static fromJson: FromJson<TicketsOrKeys> = OBJECT({
    tickets: OPTIONAL<TicketBody[]>(ARRAY(ticketBodyFromJson)),
    keys: OPTIONAL<BandersnatchKey[]>(ARRAY(STRING((v: string) => Bytes.parseBytes(v, 32) as BandersnatchKey))),
  });
  tickets?: TicketBody[];
  keys?: BandersnatchKey[];
}

const ticketEnvelopeFromJson: FromJson<TicketEnvelope> = OBJECT({
  attempt: NUMBER(),
  signature: STRING((v: string) => Bytes.parseBytes(v, 784)),
});

class JsonState {
  static fromJson: FromJson<JsonState> = OBJECT({
    tau: NUMBER(),
    eta: ARRAY(entropyHashFromJson),
    lambda: ARRAY(validatorDataFromJson),
    kappa: ARRAY(validatorDataFromJson),
    gamma_k: ARRAY(validatorDataFromJson),
    iota: ARRAY(validatorDataFromJson),
    gamma_a: ARRAY(ticketBodyFromJson),
    gamma_s: TicketsOrKeys.fromJson,
    gamma_z: STRING((v: string) => Bytes.parseBytes(v, 144)),
  });
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
  static fromJson: FromJson<EpochMark> = OBJECT({
    entropy: entropyHashFromJson,
    validators: ARRAY(STRING((v: string) => Bytes.parseBytes(v, 32) as BandersnatchKey)),
  });

  entropy!: EntropyHash;
  validators!: BandersnatchKey[];
}

export class OkOutput {
  static fromJson: FromJson<OkOutput> = OBJECT({
    epoch_mark: OPTIONAL(EpochMark.fromJson),
    tickets_mark: OPTIONAL<TicketBody[]>(ARRAY(ticketBodyFromJson)),
  });
  epoch_mark?: EpochMark;
  tickets_mark?: TicketBody[];
}

export class Output {
  static fromJson: FromJson<Output> = OBJECT({
    ok: OPTIONAL(OkOutput.fromJson),
    err: OPTIONAL(STRING()),
  });

  ok?: OkOutput = undefined;
  err?: string = undefined;
}

export class SafroleTest {
  static fromJson: FromJson<SafroleTest> = OBJECT({
    input: OBJECT({
      slot: NUMBER(),
      entropy: entropyHashFromJson,
      offenders: ARRAY(ed25519FromJson),
      extrinsic: ARRAY(ticketEnvelopeFromJson),
    }),
    pre_state: JsonState.fromJson,
    output: Output.fromJson,
    post_state: JsonState.fromJson,
  });

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

const logger = Logger.new(global.__filename, "test-runner/safrole");

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

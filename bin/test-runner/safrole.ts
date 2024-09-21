import assert from "node:assert";
import { Bytes, BytesBlob } from "@typeberry/bytes";
import { Logger } from "@typeberry/logger";
import type { EntropyHash } from "@typeberry/safrole";
import {
  Safrole,
  type StateDiff as SafroleStateDiff,
  type TicketBody,
  type TicketEnvelope,
  type ValidatorData,
} from "@typeberry/safrole";
import type { BandersnatchKey, BlsKey, Ed25519Key } from "@typeberry/safrole/crypto";
import { type FromJson, optional } from "./json-parser";

type SnakeToCamel<S extends string> = S extends `${infer T}_${infer U}` ? `${T}${Capitalize<SnakeToCamel<U>>}` : S;

type ConvertKeysToCamelCase<T> = {
  [K in keyof T as SnakeToCamel<K & string>]: T[K];
};

type PlainObjectToClass<T> = {
  [K in keyof T]: () => T[K];
};

function snakeToCamel<T extends string>(s: T): SnakeToCamel<T> {
  return s.replace(/(_\w)/g, (matches) => matches[1].toUpperCase()) as SnakeToCamel<T>;
}

function convertKeysToCamelCaseFuncs<T extends object>(json: T): PlainObjectToClass<ConvertKeysToCamelCase<T>> {
  const clazz = {} as { [key: string]: unknown };
  for (const [k, v] of Object.entries(json)) {
    clazz[snakeToCamel(k)] = () => v;
  }
  return clazz as PlainObjectToClass<ConvertKeysToCamelCase<T>>;
}

const entropyHashFromJson: FromJson<EntropyHash> = ["string", (v: string) => Bytes.parseBytes(v, 32) as EntropyHash];

const validatorDataFromJson: FromJson<ValidatorData> = {
  ed25519: ["string", (v: string) => Bytes.parseBytes(v, 32) as Ed25519Key],
  bandersnatch: ["string", (v: string) => Bytes.parseBytes(v, 32) as BandersnatchKey],
  bls: ["string", (v: string) => Bytes.parseBytes(v, 144) as BlsKey],
  metadata: ["string", BytesBlob.parseBlob],
};

const ticketBodyFromJson: FromJson<TicketBody> = {
  id: ["string", (v: string) => Bytes.parseBytes(v, 32)],
  attempt: "number",
};

export class TicketsOrKeys {
  static fromJson = optional<TicketsOrKeys>({
    tickets: ["array", ticketBodyFromJson],
    keys: ["array", ["string", (v: string) => Bytes.parseBytes(v, 32) as BandersnatchKey]],
  });
  tickets?: TicketBody[];
  keys?: BandersnatchKey[];
}

const ticketEnvelopeFromJson: FromJson<TicketEnvelope> = {
  attempt: "number",
  signature: ["string", (v: string) => Bytes.parseBytes(v, 784)],
};

class JsonState {
  static fromJson: FromJson<JsonState> = {
    timeslot: "number",
    entropy: ["array", entropyHashFromJson],
    prev_validators: ["array", validatorDataFromJson],
    curr_validators: ["array", validatorDataFromJson],
    next_validators: ["array", validatorDataFromJson],
    designed_validators: ["array", validatorDataFromJson],
    tickets_accumulator: ["array", ticketBodyFromJson],
    tickets_or_keys: TicketsOrKeys.fromJson,
    tickets_verifier_key: ["string", (v: string) => Bytes.parseBytes(v, 384)],
  };
  timeslot!: number;
  entropy!: [EntropyHash, EntropyHash, EntropyHash, EntropyHash];
  prev_validators!: ValidatorData[];
  curr_validators!: ValidatorData[];
  next_validators!: ValidatorData[];
  designed_validators!: ValidatorData[];
  tickets_accumulator!: TicketBody[];
  tickets_or_keys!: TicketsOrKeys;
  tickets_verifier_key!: Bytes<384>;
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
  static fromJson = optional<OkOutput>({
    epoch_mark: EpochMark.fromJson,
    tickets_mark: ["array", ticketBodyFromJson],
  });
  epoch_mark?: EpochMark | null;
  tickets_mark?: TicketBody[] | null;
}

export class Output {
  static fromJson = optional<Output>({
    ok: OkOutput.fromJson,
    err: "number",
  });

  ok?: OkOutput = undefined;
  err?: number = 0;
}

export class SafroleTest {
  static fromJson: FromJson<SafroleTest> = {
    input: {
      slot: "number",
      entropy: entropyHashFromJson,
      extrinsics: ["array", ticketEnvelopeFromJson],
    },
    pre_state: JsonState.fromJson,
    output: Output.fromJson,
    post_state: JsonState.fromJson,
  };

  input!: {
    slot: number;
    entropy: EntropyHash;
    extrinsics: TicketEnvelope[];
  };
  pre_state!: JsonState;
  output!: Output;
  post_state!: JsonState;
}

const logger = Logger.new(__filename, "test-runner/safrole");

export async function runSafroleTest(testContent: SafroleTest) {
  const preState = convertKeysToCamelCaseFuncs(testContent.pre_state);
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
    output.err = 1;
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

  assert.deepStrictEqual(error, "");
  assert.deepStrictEqual(output, testContent.output);
  assert.deepStrictEqual(postState, testContent.post_state);
}

import {
  BANDERSNATCH_KEY_BYTES,
  BANDERSNATCH_PROOF_BYTES,
  BANDERSNATCH_RING_ROOT_BYTES,
  type BandersnatchKey,
  type BandersnatchRingRoot,
  type EntropyHash,
  EpochMarker,
  type TimeSlot,
  type ValidatorKeys,
  tryAsPerEpochBlock,
  tryAsPerValidator,
  tryAsTimeSlot,
} from "@typeberry/block";
import { fromJson } from "@typeberry/block-json";
import type { SignedTicket, Ticket, TicketsExtrinsic } from "@typeberry/block/tickets";
import { Bytes, BytesBlob } from "@typeberry/bytes";
import { FixedSizeArray, SortedSet, asKnownSize } from "@typeberry/collections";
import type { ChainSpec } from "@typeberry/config";
import { ED25519_KEY_BYTES, type Ed25519Key } from "@typeberry/crypto";
import { type FromJson, json } from "@typeberry/json-parser";
import { Safrole } from "@typeberry/safrole";
import { BandernsatchWasm } from "@typeberry/safrole/bandersnatch-wasm";
import { type Input, type OkResult, SafroleErrorCode, type SafroleState } from "@typeberry/safrole/safrole";
import { ENTROPY_ENTRIES, type ValidatorData, hashComparator } from "@typeberry/state";
import { type SafroleSealingKeys, SafroleSealingKeysData } from "@typeberry/state/safrole-data";
import { Result, deepEqual, resultToString } from "@typeberry/utils";
import { logger } from "../common";
import { getChainSpec, validatorDataFromJson } from "./common-types";
namespace safroleFromJson {
  export const bytesBlob = json.fromString(BytesBlob.parseBlob);

  export const ticketBody: FromJson<Ticket> = {
    id: fromJson.bytes32(),
    attempt: "number",
  };

  export const ticketEnvelope: FromJson<SignedTicket> = {
    attempt: "number",
    signature: json.fromString((v) => Bytes.parseBytes(v, BANDERSNATCH_PROOF_BYTES).asOpaque()),
  };

  export const validatorKeys: FromJson<ValidatorKeys> = {
    bandersnatch: json.fromString((v) => Bytes.parseBytes(v, BANDERSNATCH_KEY_BYTES).asOpaque()),
    ed25519: json.fromString((v) => Bytes.parseBytes(v, ED25519_KEY_BYTES).asOpaque()),
  };
}

export class TicketsOrKeys {
  static fromJson: FromJson<TicketsOrKeys> = {
    keys: json.optional<BandersnatchKey[]>(json.array(fromJson.bytes32())),
    tickets: json.optional<Ticket[]>(json.array(safroleFromJson.ticketBody)),
  };

  keys?: BandersnatchKey[];
  tickets?: Ticket[];

  static toSafroleSealingKeys(data: TicketsOrKeys, chainSpec: ChainSpec): SafroleSealingKeys {
    if (data.keys !== undefined) {
      return SafroleSealingKeysData.keys(tryAsPerEpochBlock(data.keys, chainSpec));
    }

    if (data.tickets !== undefined) {
      return SafroleSealingKeysData.tickets(tryAsPerEpochBlock(data.tickets, chainSpec));
    }

    throw new Error("Neither tickets nor keys are defined!");
  }
}

export enum TestErrorCode {
  IncorrectData = "incorrect_data",
  // Timeslot value must be strictly monotonic.
  BadSlot = "bad_slot",
  // Received a ticket while in epoch's tail.
  UnexpectedTicket = "unexpected_ticket",
  // Tickets must be sorted.
  BadTicketOrder = "bad_ticket_order",
  // Invalid ticket ring proof.
  BadTicketProof = "bad_ticket_proof",
  // Invalid ticket attempt value.
  BadTicketAttempt = "bad_ticket_attempt",
  // Found a ticket duplicate.
  DuplicateTicket = "duplicate_ticket",
}

class JsonState {
  static fromJson: FromJson<JsonState> = {
    tau: "number",
    eta: json.array(fromJson.bytes32()),
    lambda: json.array(validatorDataFromJson),
    kappa: json.array(validatorDataFromJson),
    gamma_k: json.array(validatorDataFromJson),
    iota: json.array(validatorDataFromJson),
    gamma_a: json.array(safroleFromJson.ticketBody),
    gamma_s: TicketsOrKeys.fromJson,
    gamma_z: json.fromString((v) => Bytes.parseBytes(v, BANDERSNATCH_RING_ROOT_BYTES).asOpaque()),
    post_offenders: json.array(fromJson.bytes32()),
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
  // bandersnatch ring commitment
  gamma_z!: BandersnatchRingRoot;
  // posterior offenders sequence
  post_offenders!: Ed25519Key[];

  static toSafroleState(state: JsonState, chainSpec: ChainSpec): SafroleState {
    return {
      timeslot: state.tau,
      entropy: FixedSizeArray.new(state.eta, ENTROPY_ENTRIES),
      previousValidatorData: tryAsPerValidator(state.lambda, chainSpec),
      currentValidatorData: tryAsPerValidator(state.kappa, chainSpec),
      nextValidatorData: tryAsPerValidator(state.gamma_k, chainSpec),
      designatedValidatorData: tryAsPerValidator(state.iota, chainSpec),
      ticketsAccumulator: asKnownSize(state.gamma_a),
      sealingKeySeries: TicketsOrKeys.toSafroleSealingKeys(state.gamma_s, chainSpec),
      epochRoot: state.gamma_z.asOpaque(),
      disputesRecords: {
        punishSet: SortedSet.fromSortedArray(hashComparator, state.post_offenders),
      },
    };
  }
}

export class EpochMark {
  static fromJson: FromJson<EpochMark> = {
    entropy: fromJson.bytes32(),
    tickets_entropy: fromJson.bytes32(),
    validators: json.array(safroleFromJson.validatorKeys),
  };

  entropy!: EntropyHash;
  tickets_entropy!: EntropyHash;
  validators!: ValidatorKeys[];
}

export class OkOutput {
  static fromJson: FromJson<OkOutput> = {
    epoch_mark: json.optional(EpochMark.fromJson),
    tickets_mark: json.optional<Ticket[]>(json.array(safroleFromJson.ticketBody)),
  };
  epoch_mark?: EpochMark | null;
  tickets_mark?: Ticket[] | null;
}

export class Output {
  static fromJson: FromJson<Output> = {
    ok: json.optional(OkOutput.fromJson),
    err: json.optional("string"),
  };

  ok?: OkOutput;
  err?: TestErrorCode;

  static toSafroleOutput(output: Output, spec: ChainSpec): Result<OkResult, SafroleErrorCode> {
    if (output.err !== undefined) {
      return Result.error(Output.toSafroleErrorCode(output.err));
    }

    const epochMark =
      output.ok?.epoch_mark === undefined || output.ok.epoch_mark === null
        ? null
        : EpochMarker.fromCodec({
            entropy: output.ok.epoch_mark.entropy,
            ticketsEntropy: output.ok.epoch_mark.tickets_entropy,
            validators: tryAsPerValidator(output.ok.epoch_mark.validators, spec),
          });
    const tickets = output.ok?.tickets_mark ?? null;
    const ticketsMark = tickets === null ? null : tryAsPerEpochBlock(tickets, spec);

    return Result.ok({
      epochMark,
      ticketsMark,
    });
  }

  static toSafroleErrorCode(error: TestErrorCode): SafroleErrorCode {
    switch (error) {
      case TestErrorCode.BadSlot:
        return SafroleErrorCode.BadSlot;
      case TestErrorCode.BadTicketAttempt:
        return SafroleErrorCode.BadTicketAttempt;
      case TestErrorCode.BadTicketOrder:
        return SafroleErrorCode.BadTicketOrder;
      case TestErrorCode.BadTicketProof:
        return SafroleErrorCode.BadTicketProof;
      case TestErrorCode.DuplicateTicket:
        return SafroleErrorCode.DuplicateTicket;
      case TestErrorCode.IncorrectData:
        return SafroleErrorCode.IncorrectData;
      case TestErrorCode.UnexpectedTicket:
        return SafroleErrorCode.UnexpectedTicket;
      default:
        throw new Error(`Invalid error code: ${error}`);
    }
  }
}

class TestInput {
  static fromJson = json.object<TestInput, Input>(
    {
      slot: "number",
      entropy: fromJson.bytes32(),
      extrinsic: json.array(safroleFromJson.ticketEnvelope),
    },
    ({ entropy, extrinsic, slot }) => ({
      entropy,
      extrinsic: asKnownSize(extrinsic),
      slot: tryAsTimeSlot(slot),
    }),
  );

  slot!: TimeSlot;
  entropy!: EntropyHash;
  extrinsic!: TicketsExtrinsic;
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

export const bwasm = BandernsatchWasm.new({ synchronous: false });

export async function runSafroleTest(testContent: SafroleTest, path: string) {
  const chainSpec = getChainSpec(path);
  const preState = JsonState.toSafroleState(testContent.pre_state, chainSpec);
  const safrole = new Safrole(chainSpec, preState, bwasm);

  const result = await safrole.transition(testContent.input);
  logger.log(`SafroleTest { ${resultToString(result)} }`);

  deepEqual(result, Output.toSafroleOutput(testContent.output, chainSpec));
  deepEqual(safrole.state, JsonState.toSafroleState(testContent.post_state, chainSpec));
}

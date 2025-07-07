import type { TimeSlot, ValidatorIndex } from "@typeberry/block";
import { type JsonObject, fromJson } from "@typeberry/block-json";
import type { Bytes } from "@typeberry/bytes";
import type { HASH_SIZE } from "@typeberry/hash";
import { json } from "@typeberry/json-parser";

/** Block authorship options. */
export class AuthorshipOptions {
  static fromJson = json.object<JsonObject<AuthorshipOptions>, AuthorshipOptions>(
    {
      omit_seal_verification: "boolean",
      bandersnatch_seed: json.optional(fromJson.bytes32()),
      bls_seed: json.optional(fromJson.bytes32()),
      ed25519_seed: json.optional(fromJson.bytes32()),
      genesis_path: json.optional("string"),
      time_slot: json.optional("number"),
      validator_index: json.optional("number"),
    },
    AuthorshipOptions.new,
  );

  static new({
    omit_seal_verification,
    bandersnatch_seed,
    bls_seed,
    ed25519_seed,
    genesis_path,
    time_slot,
    validator_index,
  }: JsonObject<AuthorshipOptions>) {
    return new AuthorshipOptions(
      omit_seal_verification,
      bandersnatch_seed,
      bls_seed,
      ed25519_seed,
      genesis_path,
      time_slot,
      validator_index,
    );
  }

  private constructor(
    /** Use fake seal verification instead of running bandersnatch. */
    public readonly omitSealVerification: boolean,
    /** Use predefined bandersnatch seed to derive bandersnatch key. */
    public bandersnatchSeed?: Bytes<HASH_SIZE>,
    /** Use predefined bls seed to derive bls key. */
    public blsSeed?: Bytes<HASH_SIZE>,
    /** Use predefined ed25519 seed to derive ed25519 key. */
    public ed25519Seed?: Bytes<HASH_SIZE>,
    /** Use to provide path for genesis state */
    public genesisPath?: string,
    /** Use to override genesis head config slot. */
    public timeSlot?: TimeSlot,
    /** Use to specify validator index that will be used as for current node. */
    public validatorIndex?: ValidatorIndex,
  ) {}
}

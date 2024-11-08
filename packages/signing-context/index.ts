import { BytesBlob } from "@typeberry/bytes";
import type { Opaque } from "@typeberry/utils";

/**
 * https://graypaper.fluffylabs.dev/#/364735a/3db4003df000
 */

export type JamValid = Opaque<Uint8Array, "JAM_VALID">;
export const JAM_VALID = BytesBlob.fromString("jam_valid").buffer as JamValid;

export type JamInvalid = Opaque<Uint8Array, "JAM_INVALID">;
export const JAM_INVALID = BytesBlob.fromString("jam_invalid").buffer as JamInvalid;

export type JamGuarantee = Opaque<Uint8Array, "JAM_GUARANTEE">;
export const JAM_GUARANTEE = BytesBlob.fromString("jam_guarantee").buffer as JamGuarantee;

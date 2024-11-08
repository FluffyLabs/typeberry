import { BytesBlob } from "@typeberry/bytes";

/**
 * https://graypaper.fluffylabs.dev/#/364735a/3db4003df000
 */

export const JAM_VALID = BytesBlob.fromString("jam_valid").buffer;
export const JAM_INVALID = BytesBlob.fromString("jam_invalid").buffer;

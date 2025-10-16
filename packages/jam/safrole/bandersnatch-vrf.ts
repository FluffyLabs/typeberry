import type { EntropyHash } from "@typeberry/block";
import type { SignedTicket } from "@typeberry/block/tickets.js";
import { Bytes, BytesBlob } from "@typeberry/bytes";
import type { BandersnatchKey } from "@typeberry/crypto";
import {
  BANDERSNATCH_RING_ROOT_BYTES,
  type BandersnatchRingRoot,
  type BandersnatchVrfSignature,
} from "@typeberry/crypto/bandersnatch.js";
import { HASH_SIZE } from "@typeberry/hash";
import { Result } from "@typeberry/utils";
import type { BandernsatchWasm } from "./bandersnatch-wasm.js";
import { JAM_TICKET_SEAL } from "./constants.js";

const RESULT_INDEX = 0 as const;

enum ResultValues {
  Ok = 0,
  Error = 1,
}

/**
 * Getting a ring commitment is pretty expensive (hundreds of ms),
 * yet the validators do not always change.
 * For current benchmarks, we get a huge hit every epoch, hence
 * to overcome that we cache the results of getting ring commitment.
 * Note we can also tentatively populate this cache, before we even
 * reach the epoch change block.
 */
const ringCommitmentCache: CacheEntry[] = [];
type CacheEntry = {
  keys: BytesBlob;
  value: Promise<Result<BandersnatchRingRoot, null>>;
};

// TODO [ToDr] We export the entire object to allow mocking in tests.
// Ideally we would just export functions and figure out how to mock
// properly in ESM.
export default {
  verifySeal,
  verifyTickets,
  getRingCommitment,
};

async function verifySeal(
  bandersnatch: BandernsatchWasm,
  authorKey: BandersnatchKey,
  signature: BandersnatchVrfSignature,
  payload: BytesBlob,
  encodedUnsealedHeader: BytesBlob,
): Promise<Result<EntropyHash, null>> {
  const sealResult = await bandersnatch.verifySeal(
    authorKey.raw,
    signature.raw,
    payload.raw,
    encodedUnsealedHeader.raw,
  );

  if (sealResult[RESULT_INDEX] === ResultValues.Error) {
    return Result.error(null, () => "Bandersnatch VRF seal verification failed");
  }

  return Result.ok(Bytes.fromBlob(sealResult.subarray(1), HASH_SIZE).asOpaque());
}

function getRingCommitment(
  bandersnatch: BandernsatchWasm,
  validators: BandersnatchKey[],
): Promise<Result<BandersnatchRingRoot, null>> {
  const keys = BytesBlob.blobFromParts(validators.map((x) => x.raw));
  // We currently compare the large bytes blob, but the number of entries in the cache
  // must be low. If the cache ever grows larger, we should rather consider hashing the keys.
  const MAX_CACHE_ENTRIES = 3;
  const cacheEntry = ringCommitmentCache.find((v) => v.keys.isEqualTo(keys));
  if (cacheEntry !== undefined) {
    return cacheEntry.value;
  }

  const value = getRingCommitmentNoCache(bandersnatch, keys);
  ringCommitmentCache.push({
    keys,
    value,
  });
  if (ringCommitmentCache.length > MAX_CACHE_ENTRIES) {
    ringCommitmentCache.shift();
  }
  return value;
}

async function getRingCommitmentNoCache(
  bandersnatch: BandernsatchWasm,
  keys: BytesBlob,
): Promise<Result<BandersnatchRingRoot, null>> {
  const commitmentResult = await bandersnatch.getRingCommitment(keys.raw);

  if (commitmentResult[RESULT_INDEX] === ResultValues.Error) {
    return Result.error(null, () => "Bandersnatch ring commitment calculation failed");
  }

  return Result.ok(Bytes.fromBlob(commitmentResult.subarray(1), BANDERSNATCH_RING_ROOT_BYTES).asOpaque());
}

// One byte for result discriminator (`ResultValues`) and the rest is entropy hash.
const TICKET_RESULT_LENGTH = 1 + HASH_SIZE;

async function verifyTickets(
  bandersnatch: BandernsatchWasm,
  numberOfValidators: number,
  epochRoot: BandersnatchRingRoot,
  tickets: readonly SignedTicket[],
  entropy: EntropyHash,
): Promise<{ isValid: boolean; entropyHash: EntropyHash }[]> {
  const contextLength = entropy.length + JAM_TICKET_SEAL.length + 1;

  const ticketsData = BytesBlob.blobFromParts(
    tickets.map(
      (ticket) =>
        BytesBlob.blobFromParts([ticket.signature.raw, JAM_TICKET_SEAL, entropy.raw, Uint8Array.of(ticket.attempt)])
          .raw,
    ),
  ).raw;

  const verificationResult = await bandersnatch.batchVerifyTicket(
    numberOfValidators,
    epochRoot.raw,
    ticketsData,
    contextLength,
  );
  return Array.from(BytesBlob.blobFrom(verificationResult).chunks(TICKET_RESULT_LENGTH)).map((result) => ({
    isValid: result.raw[RESULT_INDEX] === ResultValues.Ok,
    entropyHash: Bytes.fromBlob(result.raw.subarray(1, TICKET_RESULT_LENGTH), HASH_SIZE).asOpaque(),
  }));
}

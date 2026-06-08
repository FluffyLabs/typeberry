import type { EntropyHash } from "@typeberry/block";
import type { SignedTicket } from "@typeberry/block/tickets.js";
import type { BandersnatchKey, BandersnatchSecretSeed } from "@typeberry/crypto";
import { Logger } from "@typeberry/logger";
import bandersnatchVrf from "@typeberry/safrole/bandersnatch-vrf.js";
import type { BandernsatchWasm } from "@typeberry/safrole/bandersnatch-wasm.js";
import { Result } from "@typeberry/utils";

const logger = Logger.new(import.meta.filename, "tickets-generator");

export enum TicketGeneratorError {
  TicketGenerationFailed = "TicketGenerationFailed",
  ValidatorNotInRing = "ValidatorNotInRing",
}

export type ValidatorKey = {
  secret: BandersnatchSecretSeed;
  public: BandersnatchKey;
};

/**
 * Generates tickets for all validator keys.
 *
 * Each validator key produces `ticketsPerValidator` tickets using ring VRF proofs.
 * The ring keys define the anonymous set - only members can produce valid proofs.
 *
 * All resolved validators are generated in a single batched native call
 * ({@link bandersnatchVrf.generateTicketsForValidators}) which reuses the ring
 * prover setup across the batch.
 */
export async function generateTickets(
  bandersnatch: BandernsatchWasm,
  ringKeys: BandersnatchKey[],
  validatorKeys: ValidatorKey[],
  entropy: EntropyHash,
  ticketsPerValidator: number,
): Promise<Result<SignedTicket[], TicketGeneratorError>> {
  // Resolve each validator's index within the ring, skipping any that are not
  // members (only ring members can produce valid proofs).
  const proverKeyIndices: number[] = [];
  const secrets: BandersnatchSecretSeed[] = [];
  for (const validatorKey of validatorKeys) {
    const proverIndex = ringKeys.findIndex((k) => k.isEqualTo(validatorKey.public));
    if (proverIndex < 0) {
      logger.warn`Validator public key not found in the ring, skipping ticket generation for this key`;
      continue;
    }
    proverKeyIndices.push(proverIndex);
    secrets.push(validatorKey.secret);
  }

  if (proverKeyIndices.length === 0) {
    // No resolvable validators: an error if some were requested, else just empty.
    if (validatorKeys.length > 0) {
      return Result.error(
        TicketGeneratorError.TicketGenerationFailed,
        () => "Failed to generate tickets for all validators",
      );
    }
    return Result.ok([]);
  }

  const result = await bandersnatchVrf.generateTicketsForValidators(
    bandersnatch,
    ringKeys,
    proverKeyIndices,
    secrets,
    entropy,
    ticketsPerValidator,
  );

  if (result.isError) {
    return Result.error(
      TicketGeneratorError.TicketGenerationFailed,
      () => "Failed to generate tickets for all validators",
    );
  }

  return Result.ok(result.ok.flat());
}

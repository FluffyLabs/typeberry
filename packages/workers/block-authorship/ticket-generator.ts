import type { EntropyHash } from "@typeberry/block";
import { type SignedTicket, tryAsTicketAttempt } from "@typeberry/block/tickets.js";
import type { BandersnatchKey, BandersnatchSecretSeed } from "@typeberry/crypto";
import bandersnatchVrf from "@typeberry/safrole/bandersnatch-vrf.js";
import type { BandernsatchWasm } from "@typeberry/safrole/bandersnatch-wasm.js";
import { Result } from "@typeberry/utils";

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
 */
export async function generateTickets(
  bandersnatch: BandernsatchWasm,
  ringKeys: BandersnatchKey[],
  validatorKeys: ValidatorKey[],
  entropy: EntropyHash,
  ticketsPerValidator: number,
): Promise<Result<SignedTicket[], TicketGeneratorError>> {
  const allTickets: SignedTicket[] = [];

  for (const validatorKey of validatorKeys) {
    const proverIndex = ringKeys.findIndex((k) => k.isEqualTo(validatorKey.public));
    if (proverIndex < 0) {
      return Result.error(TicketGeneratorError.ValidatorNotInRing, () => "Validator public key not found in the ring");
    }

    const ticketResult = await bandersnatchVrf.generateTickets(
      bandersnatch,
      ringKeys,
      proverIndex,
      validatorKey.secret,
      entropy,
      tryAsTicketAttempt(ticketsPerValidator),
    );

    if (ticketResult.isOk) {
      allTickets.push(...ticketResult.ok);
    } else {
      return Result.error(
        TicketGeneratorError.TicketGenerationFailed,
        () => "Failed to generate tickets for validator",
      );
    }
  }

  return Result.ok(allTickets);
}

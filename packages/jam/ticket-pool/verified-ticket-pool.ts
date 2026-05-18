import type { EntropyHash, Epoch } from "@typeberry/block";
import type { SignedTicket } from "@typeberry/block/tickets.js";
import { HashSet } from "@typeberry/collections/hash-set.js";

/** A ticket the validator already verified, paired with the entropy hash (ticket id). */
export type VerifiedTicket = {
  ticket: SignedTicket;
  id: EntropyHash;
};

/**
 * In-memory pool of verified tickets for the current epoch, keyed by ticket id.
 *
 * Used on the authorship side. Tickets are stored per epoch and deduplicated by their
 * computed entropy hash (so duplicates arriving via different peers / paths are coalesced
 * cheaply). The pool only ever needs to hold tickets for one epoch at a time; switching
 * to a new epoch clears everything older.
 */
export class VerifiedTicketPool {
  private readonly perEpoch = new Map<Epoch, VerifiedTicket[]>();
  private readonly idSets = new Map<Epoch, HashSet<EntropyHash>>();

  /** Add pre-verified tickets to the pool, deduping by id. */
  add(epochIndex: Epoch, verifiedTickets: readonly VerifiedTicket[]): void {
    if (this.perEpoch.size > 0 && !this.perEpoch.has(epochIndex)) {
      this.perEpoch.clear();
      this.idSets.clear();
    }
    const existing = this.perEpoch.get(epochIndex) ?? [];
    let idSet = this.idSets.get(epochIndex) ?? null;
    if (idSet === null) {
      idSet = HashSet.new();
      this.idSets.set(epochIndex, idSet);
    }
    for (const entry of verifiedTickets) {
      if (!idSet.has(entry.id)) {
        existing.push(entry);
        idSet.insert(entry.id);
      }
    }
    this.perEpoch.set(epochIndex, existing);
  }

  /** Returns the verified tickets for the given epoch, or an empty array if none. */
  getForEpoch(epochIndex: Epoch): readonly VerifiedTicket[] {
    return this.perEpoch.get(epochIndex) ?? [];
  }
}

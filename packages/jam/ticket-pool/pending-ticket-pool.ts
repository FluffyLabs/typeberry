import type { Epoch } from "@typeberry/block";
import type { SignedTicket } from "@typeberry/block/tickets.js";
import { Logger } from "@typeberry/logger";

const logger = Logger.new(import.meta.filename, "pending-pool");

/**
 * An ordered, signature-deduplicated pool of tickets waiting to be redistributed to peers.
 *
 * Used on the networking side. Indices are stable within an epoch so callers can track
 * per-peer "sent" sets by index. The pool is cleared whenever a new epoch is observed,
 * and tickets for older epochs are dropped (can happen when an async validation completes
 * after the epoch already advanced).
 */
export class PendingTicketPool {
  private tickets: Array<{ epochIndex: Epoch; ticket: SignedTicket }> = [];
  private currentEpochValue: Epoch | null = null;

  /** Epoch the pool is currently holding tickets for, or `null` if empty. */
  get currentEpoch(): Epoch | null {
    return this.currentEpochValue;
  }

  /** Returns the ordered tickets currently in the pool. Caller must not mutate the array. */
  getTickets(): readonly { epochIndex: Epoch; ticket: SignedTicket }[] {
    return this.tickets;
  }

  /** Returns true if the ticket was added, false if it was a duplicate or dropped (old epoch). */
  addTicket(epochIndex: Epoch, ticket: SignedTicket): boolean {
    if (this.currentEpochValue !== null && epochIndex < this.currentEpochValue) {
      return false;
    }

    if (this.currentEpochValue !== null && epochIndex > this.currentEpochValue) {
      logger.log`Epoch changed from ${this.currentEpochValue} to ${epochIndex}, clearing ${this.tickets.length} old tickets`;
      this.tickets = [];
    }

    this.currentEpochValue = epochIndex;

    const isDuplicate = this.tickets.some(
      (pending) => pending.epochIndex === epochIndex && pending.ticket.signature.isEqualTo(ticket.signature),
    );

    if (isDuplicate) {
      return false;
    }

    this.tickets.push({ epochIndex, ticket });
    logger.info`[addTicket] Added ticket for epoch ${epochIndex}, total: ${this.tickets.length}`;
    return true;
  }

  /**
   * Replace the pool contents for the given epoch with the supplied tickets. Used when the
   * authorship worker pushes an authoritative pool dump on an epoch boundary; any tickets
   * that aren't in the dump are dropped, and dedup runs over the new set.
   */
  replace(epochIndex: Epoch, tickets: readonly SignedTicket[]): void {
    this.tickets = [];
    this.currentEpochValue = epochIndex;
    for (const ticket of tickets) {
      const isDuplicate = this.tickets.some((pending) => pending.ticket.signature.isEqualTo(ticket.signature));
      if (!isDuplicate) {
        this.tickets.push({ epochIndex, ticket });
      }
    }
    logger.log`Pool replaced for epoch ${epochIndex} with ${this.tickets.length} tickets`;
  }
}

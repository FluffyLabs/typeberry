import { bandersnatchWasm, initWasm } from "@typeberry/crypto";

export class BandernsatchWasm {
  private constructor() {}

  static async new() {
    await initWasm();
    return new BandernsatchWasm();
  }

  async verifySeal(authorKey: Uint8Array, signature: Uint8Array, payload: Uint8Array, auxData: Uint8Array) {
    return Promise.resolve(bandersnatchWasm.verify_seal(authorKey, signature, payload, auxData));
  }

  async getRingCommitment(keys: Uint8Array) {
    return Promise.resolve(bandersnatchWasm.ring_commitment(keys));
  }

  async batchVerifyTicket(ringSize: number, commitment: Uint8Array, ticketsData: Uint8Array, contextLength: number) {
    return Promise.resolve(bandersnatchWasm.batch_verify_tickets(ringSize, commitment, ticketsData, contextLength));
  }
}

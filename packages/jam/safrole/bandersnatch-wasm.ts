import { bandersnatchWasm, initWasm } from "@typeberry/crypto";

export class BandernsatchWasm {
  private constructor() {}

  static async new() {
    await initWasm();
    return new BandernsatchWasm();
  }

  async verifySeal(authorKey: Uint8Array, signature: Uint8Array, payload: Uint8Array, auxData: Uint8Array) {
    return bandersnatchWasm.verifySeal(authorKey, signature, payload, auxData);
  }

  async verifyHeaderSeals(
    authorKey: Uint8Array,
    headerSeal: Uint8Array,
    headerSealPayload: Uint8Array,
    unsealedHeader: Uint8Array,
    entropySeal: Uint8Array,
    entropyPayloadPrefix: Uint8Array,
  ) {
    return bandersnatchWasm.verifyHeaderSeals(
      authorKey,
      headerSeal,
      headerSealPayload,
      unsealedHeader,
      entropySeal,
      entropyPayloadPrefix,
    );
  }

  async getRingCommitment(keys: Uint8Array) {
    return bandersnatchWasm.ringCommitment(keys);
  }

  async batchVerifyTicket(ringSize: number, commitment: Uint8Array, ticketsData: Uint8Array, contextLength: number) {
    return bandersnatchWasm.batchVerifyTickets(ringSize, commitment, ticketsData, contextLength);
  }

  async generateSeal(authorKey: Uint8Array, input: Uint8Array, auxData: Uint8Array) {
    return bandersnatchWasm.generateSeal(authorKey, input, auxData);
  }

  async getVrfOutputHash(authorKey: Uint8Array, input: Uint8Array) {
    return bandersnatchWasm.vrfOutputHash(authorKey, input);
  }
}

import { Bytes } from "@typeberry/bytes";
import { type FromJson, json } from "@typeberry/json-parser";
import { Logger } from "@typeberry/logger";
import type { U16, U32 } from "@typeberry/numbers";
import type { TicketAttempt } from "@typeberry/safrole";
import type { Opaque } from "@typeberry/utils";

export const bytes32 = <T extends Bytes<32>>() => json.fromString((v) => Bytes.parseBytes(v, 32) as T);

export type HeaderHash = Opaque<Bytes<32>, "HeaderHash">;
export type BeefyHash = Opaque<Bytes<32>, "BeefyHash">;

export type ServiceId = Opaque<U32, "ServiceId[u32]">;
// TODO [ToDr] We might need some other wrapper than `Opaque` for numbers to avoid conflicts?
export type ValidatorIndex = Opaque<U16, "ValidatorIndex[u16]">;
export type Slot = Opaque<U32, "Slot[u32]">;
// TODO [ToDr] we don't have enough precision here so 🤞
export type Gas = Opaque<number, "Gas[u64]">;
export type CoreIndex = Opaque<U16, "CoreIndex[u16]">;

export type Ed25519Signature = Opaque<Bytes<64>, "Ed25519Signature">;

export namespace fromJson {
  export const ed25519Signature = json.fromString((v) => Bytes.parseBytes(v, 64) as Ed25519Signature);

  export const ticketAttempt = json.fromNumber((v) => {
    if (v !== 0 && v !== 1) {
      throw new Error("Invalid TicketAttempt value.");
    }
    return v as TicketAttempt;
  }) as FromJson<TicketAttempt>;
}

export const logger = Logger.new(global.__filename, "test-runner/codec");

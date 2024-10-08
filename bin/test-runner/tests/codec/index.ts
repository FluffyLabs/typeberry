import type { Ed25519Signature } from "@typeberry/block";
import type { TicketAttempt } from "@typeberry/block/tickets";
import { Bytes } from "@typeberry/bytes";
import { type FromJson, json } from "@typeberry/json-parser";
import { Logger } from "@typeberry/logger";
import type { U16, U32 } from "@typeberry/numbers";
import type { Opaque } from "@typeberry/utils";

export const bytes32 = <T extends Bytes<32>>() => json.fromString((v) => Bytes.parseBytes(v, 32) as T);

export type BeefyHash = Opaque<Bytes<32>, "BeefyHash">;

export type ServiceId = Opaque<U32, "ServiceId[u32]">;
// TODO [ToDr] we don't have enough precision here so 🤞
export type Gas = Opaque<number, "Gas[u64]">;
export type CoreIndex = Opaque<U16, "CoreIndex[u16]">;

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

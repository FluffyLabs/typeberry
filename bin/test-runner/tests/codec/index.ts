import type { Ed25519Signature } from "@typeberry/block";
import type { TicketAttempt } from "@typeberry/block/tickets";
import { Bytes } from "@typeberry/bytes";
import { type FromJson, json } from "@typeberry/json-parser";
import { Logger } from "@typeberry/logger";

export const bytes32 = <T extends Bytes<32>>() => json.fromString((v) => Bytes.parseBytes(v, 32) as T);

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

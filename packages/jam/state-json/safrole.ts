import { tryAsPerEpochBlock } from "@typeberry/block";
import { Ticket } from "@typeberry/block/tickets.js";
import { fromJson } from "@typeberry/block-json";
import type { ChainSpec } from "@typeberry/config";
import type { BandersnatchKey } from "@typeberry/crypto";
import { type FromJson, json } from "@typeberry/json-parser";
import { type SafroleSealingKeys, SafroleSealingKeysData } from "@typeberry/state";

export const ticketFromJson = (spec: ChainSpec): FromJson<Ticket> =>
  json.object<Ticket>(
    {
      id: fromJson.bytes32(),
      attempt: fromJson.ticketAttempt(spec),
    },
    Ticket.create,
  );

export class TicketsOrKeys {
  static fromJson(spec: ChainSpec): FromJson<TicketsOrKeys> {
    return {
      keys: json.optional<BandersnatchKey[]>(json.array(fromJson.bytes32())),
      tickets: json.optional<Ticket[]>(json.array(ticketFromJson(spec))),
    };
  }

  keys?: BandersnatchKey[];
  tickets?: Ticket[];

  static toSafroleSealingKeys(data: TicketsOrKeys, chainSpec: ChainSpec): SafroleSealingKeys {
    if (data.keys !== undefined) {
      return SafroleSealingKeysData.keys(tryAsPerEpochBlock(data.keys, chainSpec));
    }

    if (data.tickets !== undefined) {
      return SafroleSealingKeysData.tickets(tryAsPerEpochBlock(data.tickets, chainSpec));
    }

    throw new Error("Neither tickets nor keys are defined!");
  }
}

import { type BandersnatchKey, tryAsPerEpochBlock } from "@typeberry/block";
import { fromJson } from "@typeberry/block-json";
import { Ticket } from "@typeberry/block/tickets";
import type { ChainSpec } from "@typeberry/config";
import { type FromJson, json } from "@typeberry/json-parser";
import { type SafroleSealingKeys, SafroleSealingKeysData } from "@typeberry/state";

export const ticketFromJson: FromJson<Ticket> = json.object<Ticket>(
  {
    id: fromJson.bytes32(),
    attempt: fromJson.ticketAttempt,
  },
  Ticket.fromCodec,
);

export class TicketsOrKeys {
  static fromJson: FromJson<TicketsOrKeys> = {
    keys: json.optional<BandersnatchKey[]>(json.array(fromJson.bytes32())),
    tickets: json.optional<Ticket[]>(json.array(ticketFromJson)),
  };

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

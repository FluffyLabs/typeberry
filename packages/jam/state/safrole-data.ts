import {
  BANDERSNATCH_KEY_BYTES,
  BANDERSNATCH_RING_ROOT_BYTES,
  type BandersnatchKey,
  type BandersnatchRingRoot,
  type PerEpochBlock,
  type PerValidator,
  codecPerValidator,
  tryAsPerEpochBlock,
} from "@typeberry/block";
import { withContext } from "@typeberry/block/context";
import { Ticket } from "@typeberry/block/tickets";
import { type CodecRecord, type Descriptor, codec } from "@typeberry/codec";
import type { KnownSizeArray } from "@typeberry/collections";
import { EST_EPOCH_LENGTH } from "@typeberry/config";
import { tryAsU32 } from "@typeberry/numbers";
import { ValidatorData } from "./validator-data";

export enum SafroleSealingKeysKind {
  Keys = 0,
  Tickets = 1,
}

export type SafroleSealingKeys =
  | {
      kind: SafroleSealingKeysKind.Keys;
      keys: PerEpochBlock<BandersnatchKey>;
    }
  | {
      kind: SafroleSealingKeysKind.Tickets;
      tickets: PerEpochBlock<Ticket>;
    };

const codecBandersnatchKey: Descriptor<BandersnatchKey> = codec.bytes(BANDERSNATCH_KEY_BYTES).asOpaque();

class SafroleSealingKeysData {
  static Codec = codec.select<SafroleSealingKeys>(
    {
      name: "SafroleSealingKeys",
      sizeHint: { bytes: EST_EPOCH_LENGTH * BANDERSNATCH_KEY_BYTES, isExact: false },
    },
    withContext("SafroleSealingKeys", (context) => {
      return codec.custom<SafroleSealingKeys>(
        {
          name: "SafroleSealingKeys",
          sizeHint: { bytes: 1, isExact: false },
        },
        (e, x) => {
          e.varU32(tryAsU32(x.kind));
          if (x.kind === SafroleSealingKeysKind.Keys) {
            e.sequenceFixLen(codecBandersnatchKey, x.keys);
          } else {
            e.sequenceFixLen(Ticket.Codec, x.tickets);
          }
        },
        (d) => {
          const epochLength = context.epochLength;
          const kind = d.varU32();
          if (kind === SafroleSealingKeysKind.Keys) {
            const keys = d.sequenceFixLen<BandersnatchKey>(codecBandersnatchKey, epochLength);
            return new SafroleSealingKeysData(
              SafroleSealingKeysKind.Keys,
              tryAsPerEpochBlock(keys, context),
              undefined,
            ) as SafroleSealingKeys;
          }

          if (kind === SafroleSealingKeysKind.Tickets) {
            const tickets = d.sequenceFixLen(Ticket.Codec, epochLength);
            return new SafroleSealingKeysData(
              SafroleSealingKeysKind.Tickets,
              undefined,
              tryAsPerEpochBlock(tickets, context),
            ) as SafroleSealingKeys;
          }

          throw new Error(`Unexpected safrole sealing keys kind: ${kind}`);
        },
        (s) => {
          const kind = s.decoder.varU32();
          if (kind === SafroleSealingKeysKind.Keys) {
            s.sequenceFixLen(codecBandersnatchKey, context.epochLength);
            return;
          }
          if (kind === SafroleSealingKeysKind.Tickets) {
            s.sequenceFixLen(Ticket.Codec, context.epochLength);
            return;
          }

          throw new Error(`Unexpected safrole sealing keys kind: ${kind}`);
        },
      );
    }),
  );

  private constructor(
    readonly kind: SafroleSealingKeysKind,
    readonly keys?: PerEpochBlock<BandersnatchKey>,
    readonly tickets?: PerEpochBlock<Ticket>,
  ) {}
}

export class SafroleData {
  static Codec = codec.Class(SafroleData, {
    nextValidatorData: codecPerValidator(ValidatorData.Codec),
    epochRoot: codec.bytes(BANDERSNATCH_RING_ROOT_BYTES).asOpaque(),
    sealingKeySeries: SafroleSealingKeysData.Codec,
    ticketsAccumulator: codec.sequenceVarLen(Ticket.Codec).asOpaque(),
  });

  static fromCodec({ nextValidatorData, epochRoot, sealingKeySeries, ticketsAccumulator }: CodecRecord<SafroleData>) {
    return new SafroleData(nextValidatorData, epochRoot, sealingKeySeries, ticketsAccumulator);
  }

  constructor(
    /** gamma_k */
    public readonly nextValidatorData: PerValidator<ValidatorData>,
    /** gamma_z */
    public readonly epochRoot: BandersnatchRingRoot,
    /** gamma_s */
    public readonly sealingKeySeries: SafroleSealingKeys,
    /** gamma_a */
    public readonly ticketsAccumulator: KnownSizeArray<Ticket, "0...EpochLength">,
  ) {}
}

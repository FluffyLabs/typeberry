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
import { codecWithContext } from "@typeberry/block/codec";
import { Ticket } from "@typeberry/block/tickets";
import { type CodecRecord, codec } from "@typeberry/codec";
import { type KnownSizeArray, asKnownSize } from "@typeberry/collections";
import { HASH_SIZE } from "@typeberry/hash";
import { tryAsU32 } from "@typeberry/numbers";
import { WithDebug, seeThrough } from "@typeberry/utils";
import { ValidatorData } from "./validator-data";

export enum SafroleSealingKeysKind {
  Tickets = 0,
  Keys = 1,
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

const codecBandersnatchKey = codec.bytes(BANDERSNATCH_KEY_BYTES).asOpaque<BandersnatchKey>();

export class SafroleSealingKeysData extends WithDebug {
  static Codec = codecWithContext((context) => {
    return codec.custom<SafroleSealingKeys>(
      {
        name: "SafroleSealingKeys",
        sizeHint: { bytes: 1 + HASH_SIZE * context.epochLength, isExact: false },
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
          return SafroleSealingKeysData.keys(tryAsPerEpochBlock(keys, context));
        }

        if (kind === SafroleSealingKeysKind.Tickets) {
          const tickets = d.sequenceFixLen(Ticket.Codec, epochLength);
          return SafroleSealingKeysData.tickets(tryAsPerEpochBlock(tickets, context));
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
  });

  static keys(keys: PerEpochBlock<BandersnatchKey>): SafroleSealingKeys {
    return new SafroleSealingKeysData(SafroleSealingKeysKind.Keys, keys, undefined) as SafroleSealingKeys;
  }

  static tickets(tickets: PerEpochBlock<Ticket>): SafroleSealingKeys {
    return new SafroleSealingKeysData(SafroleSealingKeysKind.Tickets, undefined, tickets) as SafroleSealingKeys;
  }

  private constructor(
    readonly kind: SafroleSealingKeysKind,
    readonly keys?: PerEpochBlock<BandersnatchKey>,
    readonly tickets?: PerEpochBlock<Ticket>,
  ) {
    super();
  }
}

export class SafroleData {
  static Codec = codec.Class(SafroleData, {
    nextValidatorData: codecPerValidator(ValidatorData.Codec),
    epochRoot: codec.bytes(BANDERSNATCH_RING_ROOT_BYTES).asOpaque<BandersnatchRingRoot>(),
    sealingKeySeries: SafroleSealingKeysData.Codec,
    ticketsAccumulator: codec.sequenceVarLen(Ticket.Codec).convert(seeThrough, asKnownSize),
  });

  static create({ nextValidatorData, epochRoot, sealingKeySeries, ticketsAccumulator }: CodecRecord<SafroleData>) {
    return new SafroleData(nextValidatorData, epochRoot, sealingKeySeries, ticketsAccumulator);
  }

  private constructor(
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

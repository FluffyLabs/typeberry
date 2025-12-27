import { codecPerValidator, type PerEpochBlock, type PerValidator, tryAsPerEpochBlock } from "@typeberry/block";
import { codecWithContext } from "@typeberry/block/codec-utils.js";
import { Ticket } from "@typeberry/block/tickets.js";
import { type CodecRecord, codec, type DescribedBy } from "@typeberry/codec";
import { asKnownSize, type KnownSizeArray } from "@typeberry/collections";
import { BANDERSNATCH_KEY_BYTES, type BandersnatchKey } from "@typeberry/crypto";
import { BANDERSNATCH_RING_ROOT_BYTES, type BandersnatchRingRoot } from "@typeberry/crypto/bandersnatch.js";
import { seeThrough, WithDebug } from "@typeberry/utils";
import { ValidatorData } from "./validator-data.js";

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
    const keysCodec = codec
      .sequenceFixLen(codecBandersnatchKey, context.epochLength)
      .convert<PerEpochBlock<BandersnatchKey>>(
        (keys) => Array.from(keys) as BandersnatchKey[],
        (keys) => tryAsPerEpochBlock(keys, context),
      );
    const ticketsCodec = codec.sequenceFixLen(Ticket.Codec, context.epochLength).convert<PerEpochBlock<Ticket>>(
      (tickets) => Array.from(tickets) as Ticket[],
      (tickets) => tryAsPerEpochBlock(tickets, context),
    );

    return codec
      .union<SafroleSealingKeysKind, SafroleSealingKeys>("SafroleSealingKeys", {
        [SafroleSealingKeysKind.Keys]: codec.object({ keys: keysCodec }),
        [SafroleSealingKeysKind.Tickets]: codec.object({ tickets: ticketsCodec }),
      })
      .convert<SafroleSealingKeys>(
        (x) => x as SafroleSealingKeys,
        (x) => {
          if (x.kind === SafroleSealingKeysKind.Keys) {
            return SafroleSealingKeysData.keys(x.keys);
          }
          return SafroleSealingKeysData.tickets(x.tickets);
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
    ticketsAccumulator: codec.readonlyArray(codec.sequenceVarLen(Ticket.Codec)).convert(seeThrough, asKnownSize),
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

export type SafroleDataView = DescribedBy<typeof SafroleData.Codec.View>;

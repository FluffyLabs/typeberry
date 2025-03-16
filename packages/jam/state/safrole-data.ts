import {
  BANDERSNATCH_RING_ROOT_BYTES,
  type BandersnatchKey,
  type BandersnatchRingRoot,
  type PerValidator,
  codecPerValidator,
} from "@typeberry/block";
import { Ticket } from "@typeberry/block/tickets";
import { type CodecRecord, codec } from "@typeberry/codec";
import { ValidatorData } from "./validator-data";

// TODO [ToDr] This should be a union with tag for codec!
export class SafroleSealingKeys {
  keys?: BandersnatchKey[];
  tickets?: Ticket[];
}

export class SafroleData {
  static Codec = codec.Class(SafroleData, {
    nextValidatorData: codecPerValidator(ValidatorData.Codec),
    epochRoot: codec.bytes(BANDERSNATCH_RING_ROOT_BYTES).asOpaque(),
    sealingKeySeries: SafroleSealingKeys.Codec,
    ticketsAccumulator: codec.sequenceVarLen(Ticket.Codec),
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
    // TODO [ToDr] KnownSizeArray
    public readonly ticketsAccumulator: Ticket[],
  ) {}
}

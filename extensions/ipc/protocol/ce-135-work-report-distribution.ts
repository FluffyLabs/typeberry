import type { TimeSlot, ValidatorIndex } from "@typeberry/block";
import { ED25519_SIGNATURE_BYTES, type Ed25519Signature } from "@typeberry/block/crypto";
import { WorkReport } from "@typeberry/block/work-report";
import type { BytesBlob } from "@typeberry/bytes";
import { type CodecRecord, Decoder, Encoder, codec } from "@typeberry/codec";
import { Logger } from "@typeberry/logger";
import { WithDebug } from "@typeberry/utils";
import type { StreamHandler, StreamSender } from "../handler";
import type { StreamKind } from "./stream";

/**
 * JAMNP-S CE 135 Stream
 *
 * Distribution of a fully guaranteed work-report ready for inclusion in a block.
 *
 * https://github.com/zdave-parity/jam-np/blob/main/simple.md#ce-135-work-report-distribution
 */

export const STREAM_KIND = 135 as StreamKind;

export class ValidatorSignature extends WithDebug {
  static Codec = codec.Class(ValidatorSignature, {
    validatorIndex: codec.u16.asOpaque(),
    signature: codec.bytes(ED25519_SIGNATURE_BYTES).asOpaque(),
  });

  static fromCodec({ validatorIndex, signature }: CodecRecord<ValidatorSignature>) {
    return new ValidatorSignature(validatorIndex, signature);
  }

  constructor(
    public readonly validatorIndex: ValidatorIndex,
    public readonly signature: Ed25519Signature,
  ) {
    super();
  }
}

export class GuaranteedWorkReport extends WithDebug {
  static Codec = codec.Class(GuaranteedWorkReport, {
    report: WorkReport.Codec,
    slot: codec.u32.asOpaque(),
    signatures: codec.sequenceVarLen(ValidatorSignature.Codec),
  });

  static fromCodec({ report, slot, signatures }: CodecRecord<GuaranteedWorkReport>) {
    return new GuaranteedWorkReport(report, slot, signatures);
  }

  constructor(
    public readonly report: WorkReport,
    public readonly slot: TimeSlot,
    public readonly signatures: ValidatorSignature[],
  ) {
    super();
  }
}

const logger = Logger.new(__filename, "protocol/ce-135");

export class ServerHandler implements StreamHandler<typeof STREAM_KIND> {
  kind = STREAM_KIND;

  constructor(private readonly onWorkReport: (workReport: GuaranteedWorkReport) => void) {}

  onStreamMessage(sender: StreamSender, message: BytesBlob): void {
    const guaranteedWorkReport = Decoder.decodeObject(GuaranteedWorkReport.Codec, message);
    logger.info(`[${sender.streamId}] Received guaranteed work report.`);
    this.onWorkReport(guaranteedWorkReport);
    sender.close();
  }

  onClose() {}
}

export class ClientHandler implements StreamHandler<typeof STREAM_KIND> {
  kind = STREAM_KIND;

  onStreamMessage(sender: StreamSender): void {
    logger.warn(`[${sender.streamId}] Got unexpected message on CE-135 stream. Closing.`);
    sender.close();
  }

  onClose(): void {}

  sendWorkReport(sender: StreamSender, workReport: GuaranteedWorkReport) {
    logger.trace(`[${sender.streamId}] Sending guaranteed work report.`);
    sender.send(Encoder.encodeObject(GuaranteedWorkReport.Codec, workReport));
    sender.close();
  }
}

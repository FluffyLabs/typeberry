import type { TimeSlot } from "@typeberry/block";
import { codecKnownSizeArray, codecWithContext } from "@typeberry/block/codec-utils.js";
import { Credential } from "@typeberry/block/guarantees.js";
import { WorkReport } from "@typeberry/block/work-report.js";
import type { BytesBlob } from "@typeberry/bytes";
import { type CodecRecord, codec, Decoder, Encoder } from "@typeberry/codec";
import type { KnownSizeArray } from "@typeberry/collections";
import type { ChainSpec } from "@typeberry/config";
import { Logger } from "@typeberry/logger";
import { WithDebug } from "@typeberry/utils";
import { type StreamHandler, type StreamMessageSender, tryAsStreamKind } from "./stream.js";

/**
 * JAMNP-S CE 135 Stream
 *
 * Distribution of a fully guaranteed work-report ready for inclusion in a block.
 *
 * https://github.com/zdave-parity/jam-np/blob/main/simple.md#ce-135-work-report-distribution
 */

export const STREAM_KIND = tryAsStreamKind(135);

export class GuaranteedWorkReport extends WithDebug {
  static Codec = codec.Class(GuaranteedWorkReport, {
    report: WorkReport.Codec,
    slot: codec.u32.asOpaque<TimeSlot>(),
    signatures: codecWithContext((context) => {
      return codecKnownSizeArray(Credential.Codec, {
        minLength: 0,
        maxLength: context.validatorsCount,
        typicalLength: context.validatorsCount / 2,
      });
    }),
  });

  static create({ report, slot, signatures }: CodecRecord<GuaranteedWorkReport>) {
    return new GuaranteedWorkReport(report, slot, signatures);
  }

  private constructor(
    public readonly report: WorkReport,
    public readonly slot: TimeSlot,
    public readonly signatures: KnownSizeArray<Credential, "[0..ValidatorsCount)">,
  ) {
    super();
  }
}

const logger = Logger.new(import.meta.filename, "protocol/ce-135");

export class ServerHandler implements StreamHandler<typeof STREAM_KIND> {
  kind = STREAM_KIND;

  constructor(
    private readonly chainSpec: ChainSpec,
    private readonly onWorkReport: (workReport: GuaranteedWorkReport) => void,
  ) {}

  onStreamMessage(sender: StreamMessageSender, message: BytesBlob): void {
    const guaranteedWorkReport = Decoder.decodeObject(GuaranteedWorkReport.Codec, message, this.chainSpec);
    logger.log`[${sender.streamId}] Received guaranteed work report.`;
    this.onWorkReport(guaranteedWorkReport);
    sender.close();
  }

  onClose() {}
}

export class ClientHandler implements StreamHandler<typeof STREAM_KIND> {
  kind = STREAM_KIND;

  constructor(private readonly chainSpec: ChainSpec) {}

  onStreamMessage(sender: StreamMessageSender): void {
    logger.warn`[${sender.streamId}] Got unexpected message on CE-135 stream. Closing.`;
    sender.close();
  }

  onClose(): void {}

  sendWorkReport(sender: StreamMessageSender, workReport: GuaranteedWorkReport) {
    logger.trace`[${sender.streamId}] Sending guaranteed work report.`;
    sender.bufferAndSend(Encoder.encodeObject(GuaranteedWorkReport.Codec, workReport, this.chainSpec));
    sender.close();
  }
}

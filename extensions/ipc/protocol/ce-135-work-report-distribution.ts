import type { TimeSlot } from "@typeberry/block";
import { codecKnownSizeArray, codecWithContext } from "@typeberry/block/codec";
import { Credential } from "@typeberry/block/guarantees";
import { WorkReport } from "@typeberry/block/work-report";
import type { BytesBlob } from "@typeberry/bytes";
import { type CodecRecord, Decoder, Encoder, codec } from "@typeberry/codec";
import type { KnownSizeArray } from "@typeberry/collections";
import type { ChainSpec } from "@typeberry/config";
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

const logger = Logger.new(__filename, "protocol/ce-135");

export class ServerHandler implements StreamHandler<typeof STREAM_KIND> {
  kind = STREAM_KIND;

  constructor(
    private readonly chainSpec: ChainSpec,
    private readonly onWorkReport: (workReport: GuaranteedWorkReport) => void,
  ) {}

  onStreamMessage(sender: StreamSender, message: BytesBlob): void {
    const guaranteedWorkReport = Decoder.decodeObject(GuaranteedWorkReport.Codec, message, this.chainSpec);
    logger.log(`[${sender.streamId}] Received guaranteed work report.`);
    this.onWorkReport(guaranteedWorkReport);
    sender.close();
  }

  onClose() {}
}

export class ClientHandler implements StreamHandler<typeof STREAM_KIND> {
  kind = STREAM_KIND;

  constructor(private readonly chainSpec: ChainSpec) {}

  onStreamMessage(sender: StreamSender): void {
    logger.warn(`[${sender.streamId}] Got unexpected message on CE-135 stream. Closing.`);
    sender.close();
  }

  onClose(): void {}

  sendWorkReport(sender: StreamSender, workReport: GuaranteedWorkReport) {
    logger.trace(`[${sender.streamId}] Sending guaranteed work report.`);
    sender.send(Encoder.encodeObject(GuaranteedWorkReport.Codec, workReport, this.chainSpec));
    sender.close();
  }
}

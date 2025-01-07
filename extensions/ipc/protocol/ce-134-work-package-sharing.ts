import type { CoreIndex } from "@typeberry/block";
import { ED25519_SIGNATURE_BYTES, type Ed25519Signature } from "@typeberry/block/crypto";
import type { WorkPackageHash } from "@typeberry/block/work-report";
import type { Bytes, BytesBlob } from "@typeberry/bytes";
import { type CodecRecord, Decoder, Encoder, codec } from "@typeberry/codec";
import { HASH_SIZE } from "@typeberry/hash";
import { Logger } from "@typeberry/logger";
import { WithDebug } from "@typeberry/utils";
import type { StreamHandler, StreamSender } from "../handler";
import type { StreamId, StreamKind } from "./stream";

/**
 * JAMNP-S CE 134 Stream
 *
 * Work-package sharing between guarantors.
 *
 * https://github.com/zdave-parity/jam-np/blob/main/simple.md#ce-134-work-package-sharing
 */

// temporary type until we have a proper type for auditable work packages
type WorkPackageBundle = BytesBlob;

export const STREAM_KIND = 134 as StreamKind;
export const SEGMENTS_ROOT_SIZE = 32;

export class SegmentsRootMapping extends WithDebug {
  static Codec = codec.Class(SegmentsRootMapping, {
    workPackageHash: codec.bytes(HASH_SIZE).asOpaque(),
    segmentsRoot: codec.bytes(SEGMENTS_ROOT_SIZE),
  });

  static fromCodec({ workPackageHash, segmentsRoot }: CodecRecord<SegmentsRootMapping>) {
    return new SegmentsRootMapping(workPackageHash, segmentsRoot);
  }

  constructor(
    public readonly workPackageHash: WorkPackageHash,
    public readonly segmentsRoot: Bytes<typeof SEGMENTS_ROOT_SIZE>,
  ) {
    super();
  }
}

export class WorkPackageSharingRequest extends WithDebug {
  static Codec = codec.Class(WorkPackageSharingRequest, {
    coreIndex: codec.u16.asOpaque(),
    segmentsRootMappings: codec.sequenceVarLen(SegmentsRootMapping.Codec),
  });

  static fromCodec({ coreIndex, segmentsRootMappings }: CodecRecord<WorkPackageSharingRequest>) {
    return new WorkPackageSharingRequest(coreIndex, segmentsRootMappings);
  }

  constructor(
    public readonly coreIndex: CoreIndex,
    public readonly segmentsRootMappings: SegmentsRootMapping[],
  ) {
    super();
  }
}

export class WorkPackageSharingResponse extends WithDebug {
  static Codec = codec.Class(WorkPackageSharingResponse, {
    workReportHash: codec.bytes(HASH_SIZE).asOpaque(),
    signature: codec.bytes(ED25519_SIGNATURE_BYTES).asOpaque(),
  });

  static fromCodec({ workReportHash, signature }: CodecRecord<WorkPackageSharingResponse>) {
    return new WorkPackageSharingResponse(workReportHash, signature);
  }

  constructor(
    public readonly workReportHash: WorkPackageHash,
    public readonly signature: Ed25519Signature,
  ) {
    super();
  }
}

const logger = Logger.new(__filename, "protocol/ce-134");

export class ServerHandler implements StreamHandler<typeof STREAM_KIND> {
  kind = STREAM_KIND;

  constructor(private readonly onWorkPackage: (i: CoreIndex, s: SegmentsRootMapping[], w: WorkPackageBundle) => void) {}

  public readonly coreIndexWithSegmentsRootMappingsMap = new Map<StreamId, WorkPackageSharingRequest>();

  onStreamMessage(sender: StreamSender, message: BytesBlob): void {
    const streamId = sender.streamId;
    const coreIndexWithSegmentsRootMappings = this.coreIndexWithSegmentsRootMappingsMap.get(streamId);
    if (!coreIndexWithSegmentsRootMappings) {
      try {
        const receivedCoreIndexWithSegmentsRootMappings = Decoder.decodeObject(
          WorkPackageSharingRequest.Codec,
          message,
        );
        this.coreIndexWithSegmentsRootMappingsMap.set(streamId, receivedCoreIndexWithSegmentsRootMappings);
      } catch (error) {
        logger.warn(`[${streamId}] Couldn't decode core index and segments root mappings. Closing stream.\n${error}`);
        sender.close();
      }
      return;
    }
    try {
      const workPackageBundle = Decoder.decodeObject(codec.blob, message);
      this.onWorkPackage(
        coreIndexWithSegmentsRootMappings.coreIndex,
        coreIndexWithSegmentsRootMappings.segmentsRootMappings,
        workPackageBundle,
      );
    } catch (error) {
      logger.warn(`[${streamId}] Couldn't decode work package bundle. Closing stream.\n${error}`);
    }
    sender.close();
  }

  onClose(streamId: StreamId): void {
    this.coreIndexWithSegmentsRootMappingsMap.delete(streamId);
  }

  sendWorkReport(sender: StreamSender, workReportHash: WorkPackageHash, signature: Ed25519Signature) {
    const workReport = new WorkPackageSharingResponse(workReportHash, signature);
    sender.send(Encoder.encodeObject(WorkPackageSharingResponse.Codec, workReport));
  }
}

export class ClientHandler implements StreamHandler<typeof STREAM_KIND> {
  kind = STREAM_KIND;
  private onResponseMap = new Map<StreamId, (workReportHash: WorkPackageHash, signature: Ed25519Signature) => void>();

  onStreamMessage(sender: StreamSender, message: BytesBlob): void {
    const streamId = sender.streamId;
    const onResponse = this.onResponseMap.get(streamId);
    if (!onResponse) {
      logger.warn(`[${streamId}] Got unexpected message on CE-134 stream. Closing.`);
      sender.close();
      return;
    }
    try {
      const response = Decoder.decodeObject(WorkPackageSharingResponse.Codec, message);
      logger.info(`[${sender.streamId}] Received work report hash and signature.`);
      onResponse(response.workReportHash, response.signature);
    } catch (error) {
      logger.warn(`[${sender.streamId}] Got unexpected message on CE-134 stream. Closing.\n${error}`);
    } finally {
      this.onResponseMap.delete(streamId);
      sender.close();
    }
  }

  onClose(streamId: StreamId): void {
    this.onResponseMap.delete(streamId);
  }

  sendWorkPackage(
    sender: StreamSender,
    coreIndex: CoreIndex,
    segmentsRootMappings: SegmentsRootMapping[],
    workPackageBundle: WorkPackageBundle,
    onResponse: (workReportHash: WorkPackageHash, signature: Ed25519Signature) => void,
  ) {
    this.onResponseMap.set(sender.streamId, onResponse);
    const coreIndexWithSegmentsRootMappings = new WorkPackageSharingRequest(coreIndex, segmentsRootMappings);
    logger.trace(`[${sender.streamId}] Sending core index and segments-root mappings.`);
    sender.send(Encoder.encodeObject(WorkPackageSharingRequest.Codec, coreIndexWithSegmentsRootMappings));
    logger.trace(`[${sender.streamId}] Sending work package bundle.`);
    sender.send(Encoder.encodeObject(codec.blob, workPackageBundle));
    sender.close();
  }
}

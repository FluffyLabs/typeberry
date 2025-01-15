import type { CoreIndex, SegmentsRoot, WorkReportHash } from "@typeberry/block";
import { ED25519_SIGNATURE_BYTES, type Ed25519Signature } from "@typeberry/block/crypto";
import type { WorkPackageHash } from "@typeberry/block/work-report";
import type { BytesBlob } from "@typeberry/bytes";
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
const WorkPackageBundleCodec = codec.blob;

export const STREAM_KIND = 134 as StreamKind;

export class SegmentsRootMapping extends WithDebug {
  static Codec = codec.Class(SegmentsRootMapping, {
    workPackageHash: codec.bytes(HASH_SIZE).asOpaque(),
    segmentsRoot: codec.bytes(HASH_SIZE).asOpaque(),
  });

  static fromCodec({ workPackageHash, segmentsRoot }: CodecRecord<SegmentsRootMapping>) {
    return new SegmentsRootMapping(workPackageHash, segmentsRoot);
  }

  constructor(
    public readonly workPackageHash: WorkPackageHash,
    public readonly segmentsRoot: SegmentsRoot,
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
    public readonly workReportHash: WorkReportHash,
    public readonly signature: Ed25519Signature,
  ) {
    super();
  }
}

const logger = Logger.new(__filename, "protocol/ce-134");

export class ServerHandler implements StreamHandler<typeof STREAM_KIND> {
  kind = STREAM_KIND;

  constructor(
    private readonly onWorkPackage: (
      coreIndex: CoreIndex,
      segmentsRootMappings: SegmentsRootMapping[],
      workPackageBundle: WorkPackageBundle,
    ) => Promise<{ workReportHash: WorkReportHash; signature: Ed25519Signature }>,
  ) {}

  private readonly requestsMap = new Map<StreamId, WorkPackageSharingRequest>();

  private static sendWorkReport(sender: StreamSender, workReportHash: WorkReportHash, signature: Ed25519Signature) {
    const workReport = new WorkPackageSharingResponse(workReportHash, signature);
    sender.send(Encoder.encodeObject(WorkPackageSharingResponse.Codec, workReport));
    sender.close();
  }

  onStreamMessage(sender: StreamSender, message: BytesBlob): void {
    const streamId = sender.streamId;
    const request = this.requestsMap.get(streamId);

    if (!request) {
      const receivedRequest = Decoder.decodeObject(WorkPackageSharingRequest.Codec, message);
      this.requestsMap.set(streamId, receivedRequest);
      return;
    }

    const workPackageBundle = Decoder.decodeObject(WorkPackageBundleCodec, message);

    this.onWorkPackage(request.coreIndex, request.segmentsRootMappings, workPackageBundle)
      .then(({ workReportHash, signature }) => {
        ServerHandler.sendWorkReport(sender, workReportHash, signature);
      })
      .catch((error) => {
        logger.error(`[${streamId}] Error processing work package: ${error}`);
        this.onClose(streamId);
      });
  }

  onClose(streamId: StreamId): void {
    this.requestsMap.delete(streamId);
  }
}

export class ClientHandler implements StreamHandler<typeof STREAM_KIND> {
  kind = STREAM_KIND;
  private pendingRequests = new Map<
    StreamId,
    {
      resolve: (response: { workReportHash: WorkReportHash; signature: Ed25519Signature }) => void;
      reject: (error: Error) => void;
    }
  >();

  onStreamMessage(sender: StreamSender, message: BytesBlob): void {
    const pendingRequest = this.pendingRequests.get(sender.streamId);
    if (!pendingRequest) {
      throw new Error("Unexpected message received.");
    }

    const response = Decoder.decodeObject(WorkPackageSharingResponse.Codec, message);
    logger.info(`[${sender.streamId}] Received work report hash and signature.`);
    pendingRequest.resolve({ workReportHash: response.workReportHash, signature: response.signature });
    sender.close();
  }

  onClose(streamId: StreamId): void {
    const pendingRequest = this.pendingRequests.get(streamId);
    if (pendingRequest) {
      pendingRequest.reject(new Error("Stream closed."));
      this.pendingRequests.delete(streamId);
    }
  }

  async sendWorkPackage(
    sender: StreamSender,
    coreIndex: CoreIndex,
    segmentsRootMappings: SegmentsRootMapping[],
    workPackageBundle: WorkPackageBundle,
  ): Promise<{ workReportHash: WorkReportHash; signature: Ed25519Signature }> {
    const request = new WorkPackageSharingRequest(coreIndex, segmentsRootMappings);
    logger.trace(`[${sender.streamId}] Sending core index and segments-root mappings.`);
    sender.send(Encoder.encodeObject(WorkPackageSharingRequest.Codec, request));
    logger.trace(`[${sender.streamId}] Sending work package bundle.`);
    sender.send(Encoder.encodeObject(WorkPackageBundleCodec, workPackageBundle));

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(sender.streamId, { resolve, reject });
    });
  }
}

import type { CoreIndex, WorkReportHash } from "@typeberry/block";
import { WorkPackageInfo } from "@typeberry/block/refine-context.js";
import type { BytesBlob } from "@typeberry/bytes";
import { type CodecRecord, codec, Decoder, Encoder } from "@typeberry/codec";
import { ED25519_SIGNATURE_BYTES, type Ed25519Signature } from "@typeberry/crypto";
import { HASH_SIZE } from "@typeberry/hash";
import { Logger } from "@typeberry/logger";
import { WithDebug } from "@typeberry/utils";
import { type StreamHandler, type StreamId, type StreamMessageSender, tryAsStreamKind } from "./stream.js";

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

export const STREAM_KIND = tryAsStreamKind(134);

export class WorkPackageSharingRequest extends WithDebug {
  static Codec = codec.Class(WorkPackageSharingRequest, {
    coreIndex: codec.u16.asOpaque<CoreIndex>(),
    segmentsRootMappings: codec.sequenceVarLen(WorkPackageInfo.Codec),
  });

  static create({ coreIndex, segmentsRootMappings }: CodecRecord<WorkPackageSharingRequest>) {
    return new WorkPackageSharingRequest(coreIndex, segmentsRootMappings);
  }

  private constructor(
    public readonly coreIndex: CoreIndex,
    public readonly segmentsRootMappings: WorkPackageInfo[],
  ) {
    super();
  }
}

export class WorkPackageSharingResponse extends WithDebug {
  static Codec = codec.Class(WorkPackageSharingResponse, {
    workReportHash: codec.bytes(HASH_SIZE).asOpaque<WorkReportHash>(),
    signature: codec.bytes(ED25519_SIGNATURE_BYTES).asOpaque<Ed25519Signature>(),
  });

  static create({ workReportHash, signature }: CodecRecord<WorkPackageSharingResponse>) {
    return new WorkPackageSharingResponse(workReportHash, signature);
  }

  private constructor(
    public readonly workReportHash: WorkReportHash,
    public readonly signature: Ed25519Signature,
  ) {
    super();
  }
}

const logger = Logger.new(import.meta.filename, "protocol/ce-134");

export class ServerHandler implements StreamHandler<typeof STREAM_KIND> {
  kind = STREAM_KIND;

  constructor(
    private readonly onWorkPackage: (
      coreIndex: CoreIndex,
      segmentsRootMappings: WorkPackageInfo[],
      workPackageBundle: WorkPackageBundle,
    ) => Promise<{ workReportHash: WorkReportHash; signature: Ed25519Signature }>,
  ) {}

  private readonly requestsMap = new Map<StreamId, WorkPackageSharingRequest>();

  private static sendWorkReport(
    sender: StreamMessageSender,
    workReportHash: WorkReportHash,
    signature: Ed25519Signature,
  ) {
    const workReport = WorkPackageSharingResponse.create({ workReportHash, signature });
    sender.bufferAndSend(Encoder.encodeObject(WorkPackageSharingResponse.Codec, workReport));
    sender.close();
  }

  onStreamMessage(sender: StreamMessageSender, message: BytesBlob): void {
    const streamId = sender.streamId;
    const request = this.requestsMap.get(streamId);

    if (request === undefined) {
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
        logger.error`[${streamId}] Error processing work package: ${error}`;
        this.onClose(streamId);
      });
  }

  onClose(streamId: StreamId): void {
    this.requestsMap.delete(streamId);
  }
}

export class ClientHandler implements StreamHandler<typeof STREAM_KIND> {
  kind = STREAM_KIND;
  private readonly pendingRequests = new Map<
    StreamId,
    {
      resolve: (response: { workReportHash: WorkReportHash; signature: Ed25519Signature }) => void;
      reject: (error: Error) => void;
    }
  >();

  onStreamMessage(sender: StreamMessageSender, message: BytesBlob): void {
    const pendingRequest = this.pendingRequests.get(sender.streamId);
    if (pendingRequest === undefined) {
      throw new Error("Unexpected message received.");
    }

    const response = Decoder.decodeObject(WorkPackageSharingResponse.Codec, message);
    logger.info`[${sender.streamId}] Received work report hash and signature.`;
    pendingRequest.resolve({ workReportHash: response.workReportHash, signature: response.signature });
    sender.close();
  }

  onClose(streamId: StreamId): void {
    const pendingRequest = this.pendingRequests.get(streamId);
    if (pendingRequest !== undefined) {
      pendingRequest.reject(new Error("Stream closed."));
      this.pendingRequests.delete(streamId);
    }
  }

  async sendWorkPackage(
    sender: StreamMessageSender,
    coreIndex: CoreIndex,
    segmentsRootMappings: WorkPackageInfo[],
    workPackageBundle: WorkPackageBundle,
  ): Promise<{ workReportHash: WorkReportHash; signature: Ed25519Signature }> {
    const request = WorkPackageSharingRequest.create({ coreIndex, segmentsRootMappings });
    logger.trace`[${sender.streamId}] Sending core index and segments-root mappings.`;
    sender.bufferAndSend(Encoder.encodeObject(WorkPackageSharingRequest.Codec, request));
    logger.trace`[${sender.streamId}] Sending work package bundle.`;
    sender.bufferAndSend(Encoder.encodeObject(WorkPackageBundleCodec, workPackageBundle));

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(sender.streamId, { resolve, reject });
    });
  }
}

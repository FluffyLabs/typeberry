import type { CoreIndex } from "@typeberry/block";
import { type WorkItemExtrinsics, workItemExtrinsicsCodec } from "@typeberry/block/work-item";
import { WorkPackage } from "@typeberry/block/work-package";
import type { BytesBlob } from "@typeberry/bytes";
import { type CodecRecord, Decoder, Encoder, codec } from "@typeberry/codec";
import { Logger } from "@typeberry/logger";
import { WithDebug } from "@typeberry/utils";
import type { StreamHandler, StreamSender } from "../handler";
import type { StreamId, StreamKind } from "./stream";

/**
 * JAMNP-S CE 133 Stream
 *
 * Submission of a work-package from a builder to a guarantor.
 *
 * https://github.com/zdave-parity/jam-np/blob/main/simple.md#ce-133-work-package-submission
 */
export const STREAM_KIND = 133 as StreamKind;

export class CoreWorkPackage extends WithDebug {
  static Codec = codec.Class(CoreWorkPackage, {
    coreIndex: codec.u16.asOpaque<CoreIndex>(),
    workPackage: WorkPackage.Codec,
  });

  static fromCodec({ coreIndex, workPackage }: CodecRecord<CoreWorkPackage>) {
    return new CoreWorkPackage(coreIndex, workPackage);
  }

  constructor(
    public readonly coreIndex: CoreIndex,
    public readonly workPackage: WorkPackage,
  ) {
    super();
  }
}

const logger = Logger.new(__filename, "protocol/ce-133");

export class ServerHandler implements StreamHandler<typeof STREAM_KIND> {
  kind = STREAM_KIND;

  constructor(private readonly onWorkPackage: (i: CoreIndex, w: WorkPackage, e: WorkItemExtrinsics) => void) {}

  public readonly workPackages = new Map<StreamId, CoreWorkPackage>();

  onStreamMessage(sender: StreamSender, message: BytesBlob): void {
    const streamId = sender.streamId;
    // initially we expect the `CoreWorkPackage`
    const workPackage = this.workPackages.get(streamId);
    if (workPackage === undefined) {
      const coreWorkPackage = Decoder.decodeObject(CoreWorkPackage.Codec, message);
      this.workPackages.set(streamId, coreWorkPackage);
      return;
    }
    // next we expect extrinsics
    const codec = workItemExtrinsicsCodec(workPackage.workPackage.items);
    const extrinsics = Decoder.decodeObject(codec, message);
    this.onWorkPackage(workPackage.coreIndex, workPackage.workPackage, extrinsics);
    // finally we close the connection.
    sender.close();
  }

  onClose(streamId: StreamId): void {
    this.workPackages.delete(streamId);
  }
}

export class ClientHandler implements StreamHandler<typeof STREAM_KIND> {
  kind = STREAM_KIND;

  onStreamMessage(sender: StreamSender): void {
    logger.warn(`[${sender.streamId}] Got unexpected message on CE-133 stream. Closing.`);
    sender.close();
  }

  onClose(): void {}

  sendWorkPackage(sender: StreamSender, coreIndex: CoreIndex, workPackage: WorkPackage, extrinsic: WorkItemExtrinsics) {
    const corePack = new CoreWorkPackage(coreIndex, workPackage);
    logger.trace(`[${sender.streamId}] Sending work package: ${corePack}`);
    sender.send(Encoder.encodeObject(CoreWorkPackage.Codec, corePack));
    logger.trace(`[${sender.streamId}] Sending extrinsics: ${workPackage.items}`);
    sender.send(Encoder.encodeObject(workItemExtrinsicsCodec(workPackage.items), extrinsic));
    // now close the connection
    sender.close();
  }
}

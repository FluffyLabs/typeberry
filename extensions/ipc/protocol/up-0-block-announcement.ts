import { HASH_SIZE, Header, type HeaderHash, type TimeSlot, WithDebug } from "@typeberry/block";
import type { BytesBlob } from "@typeberry/bytes";
import { type CodecRecord, Decoder, Encoder, codec } from "@typeberry/codec";
import { Logger } from "@typeberry/logger";
import type { StreamHandler, StreamSender } from "../handler";
import type { StreamId, StreamKind } from "./stream";

/**
 * JAM-SNP UP0 stream.
 *
 * https://github.com/zdave-parity/jam-np/blob/main/simple.md#up-0-block-announcement
 */

export const STREAM_KIND = 0 as StreamKind;

export class HashAndSlot extends WithDebug {
  static Codec = codec.Class(HashAndSlot, {
    hash: codec.bytes(HASH_SIZE).cast(),
    slot: codec.u32.cast(),
  });

  static fromCodec({ hash, slot }: CodecRecord<HashAndSlot>) {
    return new HashAndSlot(hash, slot);
  }

  constructor(
    public readonly hash: HeaderHash,
    public readonly slot: TimeSlot,
  ) {
    super();
  }
}

export class Handshake {
  static Codec = codec.Class(Handshake, {
    final: HashAndSlot.Codec,
    leafs: codec.sequenceVarLen(HashAndSlot.Codec),
  });

  static fromCodec({ final, leafs }: CodecRecord<Handshake>) {
    return new Handshake(final, leafs);
  }

  constructor(
    public readonly final: HashAndSlot,
    public readonly leafs: HashAndSlot[],
  ) {}
}

export class Announcement extends WithDebug {
  static Codec = codec.Class(Announcement, {
    header: Header.Codec,
    final: HashAndSlot.Codec,
  });

  static fromCodec({ header, final }: CodecRecord<Announcement>) {
    return new Announcement(header, final);
  }

  constructor(
    public readonly header: Header,
    public readonly final: HashAndSlot,
  ) {
    super();
  }
}

const logger = Logger.new(__filename, "protocol/up-0");

export class Handler implements StreamHandler<typeof STREAM_KIND> {
  kind = STREAM_KIND;

  private readonly handshakes: Map<StreamId, Handshake> = new Map();
  private readonly pendingHandshakes: Map<StreamId, boolean> = new Map();

  constructor(
    private readonly getHandshake: () => Handshake,
    private readonly onAnnouncement: (ann: Announcement) => void,
  ) {}

  onStreamMessage(sender: StreamSender, message: BytesBlob): void {
    const streamId = sender.streamId;
    // we expect a handshake first
    if (!this.handshakes.has(streamId)) {
      const handshake = Decoder.decodeObject(Handshake.Codec, message);
      this.handshakes.set(streamId, handshake);
      // we didn't initiate this handshake, so let's respond
      if (!this.pendingHandshakes.delete(streamId)) {
        logger.log(`[${streamId}] <-- responding with a handshake.`);
        sender.send(Encoder.encodeObject(Handshake.Codec, this.getHandshake()));
      }
      return;
    }

    // it's just an announcement
    const annoucement = Decoder.decodeObject(Announcement.Codec, message);
    logger.info(`[${streamId}] got blocks announcement: ${annoucement}`);
    this.onAnnouncement(annoucement);
  }

  onClose(streamId: StreamId): void {
    this.handshakes.delete(streamId);
  }

  sendHandshake(sender: StreamSender, handshake: Handshake) {
    this.pendingHandshakes.set(sender.streamId, true);
    sender.send(Encoder.encodeObject(Handshake.Codec, handshake));
  }

  sendAnnouncement(sender: StreamSender, annoucement: Announcement) {
    // only send announcement if we've handshaken
    if (this.handshakes.has(sender.streamId)) {
      sender.send(Encoder.encodeObject(Announcement.Codec, annoucement));
    } else {
      logger.warn(`[${sender.streamId}] no handshake yet, skipping announcement.`);
    }
  }
}

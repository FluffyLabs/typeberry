import { Header, type HeaderHash, type TimeSlot } from "@typeberry/block";
import type { BytesBlob } from "@typeberry/bytes";
import { type CodecRecord, codec, Decoder, Encoder } from "@typeberry/codec";
import type { ChainSpec } from "@typeberry/config";
import { HASH_SIZE } from "@typeberry/hash";
import { Logger } from "@typeberry/logger";
import { WithDebug } from "@typeberry/utils";
import { type StreamHandler, type StreamId, type StreamMessageSender, tryAsStreamKind } from "./stream.js";

/**
 * JAMNP-S UP 0 stream.
 *
 * Block annoucements.
 *
 * https://github.com/zdave-parity/jam-np/blob/main/simple.md#up-0-block-announcement
 */
export const STREAM_KIND = tryAsStreamKind(0);

export class HashAndSlot extends WithDebug {
  static Codec = codec.Class(HashAndSlot, {
    hash: codec.bytes(HASH_SIZE).asOpaque<HeaderHash>(),
    slot: codec.u32.asOpaque<TimeSlot>(),
  });

  static create({ hash, slot }: CodecRecord<HashAndSlot>) {
    return new HashAndSlot(hash, slot);
  }

  private constructor(
    public readonly hash: HeaderHash,
    public readonly slot: TimeSlot,
  ) {
    super();
  }
}

/**
 * Both sides should begin by sending a handshake message containing all known leaves.
 */
export class Handshake {
  static Codec = codec.Class(Handshake, {
    final: HashAndSlot.Codec,
    leafs: codec.sequenceVarLen(HashAndSlot.Codec),
  });

  static create({ final, leafs }: CodecRecord<Handshake>) {
    return new Handshake(final, leafs);
  }

  private constructor(
    /** Last finalized block. */
    public readonly final: HashAndSlot,
    /** Descendants of the last finalized block with no known children. */
    public readonly leafs: HashAndSlot[],
  ) {}
}

/**
 * An announcement should be sent on the stream whenever a new,
 * valid, block is produced or received.
 */
export class Announcement extends WithDebug {
  static Codec = codec.Class(Announcement, {
    header: Header.Codec,
    final: HashAndSlot.Codec,
  });

  static create({ header, final }: CodecRecord<Announcement>) {
    return new Announcement(header, final);
  }

  private constructor(
    /** New (previously unknown) descendant of `final`. */
    public readonly header: Header,
    /** Final block and slot. */
    public readonly final: HashAndSlot,
  ) {
    super();
  }
}

const logger = Logger.new(import.meta.filename, "protocol/up-0");

export class Handler implements StreamHandler<typeof STREAM_KIND> {
  kind = STREAM_KIND;

  private readonly handshakes: Map<StreamId, Handshake> = new Map();
  private readonly pendingHandshakes: Map<StreamId, boolean> = new Map();

  constructor(
    private readonly spec: ChainSpec,
    private readonly getHandshake: () => Handshake,
    private readonly onAnnouncement: (sender: StreamId, ann: Announcement) => void,
    private readonly onHandshake: (sender: StreamId, handshake: Handshake) => void,
  ) {}

  onStreamMessage(sender: StreamMessageSender, message: BytesBlob): void {
    const { streamId } = sender;
    // we expect a handshake first
    if (!this.handshakes.has(streamId)) {
      const handshake = Decoder.decodeObject(Handshake.Codec, message);
      this.handshakes.set(streamId, handshake);
      // we didn't initiate this handshake, so let's respond
      if (!this.pendingHandshakes.delete(streamId)) {
        logger.log`[${streamId}] <-- responding with a handshake.`;
        sender.bufferAndSend(Encoder.encodeObject(Handshake.Codec, this.getHandshake()));
      }
      this.onHandshake(streamId, handshake);
      return;
    }

    // it's just an announcement
    const annoucement = Decoder.decodeObject(Announcement.Codec, message, this.spec);
    logger.log`[${streamId}] --> got blocks announcement: ${annoucement.final}`;
    this.onAnnouncement(streamId, annoucement);
  }

  onClose(streamId: StreamId): void {
    this.handshakes.delete(streamId);
    this.pendingHandshakes.delete(streamId);
  }

  sendHandshake(sender: StreamMessageSender) {
    const { streamId } = sender;
    if (this.handshakes.has(streamId) || this.pendingHandshakes.has(streamId)) {
      return;
    }
    const handshake = this.getHandshake();
    logger.trace`[${streamId}] <-- sending handshake`;
    this.pendingHandshakes.set(sender.streamId, true);
    sender.bufferAndSend(Encoder.encodeObject(Handshake.Codec, handshake));
  }

  sendAnnouncement(sender: StreamMessageSender, annoucement: Announcement) {
    const { streamId } = sender;
    // only send announcement if we've handshaken
    if (this.handshakes.has(streamId)) {
      logger.trace`[${streamId}] <-- sending block announcement: ${annoucement.final}`;
      sender.bufferAndSend(Encoder.encodeObject(Announcement.Codec, annoucement, this.spec));
    } else {
      logger.warn`[${streamId}] <-- no handshake yet, skipping announcement.`;
    }
  }
}

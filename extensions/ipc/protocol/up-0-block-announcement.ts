import {HASH_SIZE, Header, HeaderHash, TimeSlot, WithDebug} from "@typeberry/block";
import {CodecRecord, Decoder, Encoder, codec} from "@typeberry/codec";
import {StreamHandler, StreamSender} from "../handler";
import {U8, U16} from "@typeberry/numbers";
import {StreamId} from "./stream";
import {Logger} from "@typeberry/logger";
import {BytesBlob} from "@typeberry/bytes";

export class HashAndSlot extends WithDebug{
  static Codec = codec.Class(HashAndSlot, {
    hash: codec.bytes(HASH_SIZE).cast(),
    slot: codec.u32.cast(),
  });

  static fromCodec({ hash, slot}: CodecRecord<HashAndSlot>) {
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

  static fromCodec({ final, leafs}: CodecRecord<Handshake>) {
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

  static fromCodec({ header, final}: CodecRecord<Announcement>) {
    return new Announcement(header, final);
  }

  constructor(
    public readonly header: Header,
    public readonly final: HashAndSlot,
  ) {
    super()
  }
}

const logger = Logger.new(__filename, "protocol/up-0");
export class Handler implements StreamHandler {

  kind = 0 as U8;

  private readonly handshakes: Map<StreamId, Handshake> = new Map();

  onStreamMessage(streamId: StreamId, message: BytesBlob): void {
    // we expect a handshake first
    if (!this.handshakes.has(streamId)) {
      const handshake = Decoder.decodeObject(Handshake.Codec, message);
      this.handshakes.set(streamId, handshake);
      // TODO [ToDr] we should reply with handshake (but avoid loop!) or somehow send it separately?
      return;
    }

    // it's just an announcement
    const annoucement = Decoder.decodeObject(Announcement.Codec, message);
    logger.info(`Got blocks announcement: ${annoucement}`);
  }

  onClose(streamId: StreamId): void {
    this.handshakes.delete(streamId);
  }

  sendHandshake(sender: StreamSender, handshake: Handshake) {
    sender.send(Encoder.encodeObject(Handshake.Codec, handshake));
  }

  sendAnnouncement(sender: StreamSender, annoucement: Announcement) {
    // only send announcement if we've handshaken
    if (this.handshakes.has(sender.streamId)) {
      sender.send(Encoder.encodeObject(Announcement.Codec, annoucement));
    }
  }

}

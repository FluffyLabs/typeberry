import { BytesBlob } from "@typeberry/bytes";
import { Decoder, Encoder } from "@typeberry/codec";
import { Logger } from "@typeberry/logger";
import { NewStream, StreamEnvelope, StreamEnvelopeType, type StreamId, type StreamKind } from "./protocol/stream";

export type ResponseHandler = (err: Error | null, response?: BytesBlob) => void;

const logger = Logger.new(__filename, "ext-ipc");

export interface MessageSender {
  send(data: BytesBlob): void;
  close(): void;
}

export interface StreamHandler<TStreamKind extends StreamKind = StreamKind> {
  readonly kind: TStreamKind;

  onStreamMessage(streamSender: StreamSender, message: BytesBlob): void;

  onClose(streamId: StreamId): void;
}

export class StreamSender implements MessageSender {
  constructor(
    public readonly streamId: StreamId,
    private readonly sender: MessageSender,
  ) {}

  open(newStream: NewStream) {
    const msg = Encoder.encodeObject(NewStream.Codec, newStream);
    this.sender.send(
      Encoder.encodeObject(StreamEnvelope.Codec, new StreamEnvelope(this.streamId, StreamEnvelopeType.Open, msg)),
    );
  }

  send(msg: BytesBlob): void {
    this.sender.send(
      Encoder.encodeObject(StreamEnvelope.Codec, new StreamEnvelope(this.streamId, StreamEnvelopeType.Msg, msg)),
    );
  }

  close(): void {
    this.sender.send(
      Encoder.encodeObject(
        StreamEnvelope.Codec,
        new StreamEnvelope(this.streamId, StreamEnvelopeType.Close, BytesBlob.fromNumbers([])),
      ),
    );
  }
}

export class MessageHandler {
  // already initiated streams
  private readonly streams: Map<StreamId, StreamHandler> = new Map();
  // streams awaiting confirmation from the other side.
  private readonly pendingStreams: Map<StreamId, boolean> = new Map();
  // a collection of handlers for particular stream kind
  private readonly streamHandlers: Map<StreamKind, StreamHandler> = new Map();

  constructor(private readonly sender: MessageSender) {}

  public registerHandlers(...handlers: StreamHandler[]) {
    for (const handler of handlers) {
      this.streamHandlers.set(handler.kind, handler);
    }
  }

  public withStream(streamId: StreamId, work: (handler: StreamHandler, sender: StreamSender) => void) {
    const handler = this.streams.get(streamId);
    if (!handler) {
      return false;
    }

    work(handler, new StreamSender(streamId, this.sender));
    return true;
  }

  public withStreamOfKind<TStreamKind extends StreamKind, THandler extends StreamHandler<TStreamKind>>(
    streamKind: TStreamKind,
    work: (handler: THandler, sender: StreamSender) => void,
  ) {
    // find first stream id with given kind
    for (const [streamId, handler] of this.streams.entries()) {
      if (handler.kind === streamKind) {
        work(handler as THandler, new StreamSender(streamId, this.sender));
        return true;
      }
    }
    return false;
  }

  public withNewStream<TStreamKind extends StreamKind, THandler extends StreamHandler<TStreamKind>>(
    kind: TStreamKind,
    work: (handler: THandler, sender: StreamSender) => void,
  ) {
    const handler = this.streamHandlers.get(kind);
    if (!handler) {
      throw new Error(`Stream with unregistered handler of kind: ${kind} was requested to be opened.`);
    }

    // pick a stream id
    const getRandomStreamId = () => Math.floor(Math.random() * 2 ** 16) as StreamId;
    const streams = this.streams;
    const streamId = (function findStreamId() {
      const s = getRandomStreamId();
      if (!streams.has(s)) {
        return s;
      }
      return findStreamId();
    })();

    // register the stream
    this.streams.set(streamId, handler);
    this.pendingStreams.set(streamId, true);

    const sender = new StreamSender(streamId, this.sender);
    sender.open(new NewStream(kind));

    work(handler as THandler, sender);
  }

  public onSocketMessage(msg: Uint8Array) {
    // decode the message as `StreamEnvelope`
    const envelope = Decoder.decodeObject(StreamEnvelope.Codec, msg);
    const streamId = envelope.streamId;
    logger.log(`[${streamId}] incoming message: ${envelope.type} ${envelope.data}`);
    // check if this is a already known stream id
    const streamHandler = this.streams.get(streamId);
    const streamSender = new StreamSender(streamId, this.sender);
    // we don't know that stream yet, so it has to be a new one
    if (streamHandler === undefined) {
      // closing or message of unknown stream - ignore.
      if (envelope.type !== StreamEnvelopeType.Open) {
        logger.warn(`[${streamId}] (unknown) got invalid type ${envelope.type}.`);
        return;
      }
      const newStream = Decoder.decodeObject(NewStream.Codec, envelope.data);
      const handler = this.streamHandlers.get(newStream.streamByte);
      if (handler !== undefined) {
        logger.log(`[${streamId}] new stream for ${handler.kind}`);
        // insert the stream
        this.streams.set(streamId, handler);
        // Just send back the same stream byte.
        streamSender.open(newStream);
        return;
      }
      // reply with an error, because we don't know how to handle that stream kind.
      streamSender.close();
      return;
    }

    // close the stream
    if (envelope.type === StreamEnvelopeType.Close) {
      const handler = this.streams.get(streamId);
      handler?.onClose(streamId);
      this.streams.delete(streamId);
      return;
    }

    if (envelope.type !== StreamEnvelopeType.Msg) {
      // display a warning but only if the stream was not pending for confirmation.
      if (!this.pendingStreams.delete(streamId)) {
        logger.warn(`[${streamId}] got invalid type ${envelope.type}.`);
      }
      return;
    }

    // this is a known stream, so just dispatch the message.
    streamHandler.onStreamMessage(streamSender, envelope.data);
  }

  onClose() {
    // Socket closed - we should probably clear everything.
    for (const [streamId, handler] of this.streams.entries()) {
      handler.onClose(streamId);
    }
    this.streams.clear();
  }
}

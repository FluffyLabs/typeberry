import type { Socket } from "node:net";
import { BytesBlob } from "@typeberry/bytes";
import { Decoder, Encoder } from "@typeberry/codec";
import { Logger } from "@typeberry/logger";
import { NewStream, StreamEnvelope, StreamEnvelopeType, type StreamId, type StreamKind } from "./protocol/stream";

export type ResponseHandler = (err: Error | null, response?: BytesBlob) => void;

const logger = Logger.new(__filename, "ext-ipc");

/** Abstraction over sending messages. May be tied to a particular stream. */
export interface MessageSender {
  /** Send data blob to the other end. */
  send(data: BytesBlob): void;
  /** Close the connection on our side (FIN). */
  close(): void;
}

/** Protocol handler for many streams of the same, given kind. */
export interface StreamHandler<TStreamKind extends StreamKind = StreamKind> {
  /** Kind of the stream */
  readonly kind: TStreamKind;

  /** Handle message for that particular stream kind. */
  onStreamMessage(streamSender: StreamSender, message: BytesBlob): void;

  /** Handle closing of given `streamId`. */
  onClose(streamId: StreamId, isError: boolean): void;
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
        new StreamEnvelope(this.streamId, StreamEnvelopeType.Close, BytesBlob.blobFromNumbers([])),
      ),
    );
  }
}

type OnEnd = {
  finished: boolean;
  listen: Promise<void>;
  resolve: () => void;
  reject: (error: Error) => void;
};

export class MessageHandler {
  // already initiated streams
  private readonly streams: Map<StreamId, StreamHandler> = new Map();
  // streams awaiting confirmation from the other side.
  private readonly pendingStreams: Map<StreamId, boolean> = new Map();
  // a collection of handlers for particular stream kind
  private readonly streamHandlers: Map<StreamKind, StreamHandler> = new Map();
  // termination promise + resolvers
  private readonly onEnd: OnEnd;

  constructor(private readonly sender: MessageSender) {
    const onEnd = { finished: false } as OnEnd;
    onEnd.listen = new Promise((resolve, reject) => {
      onEnd.resolve = resolve;
      onEnd.reject = reject;
    });
    this.onEnd = onEnd;
  }

  /** Register stream handlers. */
  registerHandlers(...handlers: StreamHandler[]) {
    for (const handler of handlers) {
      this.streamHandlers.set(handler.kind, handler);
    }
  }

  /** Perform some work on a specific stream. */
  withStream(streamId: StreamId, work: (handler: StreamHandler, sender: StreamSender) => void) {
    const handler = this.streams.get(streamId);
    if (handler == null) {
      return false;
    }

    work(handler, new StreamSender(streamId, this.sender));
    return true;
  }

  /** Re-use an existing stream of given kind if present. */
  withStreamOfKind<TStreamKind extends StreamKind, THandler extends StreamHandler<TStreamKind>>(
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

  /** Open a new stream of given kind. */
  withNewStream<TStreamKind extends StreamKind, THandler extends StreamHandler<TStreamKind>>(
    kind: TStreamKind,
    work: (handler: THandler, sender: StreamSender) => void,
  ) {
    const handler = this.streamHandlers.get(kind);
    if (handler == null) {
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

  /** Handle incoming message on that socket. */
  onSocketMessage(msg: Uint8Array) {
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
      handler?.onClose(streamId, false);
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

  /** Notify about termination of the underlying socket. */
  onClose({ error }: { error?: Error }) {
    logger.log(`Closing the handler. Reason: ${error != null ? error.message : "close"}.`);
    // Socket closed - we should probably clear everything.
    for (const [streamId, handler] of this.streams.entries()) {
      handler.onClose(streamId, error === undefined);
    }
    this.streams.clear();

    // finish the handler.
    this.onEnd.finished = true;
    if (error != null) {
      this.onEnd.reject(error);
    } else {
      this.onEnd.resolve();
    }
  }

  /** Wait for the handler to be finished either via close or error. */
  waitForEnd(): Promise<void> {
    logger.log("Waiting for the handler to be closed.");
    return this.onEnd.listen;
  }
}

const MSG_LEN_PREFIX_BYTES = 4;
/**
 * Send a message to the socket, but prefix it with a 32-bit length,
 * so that the receiver can now the boundaries between the datum.
 */
export function sendWithLengthPrefix(socket: Socket, data: Uint8Array) {
  const buffer = new Uint8Array(MSG_LEN_PREFIX_BYTES);
  const encoder = Encoder.create({
    destination: buffer,
  });
  encoder.i32(data.length);
  socket.write(buffer);
  socket.write(data);
}

/**
 * Only triggers the `callback` in case full data blob is received.
 *
 * Each message should be prefixed with a single U32 denoting the length of the next data
 * frame that should be interpreted as single chunk.
 */
export function handleFragmentation(callback: (data: Buffer) => void): (data: Buffer) => void {
  let buffer = Buffer.alloc(0);
  let expectedLength = -1;

  return (data: Buffer) => {
    buffer = Buffer.concat([buffer, data]);
    do {
      // we now expect a length prefix.
      if (expectedLength === -1) {
        // not enough data to parse the length, wait for more.
        if (buffer.length < MSG_LEN_PREFIX_BYTES) {
          break;
        }

        expectedLength = buffer.readUint32LE();
        buffer = buffer.subarray(MSG_LEN_PREFIX_BYTES);
      }

      // we don't have enough data, so let's wait.
      if (buffer.length < expectedLength) {
        break;
      }

      // full chunk can be parsed now, but there might be some more.
      const chunk = buffer.subarray(0, expectedLength);
      buffer = buffer.subarray(expectedLength);
      expectedLength = -1;
      callback(chunk);
    } while (buffer.length > 0);
  };
}

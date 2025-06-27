import { Buffer } from "node:buffer";
import type { Socket } from "node:net";
import { BytesBlob } from "@typeberry/bytes";
import { Decoder, Encoder } from "@typeberry/codec";
import type { StreamHandler, StreamId, StreamKind, StreamManager, StreamMessageSender } from "@typeberry/jamnp-s";
import { Logger } from "@typeberry/logger";
import { NewStream, StreamEnvelope, StreamEnvelopeType } from "./stream.js";

export type ResponseHandler = (err: Error | null, response?: BytesBlob) => void;

const logger = Logger.new(import.meta.filename, "ext-ipc");

type OnEnd = {
  finished: boolean;
  listen: Promise<void>;
  resolve: () => void;
  reject: (error: Error) => void;
};

export class IpcHandler implements StreamManager {
  // already initiated streams
  private readonly streams: Map<StreamId, StreamHandler> = new Map();
  // streams awaiting confirmation from the other side.
  private readonly pendingStreams: Map<StreamId, boolean> = new Map();
  // a collection of handlers for particular stream kind
  private readonly streamHandlers: Map<StreamKind, StreamHandler> = new Map();
  // termination promise + resolvers
  private readonly onEnd: OnEnd;

  private readonly sender: IpcSender;

  constructor(socket: Socket) {
    const onEnd = { finished: false } as OnEnd;
    onEnd.listen = new Promise((resolve, reject) => {
      onEnd.resolve = resolve;
      onEnd.reject = reject;
    });
    this.onEnd = onEnd;
    this.sender = new IpcSender(socket);
  }

  /** Register stream handlers. */
  registerHandlers(...handlers: StreamHandler[]) {
    for (const handler of handlers) {
      this.streamHandlers.set(handler.kind, handler);
    }
  }

  /** Re-use an existing stream of given kind if present. */
  withStreamOfKind<TStreamKind extends StreamKind, THandler extends StreamHandler<TStreamKind>>(
    streamKind: TStreamKind,
    work: (handler: THandler, sender: EnvelopeSender) => void,
  ): void {
    // find first stream id with given kind
    for (const [streamId, handler] of this.streams.entries()) {
      if (handler.kind === streamKind) {
        work(handler as THandler, new EnvelopeSender(streamId, this.sender));
        return;
      }
    }
    throw new Error(`Missing handler for ${streamKind}!`);
  }

  /** Open a new stream of given kind. */
  withNewStream<TStreamKind extends StreamKind, THandler extends StreamHandler<TStreamKind>>(
    kind: TStreamKind,
    work: (handler: THandler, sender: EnvelopeSender) => void,
  ): void {
    const handler = this.streamHandlers.get(kind);
    if (handler === undefined) {
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

    const sender = new EnvelopeSender(streamId, this.sender);
    sender.open(NewStream.create({ streamByte: kind }));

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
    const streamSender = new EnvelopeSender(streamId, this.sender);
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
    logger.log(`Closing the handler. Reason: ${error !== undefined ? error.message : "close"}.`);
    // Socket closed - we should probably clear everything.
    for (const [streamId, handler] of this.streams.entries()) {
      handler.onClose(streamId, error === undefined);
    }
    this.streams.clear();

    // finish the handler.
    this.onEnd.finished = true;
    if (error !== undefined) {
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

class EnvelopeSender implements StreamMessageSender {
  constructor(
    public readonly streamId: StreamId,
    private readonly sender: IpcSender,
  ) {}

  open(newStream: NewStream) {
    const msg = Encoder.encodeObject(NewStream.Codec, newStream);
    this.sender.send(
      Encoder.encodeObject(
        StreamEnvelope.Codec,
        StreamEnvelope.create({ streamId: this.streamId, type: StreamEnvelopeType.Open, data: msg }),
      ),
    );
  }

  bufferAndSend(msg: BytesBlob): boolean {
    this.sender.send(
      Encoder.encodeObject(
        StreamEnvelope.Codec,
        StreamEnvelope.create({ streamId: this.streamId, type: StreamEnvelopeType.Msg, data: msg }),
      ),
    );
    // we are buffering until we run OOM
    return true;
  }

  close(): void {
    this.sender.send(
      Encoder.encodeObject(
        StreamEnvelope.Codec,
        StreamEnvelope.create({
          streamId: this.streamId,
          type: StreamEnvelopeType.Close,
          data: BytesBlob.blobFromNumbers([]),
        }),
      ),
    );
  }
}

class IpcSender {
  constructor(private readonly socket: Socket) {}

  send(data: BytesBlob): void {
    sendWithLengthPrefix(this.socket, data.raw);
  }

  close(): void {
    this.socket.end();
  }
}

const MSG_LEN_PREFIX_BYTES = 4;

/**
 * Send a message to the socket, but prefix it with a 32-bit length,
 * so that the receiver can now the boundaries between the datum.
 */
function sendWithLengthPrefix(socket: Socket, data: Uint8Array) {
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

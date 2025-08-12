import { BytesBlob } from "@typeberry/bytes";
import { Decoder, Encoder } from "@typeberry/codec";
import type { StreamHandler, StreamId, StreamKind, StreamKindOf, StreamMessageSender } from "@typeberry/jamnp-s";
import { Logger } from "@typeberry/logger";
import type { IpcHandler, IpcSender } from "../server.js";
import { NewStream, StreamEnvelope, StreamEnvelopeType } from "./stream.js";

export type ResponseHandler = (err: Error | null, response?: BytesBlob) => void;

const logger = Logger.new(import.meta.filename, "ext-ipc");

type OnEnd = {
  finished: boolean;
  listen: Promise<void>;
  resolve: () => void;
  reject: (error: Error) => void;
};

export class JamnpIpcHandler implements IpcHandler {
  /** already initiated streams */
  private readonly streams: Map<StreamId, StreamHandler> = new Map();
  /** streams awaiting confirmation from the other side. */
  private readonly pendingStreams: Map<StreamId, boolean> = new Map();
  /** a collection of handlers for particular stream kind */
  private readonly streamHandlers: Map<StreamKind, StreamHandler> = new Map();
  /** termination promise + resolvers */
  private readonly onEnd: OnEnd;

  constructor(private readonly sender: IpcSender) {
    let resolve = () => {};
    let reject = (_error: Error) => {};
    const listen = new Promise<void>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    this.onEnd = {
      finished: false,
      listen,
      resolve,
      reject,
    };
  }

  /** Register stream handlers. */
  registerStreamHandlers(...handlers: StreamHandler[]) {
    for (const handler of handlers) {
      this.streamHandlers.set(handler.kind, handler);
    }
  }

  /** Re-use an existing stream of given kind if present. */
  withStreamOfKind<THandler extends StreamHandler>(
    streamKind: StreamKindOf<THandler>,
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
  withNewStream<THandler extends StreamHandler>(
    kind: StreamKindOf<THandler>,
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

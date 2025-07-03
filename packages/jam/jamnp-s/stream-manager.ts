import type { ReadableStreamDefaultReader } from "node:stream/web";
import { BytesBlob } from "@typeberry/bytes";
import { Logger } from "@typeberry/logger";
import {
  type Peer,
  type PeerId,
  type Stream,
  encodeMessageLength,
  handleMessageFragmentation,
} from "@typeberry/networking";
import type { OK } from "@typeberry/utils";
import {
  type StreamHandler,
  type StreamId,
  type StreamKind,
  type StreamKindOf,
  type StreamMessageSender,
  tryAsStreamId,
  tryAsStreamKind,
} from "./protocol/stream.js";
import { handleAsyncErrors } from "./utils.js";

const logger = Logger.new(import.meta.filename, "stream");

export class StreamManager {
  /** A map of handlers for incoming stream kinds. */
  private readonly incomingHandlers: Map<StreamKind, StreamHandler> = new Map();
  /** A map of handlers for outgoing stream kinds. */
  private readonly outgoingHandlers: Map<StreamKind, StreamHandler> = new Map();

  /** A collection of open streams, peers and their handlers. */
  private readonly streams: Map<
    StreamId,
    {
      handler: StreamHandler;
      streamSender: QuicStreamSender;
      peer: Peer;
    }
  > = new Map();

  /** Promises for stream background tasks (reading data). */
  private readonly backgroundTasks: Map<StreamId, Promise<void>> = new Map();

  /** Add supported incoming handlers. */
  registerIncomingHandlers(...handlers: StreamHandler[]) {
    for (const handler of handlers) {
      this.incomingHandlers.set(handler.kind, handler);
    }
  }

  /** Add supported outgoing handlers. */
  registerOutgoingHandlers(...handlers: StreamHandler[]) {
    for (const handler of handlers) {
      this.outgoingHandlers.set(handler.kind, handler);
    }
  }

  /** Get peer associated with a stream. */
  getPeer(streamId: StreamId): Peer | null {
    return this.streams.get(streamId)?.peer ?? null;
  }

  /** Wait until all of the streams are closed. */
  async waitForFinish() {
    for (const task of this.backgroundTasks.values()) {
      await task;
    }
  }

  /** Attempt to find an already open stream of given kind. */
  withStreamOfKind<THandler extends StreamHandler>(
    peerId: PeerId,
    kind: StreamKindOf<THandler>,
    work: (handler: THandler, sender: QuicStreamSender) => OK,
  ): void {
    // TODO [ToDr] That might not be super performant, perhaps we should
    // maintain a mapping of Peer->open streams as well?
    for (const streamData of this.streams.values()) {
      if (streamData.handler.kind === kind && streamData.peer.id === peerId) {
        work(streamData.handler as THandler, streamData.streamSender);
        return;
      }
    }
  }

  /** Open a new stream of given kind, with the peer given. */
  withNewStream<THandler extends StreamHandler>(
    peer: Peer,
    kind: StreamKindOf<THandler>,
    work: (handler: THandler, sender: QuicStreamSender) => OK,
  ): void {
    const handler = this.outgoingHandlers.get(kind);
    if (handler === undefined) {
      throw new Error(`Unsupported outgoing stream kind: ${kind}`);
    }

    const stream = peer.openStream();
    const quicStream = this.registerStream(peer, handler, stream, BytesBlob.empty());
    // send the initial byte with stream kind
    quicStream.bufferAndSend(BytesBlob.blobFromNumbers([kind]), false);

    work(handler as THandler, quicStream);
  }

  /** Handle an incoming stream. */
  async onIncomingStream(peer: Peer, stream: Stream) {
    const { readable, streamId } = stream;
    const reader = readable.getReader();

    let bytes = BytesBlob.empty();
    try {
      // We expect a one-byte identifier first.
      const data = await reader.read();
      bytes = BytesBlob.blobFrom(data.value !== undefined ? data.value : new Uint8Array());
      logger.trace(`🚰 --> [${peer.id}:${streamId}] Initial data: ${bytes}`);
    } finally {
      reader.releaseLock();
    }

    if (bytes.raw.length < 1) {
      throw new Error(`Expected 1-byte stream identifier, got: ${bytes}`);
    }

    // stream kind
    const kind = tryAsStreamKind(bytes.raw[0]);
    const handler = this.incomingHandlers.get(kind);
    if (handler === undefined) {
      throw new Error(`Unsupported stream kind: ${kind}`);
    }

    logger.log(`🚰 --> [${peer.id}:${stream.streamId}] Stream identified as: ${kind}`);

    this.registerStream(peer, handler, stream, BytesBlob.blobFrom(bytes.raw.subarray(1)));
  }

  private registerStream(peer: Peer, handler: StreamHandler, stream: Stream, initialData: BytesBlob): QuicStreamSender {
    const streamId = tryAsStreamId(stream.streamId);

    // NOTE: `onError` callback may be called multiple times.
    const onError = (e: unknown) => {
      logger.error(`🚰 --- [${peer.id}:${streamId}] Stream error: ${e}. Disconnecting peer.`);
      // TODO [ToDr] We should clean up the stream when it's closed gracefuly!
      this.streams.delete(streamId);
      this.backgroundTasks.delete(streamId);
      // whenever we have an error, we are going to inform the handler
      // and close the stream,
      handler.onClose(streamId, true);
      // but also disconnect from the peer.
      peer.disconnect();
    };

    stream.addOnError(onError);
    const quicStream = new QuicStreamSender(streamId, stream, onError);
    const readStreamPromise = handleAsyncErrors(
      () => readStreamForever(peer, handler, quicStream, initialData, stream.readable.getReader()),
      onError,
    );

    this.streams.set(streamId, {
      handler,
      streamSender: quicStream,
      peer,
    });
    this.backgroundTasks.set(streamId, readStreamPromise);

    return quicStream;
  }
}

async function readStreamForever(
  peer: Peer,
  handler: StreamHandler,
  quicStream: QuicStreamSender,
  initialData: BytesBlob,
  reader: ReadableStreamDefaultReader<Uint8Array>,
) {
  // finally start listening for more data.
  let bytes = initialData;
  let isDone = false;
  const callback = handleMessageFragmentation((data) => {
    const bytes = BytesBlob.blobFrom(new Uint8Array(data));
    logger.trace(`🚰 --> [${peer.id}:${quicStream.streamId}] ${bytes}`);
    handler.onStreamMessage(quicStream, bytes);
  });

  for (;;) {
    // TODO [ToDr] We are going to read messages from the socket as fast as we can,
    // yet it doesn't mean we are able to handle them as fast. This should rather
    // be a promise, so that we can make back pressure here.
    callback(bytes.raw);

    if (isDone) {
      logger.log(`🚰 --> [${peer.id}:${quicStream.streamId}] remote finished.`);
      return;
    }

    // await for more data
    const data = await reader.read();
    isDone = data.done;
    bytes = BytesBlob.blobFrom(data.value !== undefined ? data.value : new Uint8Array());
  }
}

const MAX_OUTGOING_BUFFER_BYTES = 16384;

class QuicStreamSender implements StreamMessageSender {
  private bufferedLength = 0;
  private bufferedData: { data: BytesBlob; addPrefix: boolean }[] = [];
  private currentWriterPromise: Promise<void> | null = null;

  constructor(
    public readonly streamId: StreamId,
    private readonly internal: Stream,
    private readonly onError: (e: unknown) => void,
  ) {}

  /** Send given piece of data to the other end. */
  bufferAndSend(data: BytesBlob, prefixWithLength = true): boolean {
    if (this.bufferedLength > MAX_OUTGOING_BUFFER_BYTES) {
      return false;
    }
    this.bufferedData.push({ data, addPrefix: prefixWithLength });
    this.bufferedLength += data.length;
    // some other async task already has a lock, so it will keep writing.
    if (this.currentWriterPromise !== null) {
      return true;
    }
    // let's start an async task to write the buffer
    this.currentWriterPromise = handleAsyncErrors(
      async () => {
        const writer = this.internal.writable.getWriter();
        try {
          for (;;) {
            const chunk = this.bufferedData.shift();
            if (chunk === undefined) {
              return;
            }
            const { data, addPrefix } = chunk;
            logger.trace(`🚰 <-- [${this.streamId}] write: ${data}`);
            if (addPrefix) {
              await writer.write(encodeMessageLength(data.raw));
            }
            await writer.write(data.raw);
            this.bufferedLength -= data.length;
          }
        } finally {
          writer.releaseLock();
          this.currentWriterPromise = null;
        }
      },
      (e) => {
        this.onError(e);
      },
    );
    return true;
  }

  close(): void {
    handleAsyncErrors(async () => {
      logger.trace(`🚰 <-- [${this.streamId}] closing`);
      if (this.currentWriterPromise !== null) {
        await this.currentWriterPromise;
      }
      await this.internal.writable.close();
    }, this.onError);
  }
}

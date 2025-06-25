import { events, type QUICStream } from "@matrixai/quic";
import type { HeaderHash } from "@typeberry/block";
import { BytesBlob } from "@typeberry/bytes";
import type { ed25519 } from "@typeberry/crypto";
import { Logger } from "@typeberry/logger";
import { Quic } from "@typeberry/networking";
import type { QuicPeer } from "@typeberry/networking/quic-peer.js";
import { addEventListener } from "@typeberry/networking/quic-utils.js";
import { OK } from "@typeberry/utils";
import {
  type StreamHandler,
  type StreamId,
  type StreamKind,
  type StreamMessageSender,
  tryAsStreamId,
  tryAsStreamKind,
} from "./protocol/stream.js";

const logger = Logger.new(import.meta.filename, "jamnps");

export async function setup(bind: { host: string; port: number }, genesisHash: HeaderHash, key: ed25519.Ed25519Pair) {
  const genesisFirstBytes = genesisHash.toString().substring(2, 10);
  const network = await Quic.setup({
    host: bind.host,
    port: bind.port,
    key,
    protocols: [`jamnp-s/0/${genesisFirstBytes}`],
  });

  const streamManager = new StreamManager();

  network.onPeerConnect((peer) => {
    logger.log(`[${peer.id}] New peer ${peer.key} from ${peer.address}`);
    // whenever the peer wants to open a stream with us, let's handle that.
    peer.addOnStreamOpen((stream) => {
      streamManager.onNewStream(peer, stream).catch((e: unknown) => {
        logger.error(`[${peer.id}:${stream.streamId}]🚰  Stream error: ${e}. Disconnecting peer.`);
        peer.disconnect();
      });
      return OK;
    });
    return OK;
  });

  return {
    network,
    streamManager,
  };
}

class StreamManager {
  private readonly handlers: Map<StreamKind, StreamHandler> = new Map();

  private readonly streams: Map<StreamId, [StreamHandler, QuicStream]> = new Map();

  public registerHandlers(...handlers: StreamHandler[]) {
    for (const handler of handlers) {
      this.handlers.set(handler.kind, handler);
    }
  }

  async openStream(_peer: QuicPeer, _streamKind: StreamKind): Promise<QuicStream> {
    throw new Error("Not implemented yet!");
  }

  /** Handle an incoming stream. */
  async onNewStream(peer: QuicPeer, stream: QUICStream) {
    const { readable } = stream;
    const reader = readable.getReader();

    // We expect a one-byte identifier first.
    const data = await reader.read();
    const bytes = BytesBlob.blobFrom(data.value !== undefined ? data.value : new Uint8Array());
    logger.trace(`[${peer.id}:${stream.streamId}]🚰 Initial data: ${bytes}`);
    if (bytes.raw.length !== 1) {
      throw new Error(`Expected 1-byte stream identifier, got: ${bytes}`);
    }

    const streamId = tryAsStreamId(stream.streamId);

    // stream kind
    const kind = tryAsStreamKind(bytes.raw[0]);
    const handler = this.handlers.get(kind);
    if (handler === undefined) {
      throw new Error(`Unsupported stream kind: ${kind}`);
    }

    logger.log(`[${peer.id}:${stream.streamId}]🚰 Stream identified as: ${kind}`);
    // now we have a stream and it's associated handler, let's mark them as available
    const onError = () => {
      // whenever we have an error, we are going to inform the handler
      // and close the stream,
      handler.onClose(streamId, true);
      // but also disconnect from the peer.
      peer.disconnect();
    };
    const quicStream = new QuicStream(streamId, stream, onError);
    this.streams.set(streamId, [handler, quicStream]);
    addEventListener(stream, events.EventQUICStreamError, onError);

    // finally start listening for more data.
    for (;;) {
      const data = await reader.read();
      const bytes = BytesBlob.blobFrom(data.value !== undefined ? data.value : new Uint8Array());

      // TODO [ToDr] We are going to read messages from the socket as fast as we can,
      // yet it doesn't mean we are able to handle them as fast. This should rather
      // be a promise, so that we can make back pressure here.
      if (bytes.length > 0) {
        logger.trace(`[${peer.id}:${stream.streamId}]🚰  ${bytes}`);
        handler.onStreamMessage(quicStream, bytes);
      }

      if (data.done) {
        logger.log(`[${peer.id}:${stream.streamId}]🚰 Stream finished on the other end.`);
        return;
      }
    }
  }
}

const MAX_OUTGOING_BUFFER_BYTES = 16384;

class QuicStream implements StreamMessageSender {
  private bufferedLength = 0;

  constructor(
    public readonly streamId: StreamId,
    private readonly internal: QUICStream,
    private readonly onError: () => void,
  ) {}

  /** Send given piece of data to the other end. */
  bufferAndSend(data: BytesBlob): boolean {
    if (this.bufferedLength > MAX_OUTGOING_BUFFER_BYTES) {
      return false;
    }
    this.bufferedLength += data.length;
    handleAsyncErrors(
      async () => {
        const writer = this.internal.writable.getWriter();
        await writer.write(data.raw);

        this.bufferedLength -= data.length;
        writer.releaseLock();
      },
      (e) => {
        logger.error(`[${this.streamId}] Internal error while handling stream: ${e}`);
        this.onError();
      },
    );
    return true;
  }

  close(): void {
    handleAsyncErrors(
      async () => {
        await this.internal.writable.close();
      },
      (e) => {
        logger.error(`[${this.streamId}] Internal error while handling stream: ${e}`);
        this.onError();
      },
    );
  }
}

function handleAsyncErrors(work: () => Promise<void>, onError: (e: unknown) => void) {
  work().catch(onError);
}

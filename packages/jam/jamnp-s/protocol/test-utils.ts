import type { BytesBlob } from "@typeberry/bytes";
import type { OK } from "@typeberry/utils";
import {
  type StreamHandler,
  type StreamId,
  type StreamKind,
  type StreamKindOf,
  type StreamMessageSender,
  tryAsStreamId,
} from "./stream.js";

export class TestStreamSender implements StreamMessageSender {
  public readonly onSend: (data: BytesBlob) => void;
  public readonly onClose: () => void;

  constructor(
    public readonly streamId: StreamId,
    {
      onSend,
      onClose = () => {},
    }: {
      onSend: (data: BytesBlob) => void;
      onClose?: () => void;
    },
  ) {
    this.onSend = onSend;
    this.onClose = onClose;
  }

  bufferAndSend(data: BytesBlob): boolean {
    setImmediate(() => {
      this.onSend(data);
    });
    return true;
  }

  close(): void {
    setImmediate(() => {
      this.onClose();
    });
  }
}

/** We keep it low for the tests to run fast. */
const SIMULATED_STREAM_TIMEOUT_MS = 50;

export class TestMessageHandler {
  private readonly persistentStreams: Map<StreamKind, [StreamHandler, StreamMessageSender]> = new Map();
  private readonly registeredHandlers: Map<StreamKind, StreamHandler> = new Map();

  public readonly openStreams: Map<StreamId, [StreamHandler, StreamMessageSender]> = new Map();

  constructor(
    private readonly newStream: (id: StreamId, kind: StreamKind, onClose: () => void) => StreamMessageSender,
  ) {}

  registerHandlers(...handlers: StreamHandler[]) {
    for (const handler of handlers) {
      this.registeredHandlers.set(handler.kind, handler);
    }
  }

  streamReceive(id: StreamId, data: BytesBlob): void {
    const receiver = this.openStreams.get(id);
    if (receiver === undefined) {
      throw new Error(`Received data on a non-existent stream: ${id}. Data: ${data}.`);
    }

    receiver[0].onStreamMessage(receiver[1], data);
  }

  withStreamOfKind<THandler extends StreamHandler>(
    streamKind: StreamKindOf<THandler>,
    work: (handler: THandler, sender: StreamMessageSender) => OK,
  ): void {
    const handler = this.persistentStreams.get(streamKind);
    if (handler === undefined) {
      throw new Error(`Expected persistent stream not open! ${streamKind}`);
    }

    work(handler[0] as THandler, handler[1]);
  }

  withNewStream<THandler extends StreamHandler>(
    streamKind: StreamKindOf<THandler>,
    work: (handler: THandler, sender: StreamMessageSender) => OK,
  ): void {
    const getRandomStreamId = () => tryAsStreamId(Math.floor(Math.random() * 2 ** 16));
    const streams = this.openStreams;
    const streamId = (function findStreamId() {
      const s = getRandomStreamId();
      if (!streams.has(s)) {
        return s;
      }
      return findStreamId();
    })();

    // since we are picking a non-existing stream id, there is no way of
    // conflicting here, so the `[handler, stream]` will be fresh.
    const [handler, stream] = this.createStreamIfNotPresent(streamId, streamKind);
    work(handler as THandler, stream);
  }

  /**
   * Open a receiving stream.
   *
   * This is meant to simulate newly incoming stream that is opened by the other party.
   */
  receiveStreamOpen(id: StreamId, kind: StreamKind) {
    // NOTE this method can be called again even if the stream exists
    // and it should be a no-op.
    this.createStreamIfNotPresent(id, kind);
  }

  /**
   * Close a receiving stream.
   *
   * This is called when the other end wants to terminate the stream cleanly.
   * Indicates that there is no more messages being sent on the stream.
   *
   * Otherwise if we close the stream on our end, it will be removed
   * regardless of this method being called after `SIMULATED_STREAM_TIMEOUT_MS`.
   */
  receiveStreamClose(id: StreamId) {
    const stream = this.openStreams.get(id);
    if (stream === undefined) {
      return;
    }
    this.openStreams.delete(id);
    stream[0].onClose(id, false);
  }

  private createStreamIfNotPresent(streamId: StreamId, kind: StreamKind): [StreamHandler, StreamMessageSender] {
    const existing = this.openStreams.get(streamId);
    if (existing !== undefined) {
      // stream is already open, so we don't do anything.
      return existing;
    }

    const handler = this.registeredHandlers.get(kind);
    if (handler === undefined) {
      throw new Error(`Attempting to open stream with unregistered handler: ${kind}`);
    }

    const stream = this.newStream(streamId, kind, () => {
      setTimeout(() => {
        this.openStreams.delete(streamId);
        handler.onClose(streamId, false);
      }, SIMULATED_STREAM_TIMEOUT_MS);
    });
    this.openStreams.set(streamId, [handler, stream]);

    return [handler, stream];
  }
}

export function testClientServer() {
  const newStream = (other: TestMessageHandler, id: StreamId, onClose: () => void): TestStreamSender => {
    return new TestStreamSender(id, {
      onSend: (data) => other.streamReceive(id, data),
      onClose: () => {
        // close the stream on our end
        onClose();
        // notify the other end about stream closing.
        other.receiveStreamClose(id);
      },
    });
  };
  const client = new TestMessageHandler((id, kind, onClose): TestStreamSender => {
    setImmediate(() => {
      server.receiveStreamOpen(id, kind);
    });
    return newStream(server, id, onClose);
  });
  const server = new TestMessageHandler((id, kind, onClose): TestStreamSender => {
    setImmediate(() => {
      client.receiveStreamOpen(id, kind);
    });
    return newStream(client, id, onClose);
  });

  return {
    client,
    server,
  };
}

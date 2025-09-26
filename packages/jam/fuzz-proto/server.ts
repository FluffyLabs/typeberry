import type { BytesBlob } from "@typeberry/bytes";

/** A per-client handler of incoming socket messages. */
export interface IpcHandler {
  /** New data on the socket received. */
  onSocketMessage(msg: Uint8Array): Promise<void>;

  /** Socket closed or errored. */
  onClose(reason: { error?: Error }): void;
}

/** Sending data abstraction on a socket. */
export interface IpcSender {
  /** Write given data to the outgoing socket. */
  send(data: BytesBlob): void;

  /** Close the socket. */
  close(): void;
}

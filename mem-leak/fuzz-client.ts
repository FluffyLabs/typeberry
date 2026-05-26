/**
 * Shared fuzz-proto v1 *client* used by the memory-leak drivers.
 *
 * The server side lives in `bin/jam fuzz-target`; there is no client in the
 * repo, so this wraps the exported `@typeberry/fuzz-proto` v1 codec + the
 * `@typeberry/networking` length framing into a small request/response client
 * over the unix socket.
 *
 * Throwaway debugging tool; NOT part of the committed tree.
 */
import * as net from "node:net";
import { Decoder, Encoder } from "@typeberry/codec";
import type { ChainSpec } from "@typeberry/config";
import { v1 } from "@typeberry/fuzz-proto";
import { encodeMessageLength, handleMessageFragmentation } from "@typeberry/networking";
import { tryAsU32, tryAsU8 } from "@typeberry/numbers";

/** Minimal request/response client over the length-prefixed unix socket. */
export class FuzzClient {
  private pending: ((msg: v1.Message) => void) | null = null;

  private constructor(
    private readonly socket: net.Socket,
    private readonly spec: ChainSpec,
  ) {}

  static connect(socketPath: string, spec: ChainSpec): Promise<FuzzClient> {
    return new Promise((resolve, reject) => {
      const socket = net.createConnection(socketPath);
      const client = new FuzzClient(socket, spec);
      socket.on("connect", () => resolve(client));
      socket.on("error", reject);
      socket.on(
        "data",
        handleMessageFragmentation(
          (data: Uint8Array) => {
            const msg = Decoder.decodeObject(v1.messageCodec, data, spec);
            const p = client.pending;
            client.pending = null;
            if (p === null) {
              throw new Error(`Received unsolicited message: ${msg.type}`);
            }
            p(msg);
          },
          () => {
            throw new Error("message overflow from target");
          },
        ),
      );
    });
  }

  /** Send one message and await the single response the target sends back. */
  request(msg: v1.Message): Promise<v1.Message> {
    if (this.pending !== null) {
      throw new Error("request already in flight");
    }
    const encoded = Encoder.encodeObject(v1.messageCodec, msg, this.spec);
    const promise = new Promise<v1.Message>((resolve) => {
      this.pending = resolve;
    });
    this.socket.write(encodeMessageLength(encoded.raw));
    this.socket.write(encoded.raw);
    return promise;
  }

  close(): void {
    this.socket.end();
  }
}

function buildPeerInfo(): v1.PeerInfo {
  return v1.PeerInfo.create({
    fuzzVersion: tryAsU8(1),
    // advertise ancestry + fork so the target honours the ancestry we send
    features: tryAsU32(v1.Features.Ancestry | v1.Features.Fork),
    jamVersion: v1.Version.tryFromString("0.7.2"),
    appVersion: v1.Version.tryFromString("0.0.0"),
    name: "mem-leak-driver",
  });
}

/** Do the PeerInfo handshake; returns the target's PeerInfo. */
export async function handshake(client: FuzzClient): Promise<v1.PeerInfo> {
  const hello = await client.request({ type: v1.MessageType.PeerInfo, value: buildPeerInfo() });
  if (hello.type !== v1.MessageType.PeerInfo) {
    throw new Error(`Handshake failed, got message type ${hello.type}`);
  }
  return hello.value;
}

/** Assert a response is a StateRoot (not an Error / unexpected type) and return the root. */
export function expectStateRoot(msg: v1.Message, ctx: string) {
  if (msg.type === v1.MessageType.Error) {
    throw new Error(`${ctx}: target returned error: ${msg.value.message}`);
  }
  if (msg.type !== v1.MessageType.StateRoot) {
    throw new Error(`${ctx}: unexpected response type ${msg.type}`);
  }
  return msg.value;
}

import {Opaque} from "@typeberry/utils";

/** Peer id. */
export type PeerId = Opaque<string, "peerId">;

/** Peer connection details. */
export type PeerAddress = {
  /** IPV4 peer address */
  host: string;
  /** port number */
  port: number;
};

/** Bootnode class represents a single contact point in the network */
export class Bootnode implements PeerAddress {
  constructor(
    /** Network address derived from the node's cryptographic public key (always 53-character?) */
    readonly id: PeerId,
    /** IP address (either IPv4 or IPv6) of the bootnode */
    readonly ip: string,
    /** Port number on which the bootnode is listening for new connections */
    readonly port: number,
  ) {}

  get host() {
    return this.ip;
  }

  toString() {
    return `${this.id}@${this.ip}:${this.port}`;
  }
}

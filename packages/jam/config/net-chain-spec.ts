import { WithDebug } from "@typeberry/utils";

/**
* A chain specification collects information that describes a JAM-based network.
* It identifies the network a blockchain node connects to, the other nodes it initially
* communicates with, and the initial state that nodes must agree on to produce blocks.
* The chain specification can be defined in a JSON file.
*/
export class NetChainSpec extends WithDebug {
  /**
   * An optional list of the nodes accepting connections.
   * Each entry is a string in the following format: <name>@<ip>:<port>
   * where <name> is the 53-character DNS name consisting of "e" followed by the Ed25519 public key,
   * base-32 encoded using the alphabet "abcdefghijklmnopqrstuvwxyz234567".
   * <ip> is a string containing IPv4 or IPv6 address of the node.
   * IPv6 address may optionally be specified in square brackets ([]).
   * <port> is an IP port number.
   */
  readonly bootnodes?: string[];
  /**
   * The machine-readable identifier for the network.
   * This may be used as part of the network protocol identifier
   * in the future version of the network protocol.
   */
  readonly id: string;
  /** A hex string containing JAM-serialized genesis block header */
  readonly genesis_header: string;
  /**
   * An object defining genesis state. Each key is a 62-character hex string
   * defining the 31-byte state key. The values are arbitrary length hex strings.
   */
  readonly genesis_state: Map<string, string>;

  constructor(data: NetChainSpec) {
    super();

    this.bootnodes = data.bootnodes;
    this.id = data.id;
    this.genesis_header = data.genesis_header;
    this.genesis_state = data.genesis_state;
  }
}

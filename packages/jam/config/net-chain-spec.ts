import { Bytes } from "@typeberry/bytes";
import { type FromJson, json } from "@typeberry/json-parser";
import { WithDebug } from "@typeberry/utils";

class Bootnode extends WithDebug {
  readonly name: string;
  readonly ip: string;
  readonly port: number;

  constructor(name: string, ip: string, port: number) {
    super();
    this.name = name;
    this.ip = ip;
    this.port = port;
  }
}

/**
 * configuration file for any blockchain network built on the JAM protocol
 *
 * provides all the essential information that a new node
 * needs to join, connect to others, and understand the blockchain's starting point
 *
 *  https://github.com/polkadot-fellows/JIPs/blob/90f809b84a9913a821437225f085cf5153870212/JIP-4.md#jip-4-chainspec-file
 */
export class NetChainSpec extends WithDebug {
  /**
   * optional list of initial contact points for a new node joining the network
   *
   * - `name`: network address derived from the node's cryptographic public key
   * (always 53-character?)
   * - `ip`: IP address (either IPv4 or IPv6) of the bootnode.
   * - `port`: network port on the bootnode that is listening for new connections
   */
  readonly bootnodes?: string[];
  /** human-readable identifier for the network */
  readonly id: string;
  /** A hex string containing JAM-serialized genesis block header */
  readonly genesis_header: string;
  /**
   * An object defining genesis state. Each key is a 62-character hex string
   * defining the 31-byte state key. The values are arbitrary length hex strings.
   */
  readonly genesis_state: Record<string, string>;

  static fromJson: FromJson<NetChainSpec> = {
    bootnodes: json.optional(json.array("string")),
    id: "string",
    genesis_header: "string",
    genesis_state: json.record("string"),
  };

  private constructor(data: NetChainSpec) {
    super();

    this.bootnodes = data.bootnodes;
    this.id = data.id;
    this.genesis_header = data.genesis_header;
    this.genesis_state = data.genesis_state;
  }
}

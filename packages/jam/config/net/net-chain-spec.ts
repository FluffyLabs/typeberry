import { type JsonObject, fromJson } from "@typeberry/block-json";
import { Bytes, BytesBlob } from "@typeberry/bytes";
import { json } from "@typeberry/json-parser";
import { WithDebug } from "@typeberry/utils";

/**
 * Bootnode class represents a single bootnode in the network.
 */
class Bootnode extends WithDebug {
  readonly name: string;
  readonly ip: string;
  readonly port: number;

  static fromString(v: string): Bootnode {
    const [name, ipPort] = v.split("@");
    // spliting only by last `:` in case of IPv6
    const ip = ipPort.substring(0, ipPort.lastIndexOf(":"));
    const port = ipPort.substring(ipPort.lastIndexOf(":") + 1);
    if (name === undefined || ip === undefined || port === undefined) {
      throw new Error(`Invalid bootnode string: ${v}, expected format: <name>@<ip>:<port>`);
    }

    const portNumber = Number.parseInt(port);
    if (Number.isNaN(portNumber) || portNumber < 0 || portNumber > 65535) {
      throw new Error(`Invalid port number: ${port}`);
    }

    return new Bootnode(name, ip, portNumber);
  }

  constructor(name: string, ip: string, port: number) {
    super();
    this.name = name;
    this.ip = ip;
    this.port = port;
  }
}

/**
 * Configuration file for any blockchain network built on the JAM protocol
 *
 * Provides all the essential information that a new node
 * needs to join, connect to others, and understand the blockchain's starting point
 *
 *  https://github.com/polkadot-fellows/JIPs/blob/90f809b84a9913a821437225f085cf5153870212/JIP-4.md#jip-4-chainspec-file
 */
export class NetChainSpec extends WithDebug {
  /**
   * Optional list of initial contact points for a new node joining the network
   *
   * - `name`: network address derived from the node's cryptographic public key
   * (always 53-character?)
   * - `ip`: IP address (either IPv4 or IPv6) of the bootnode.
   * - `port`: network port on the bootnode that is listening for new connections
   */
  readonly bootnodes?: Bootnode[];
  /** Human-readable identifier for the network */
  readonly id: string;
  /** Contains the serialized header of the first `block 0` */
  readonly genesisHeader: BytesBlob;
  /**
   * Initial state of the blockchain at the moment of its creation
   *
   * - `key`: is 31-byte object identifier
   * - `value`: is the data stored at this location, as BytesBlob of any length.
   */
  readonly genesisState: Map<Bytes<31>, BytesBlob>;

  static get fromJson() {
    return json.object<JsonObject<NetChainSpec>, NetChainSpec>(
      {
        bootnodes: json.optional(json.array(json.fromString(Bootnode.fromString))),
        id: "string",
        genesis_header: fromJson.bytesBlob,
        genesis_state: json.map(
          json.fromString<Bytes<31>>((v) => Bytes.parseBytesNoPrefix(v, 31).asOpaque()),
          fromJson.bytesBlob,
        ),
      },
      (o) =>
        NetChainSpec.create({
          bootnodes: o.bootnodes,
          id: o.id,
          genesisHeader: o.genesis_header,
          genesisState: o.genesis_state ?? new Map(),
        }),
    );
  }

  static create({
    bootnodes = [],
    id = "",
    genesisHeader = BytesBlob.empty(),
    genesisState = new Map(),
  }: {
    bootnodes?: Bootnode[];
    id?: string;
    genesisHeader?: BytesBlob;
    genesisState?: Map<Bytes<31>, BytesBlob>;
  }) {
    return new NetChainSpec({ bootnodes, id, genesisHeader, genesisState });
  }

  private constructor(data: NetChainSpec) {
    super();

    this.bootnodes = data.bootnodes;
    this.id = data.id;
    this.genesisHeader = data.genesisHeader;
    this.genesisState = data.genesisState;
  }
}

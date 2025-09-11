import { Header, type HeaderHash, type StateRootHash, type TimeSlot } from "@typeberry/block";
import { type CodecRecord, codec } from "@typeberry/codec";
import { HASH_SIZE } from "@typeberry/hash";
import type { U8, U32 } from "@typeberry/numbers";
import { WithDebug } from "@typeberry/utils";
import { type ImportBlock, type KeyValue, Version, importBlockCodec, stateCodec } from "../v0/types.js";

/**
 * Fuzzer Protocol V1
 * Reference: https://github.com/davxy/jam-conformance/blob/main/fuzz-proto/fuzz.asn
 */
// Feature bit constants
export enum Features {
  Ancestry = 1, // 2^0
  Fork = 2, // 2^1
  Reserved = 2147483648, // 2^31
}

/**
 * PeerInfo ::= SEQUENCE {
 *     fuzz-version U8,
 *     features     Features,
 *     app-version  Version,
 *     jam-version  Version,
 *     name         UTF8String
 * }
 */
export class PeerInfo extends WithDebug {
  static Codec = codec.Class(PeerInfo, {
    fuzzVersion: codec.u8,
    features: codec.u32,
    appVersion: Version.Codec,
    jamVersion: Version.Codec,
    name: codec.string,
  });

  static create({ fuzzVersion, features, appVersion, jamVersion, name }: CodecRecord<PeerInfo>) {
    return new PeerInfo(fuzzVersion, features, appVersion, jamVersion, name);
  }

  private constructor(
    public readonly fuzzVersion: U8,
    public readonly features: U32,
    public readonly appVersion: Version,
    public readonly jamVersion: Version,
    public readonly name: string,
  ) {
    super();
  }
}

/**
 * AncestryItem ::= SEQUENCE {
 *     slot TimeSlot,
 *     header-hash HeaderHash
 * }
 */
export class AncestryItem extends WithDebug {
  static Codec = codec.Class(AncestryItem, {
    slot: codec.u32.asOpaque<TimeSlot>(),
    headerHash: codec.bytes(HASH_SIZE).asOpaque<HeaderHash>(),
  });

  static create({ slot, headerHash }: CodecRecord<AncestryItem>) {
    return new AncestryItem(slot, headerHash);
  }

  private constructor(
    public readonly slot: TimeSlot,
    public readonly headerHash: HeaderHash,
  ) {
    super();
  }
}

/**
 * Ancestry ::= SEQUENCE (SIZE(0..24)) OF AncestryItem
 * Empty when `feature-ancestry` is not supported by both parties
 */
export const ancestryCodec = codec.sequenceVarLen(AncestryItem.Codec);
export type Ancestry = AncestryItem[];

/**
 * Initialize ::= SEQUENCE {
 *     header Header,
 *     keyvals State,
 *     ancestry Ancestry
 * }
 */
export class Initialize extends WithDebug {
  static Codec = codec.Class(Initialize, {
    header: Header.Codec,
    keyvals: stateCodec,
    ancestry: ancestryCodec,
  });

  static create({ header, keyvals, ancestry }: CodecRecord<Initialize>) {
    return new Initialize(header, keyvals, ancestry);
  }

  private constructor(
    public readonly header: Header,
    public readonly keyvals: KeyValue[],
    public readonly ancestry: Ancestry,
  ) {
    super();
  }
}

/** GetState ::= HeaderHash */
export const getStateCodec = codec.bytes(HASH_SIZE).asOpaque<HeaderHash>();
export type GetState = HeaderHash;

/** GetExports ::= OpaqueHash */
// TODO: Implement OpaqueHash type when available
// export const getExportsCodec = codec.bytes(HASH_SIZE).asOpaque<OpaqueHash>();
// export type GetExports = OpaqueHash;

/** StateRoot ::= StateRootHash */
export const stateRootCodec = codec.bytes(HASH_SIZE).asOpaque<StateRootHash>();
export type StateRoot = StateRootHash;

/** Error ::= NULL */
export class ErrorMessage extends WithDebug {
  static Codec = codec.custom<ErrorMessage>(
    { name: "Error", sizeHint: { bytes: 0, isExact: true } },
    () => {}, // No encoding needed for NULL
    () => ErrorMessage.create(),
    () => {}, // No skipping needed for NULL
  );

  static create(): ErrorMessage {
    return new ErrorMessage();
  }

  private constructor() {
    super();
  }
}

/** Message choice type tags */
export enum MessageType {
  PeerInfo = 0,
  Initialize = 1,
  StateRoot = 2,
  ImportBlock = 3,
  GetState = 4,
  State = 5,
  Error = 255,
}

/** Message data union */
export type MessageData =
  | { type: MessageType.PeerInfo; value: PeerInfo }
  | { type: MessageType.Initialize; value: Initialize }
  | { type: MessageType.StateRoot; value: StateRoot }
  | { type: MessageType.ImportBlock; value: ImportBlock }
  | { type: MessageType.GetState; value: GetState }
  | { type: MessageType.State; value: KeyValue[] }
  | { type: MessageType.Error; value: ErrorMessage };

/**
 * Message ::= CHOICE {
 *     peer-info     [0] PeerInfo,
 *     initialize    [1] Initialize,
 *     state-root    [2] StateRoot,
 *     import-block  [3] ImportBlock,
 *     get-state     [4] GetState,
 *     state         [5] State,
 *     error         [255] Error
 * }
 */
export const messageCodec = codec.custom<MessageData>(
  {
    name: "Message",
    sizeHint: { bytes: 1, isExact: false },
  },
  (e, msg) => {
    e.i8(msg.type);
    switch (msg.type) {
      case MessageType.PeerInfo:
        PeerInfo.Codec.encode(e, msg.value);
        break;
      case MessageType.Initialize:
        Initialize.Codec.encode(e, msg.value);
        break;
      case MessageType.StateRoot:
        stateRootCodec.encode(e, msg.value);
        break;
      case MessageType.ImportBlock:
        importBlockCodec.encode(e, msg.value);
        break;
      case MessageType.GetState:
        getStateCodec.encode(e, msg.value);
        break;
      case MessageType.State:
        stateCodec.encode(e, msg.value);
        break;
      case MessageType.Error:
        ErrorMessage.Codec.encode(e, msg.value);
        break;
      default:
        throw new Error(`Unknown message type: ${msg}`);
    }
  },
  (d): MessageData => {
    const type = d.u8();
    switch (type) {
      case MessageType.PeerInfo:
        return { type: MessageType.PeerInfo, value: PeerInfo.Codec.decode(d) };
      case MessageType.Initialize:
        return { type: MessageType.Initialize, value: Initialize.Codec.decode(d) };
      case MessageType.StateRoot:
        return { type: MessageType.StateRoot, value: stateRootCodec.decode(d) };
      case MessageType.ImportBlock:
        return { type: MessageType.ImportBlock, value: importBlockCodec.decode(d) };
      case MessageType.GetState:
        return { type: MessageType.GetState, value: getStateCodec.decode(d) };
      case MessageType.State:
        return { type: MessageType.State, value: stateCodec.decode(d) };
      case MessageType.Error:
        return { type: MessageType.Error, value: ErrorMessage.Codec.decode(d) };
      default:
        throw new Error(`Unknown message type: ${type}`);
    }
  },
  (s) => {
    const type = s.decoder.u8();
    switch (type) {
      case MessageType.PeerInfo:
        PeerInfo.Codec.View.skip(s);
        break;
      case MessageType.Initialize:
        Initialize.Codec.View.skip(s);
        break;
      case MessageType.StateRoot:
        stateRootCodec.View.skip(s);
        break;
      case MessageType.ImportBlock:
        importBlockCodec.View.skip(s);
        break;
      case MessageType.GetState:
        getStateCodec.View.skip(s);
        break;
      case MessageType.State:
        stateCodec.View.skip(s);
        break;
      case MessageType.Error:
        ErrorMessage.Codec.View.skip(s);
        break;
      default:
        throw new Error(`Unknown message type: ${type}`);
    }
  },
);

export type Message = MessageData;

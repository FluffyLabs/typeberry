import { Block, type BlockView, Header, type HeaderHash, type StateRootHash, type TimeSlot } from "@typeberry/block";
import type { BytesBlob } from "@typeberry/bytes";
import { type CodecRecord, codec } from "@typeberry/codec";
import { HASH_SIZE, TRUNCATED_HASH_SIZE, type TruncatedHash } from "@typeberry/hash";
import { tryAsU8, type U8, type U32 } from "@typeberry/numbers";
import { WithDebug } from "@typeberry/utils";

/**
 * Version ::= SEQUENCE {
 *     major INTEGER (0..255),
 *     minor INTEGER (0..255),
 *     patch INTEGER (0..255)
 * }
 */
export class Version extends WithDebug {
  static Codec = codec.Class(Version, {
    major: codec.u8,
    minor: codec.u8,
    patch: codec.u8,
  });

  static tryFromString(str: string): Version {
    const parse = (v: string) => tryAsU8(Number(v));
    try {
      const [major, minor, patch] = str.trim().split(".").map(parse);

      return Version.create({
        major,
        minor,
        patch,
      });
    } catch (e) {
      throw new Error(`Unable to parse ${str} as Version: ${e}`);
    }
  }

  static create({ major, minor, patch }: CodecRecord<Version>) {
    return new Version(major, minor, patch);
  }

  private constructor(
    public readonly major: U8,
    public readonly minor: U8,
    public readonly patch: U8,
  ) {
    super();
  }
}

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
 *     jam-version  Version,
 *     app-version  Version,
 *     name         UTF8String
 * }
 */
export class PeerInfo extends WithDebug {
  static Codec = codec.Class(PeerInfo, {
    fuzzVersion: codec.u8,
    features: codec.u32,
    jamVersion: Version.Codec,
    appVersion: Version.Codec,
    name: codec.string,
  });

  static create({ fuzzVersion, features, appVersion, jamVersion, name }: CodecRecord<PeerInfo>) {
    return new PeerInfo(fuzzVersion, features, jamVersion, appVersion, name);
  }

  private constructor(
    public readonly fuzzVersion: U8,
    public readonly features: U32,
    public readonly jamVersion: Version,
    public readonly appVersion: Version,
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
 * KeyValue ::= SEQUENCE {
 *     key     TrieKey,
 *     value   OCTET STRING
 * }
 */
export class KeyValue extends WithDebug {
  static Codec = codec.Class(KeyValue, {
    key: codec.bytes(TRUNCATED_HASH_SIZE),
    value: codec.blob,
  });

  static create({ key, value }: CodecRecord<KeyValue>) {
    return new KeyValue(key, value);
  }

  private constructor(
    public readonly key: TruncatedHash,
    public readonly value: BytesBlob,
  ) {
    super();
  }
}

/** State ::= SEQUENCE OF KeyValue */
export const stateCodec = codec.sequenceVarLen(KeyValue.Codec);

/**
 * Ancestry ::= SEQUENCE (SIZE(0..24)) OF AncestryItem
 * Empty when `feature-ancestry` is not supported by both parties
 */
export const ancestryCodec = codec.sequenceVarLen(AncestryItem.Codec, {
  minLength: 0,
  maxLength: 24,
});
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

/** StateRoot ::= StateRootHash */
export const stateRootCodec = codec.bytes(HASH_SIZE).asOpaque<StateRootHash>();
export type StateRoot = StateRootHash;

/** Error ::= UTF8String */
export class ErrorMessage extends WithDebug {
  static Codec = codec.Class(ErrorMessage, {
    message: codec.string,
  });

  static create({ message }: CodecRecord<ErrorMessage>): ErrorMessage {
    return new ErrorMessage(message);
  }

  private constructor(public readonly message: string) {
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
  | { type: MessageType.ImportBlock; value: BlockView }
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
        Block.Codec.View.encode(e, msg.value);
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
        return { type: MessageType.ImportBlock, value: Block.Codec.View.decode(d) };
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
        Block.Codec.View.skip(s);
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

import { Block, type BlockView, Header, type HeaderHash, type StateRootHash } from "@typeberry/block";
import type { BytesBlob } from "@typeberry/bytes";
import { type CodecRecord, codec } from "@typeberry/codec";
import { HASH_SIZE, TRUNCATED_HASH_SIZE, type TruncatedHash } from "@typeberry/hash";
import { tryAsU8, type U8 } from "@typeberry/numbers";
import { WithDebug } from "@typeberry/utils";

/**
 * Reference: https://github.com/davxy/jam-conformance/blob/7c6a371a966c6446564f91676e7a2afdec5fa3da/fuzz-proto/fuzz.asn
 */

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
 * PeerInfo ::= SEQUENCE {
 *     name         UTF8String,
 *     app-version  Version,
 *     jam-version  Version
 * }
 */
export class PeerInfo extends WithDebug {
  static Codec = codec.Class(PeerInfo, {
    name: codec.string,
    appVersion: Version.Codec,
    jamVersion: Version.Codec,
  });

  static create({ name, appVersion, jamVersion }: CodecRecord<PeerInfo>) {
    return new PeerInfo(name, appVersion, jamVersion);
  }

  private constructor(
    public readonly name: string,
    public readonly appVersion: Version,
    public readonly jamVersion: Version,
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
 * SetState ::= SEQUENCE {
 *     header  Header,
 *     state   State
 * }
 */
export class SetState extends WithDebug {
  static Codec = codec.Class(SetState, {
    header: Header.Codec,
    state: codec.sequenceVarLen(KeyValue.Codec),
  });

  static create({ header, state }: CodecRecord<SetState>) {
    return new SetState(header, state);
  }

  private constructor(
    public readonly header: Header,
    public readonly state: KeyValue[],
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

/** Message choice type tags */
export enum MessageType {
  PeerInfo = 0,
  ImportBlock = 1,
  SetState = 2,
  GetState = 3,
  State = 4,
  StateRoot = 5,
}
/** Message data union */
export type MessageData =
  | { type: MessageType.PeerInfo; value: PeerInfo }
  | { type: MessageType.ImportBlock; value: BlockView }
  | { type: MessageType.SetState; value: SetState }
  | { type: MessageType.GetState; value: GetState }
  | { type: MessageType.State; value: KeyValue[] }
  | { type: MessageType.StateRoot; value: StateRoot };

/**
 * Message ::= CHOICE {
 *     peer-info    [0] PeerInfo,
 *     import-block [1] ImportBlock,
 *     set-state    [2] SetState,
 *     get-state    [3] GetState,
 *     state        [4] State,
 *     state-root   [5] StateRoot
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
      case MessageType.ImportBlock:
        Block.Codec.View.encode(e, msg.value);
        break;
      case MessageType.SetState:
        SetState.Codec.encode(e, msg.value);
        break;
      case MessageType.GetState:
        getStateCodec.encode(e, msg.value);
        break;
      case MessageType.State:
        stateCodec.encode(e, msg.value);
        break;
      case MessageType.StateRoot:
        stateRootCodec.encode(e, msg.value);
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
      case MessageType.ImportBlock:
        return { type: MessageType.ImportBlock, value: Block.Codec.View.decode(d) };
      case MessageType.SetState:
        return { type: MessageType.SetState, value: SetState.Codec.decode(d) };
      case MessageType.GetState:
        return { type: MessageType.GetState, value: getStateCodec.decode(d) };
      case MessageType.State:
        return { type: MessageType.State, value: stateCodec.decode(d) };
      case MessageType.StateRoot:
        return { type: MessageType.StateRoot, value: stateRootCodec.decode(d) };
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
      case MessageType.ImportBlock:
        Block.Codec.View.skip(s);
        break;
      case MessageType.SetState:
        SetState.Codec.View.skip(s);
        break;
      case MessageType.GetState:
        getStateCodec.View.skip(s);
        break;
      case MessageType.State:
        stateCodec.View.skip(s);
        break;
      case MessageType.StateRoot:
        stateRootCodec.View.skip(s);
        break;
      default:
        throw new Error(`Unknown message type: ${type}`);
    }
  },
);

export type Message = MessageData;

import type { BytesBlob } from "@typeberry/bytes";
import { type CodecRecord, codec } from "@typeberry/codec";
import type { StreamId, StreamKind } from "@typeberry/jamnp-s";
import { type U8, tryAsU8 } from "@typeberry/numbers";

export enum StreamEnvelopeType {
  Msg = 0,
  Open = 1,
  Close = 2,
}

export class StreamEnvelope {
  static Codec = codec.Class(StreamEnvelope, {
    streamId: codec.u32,
    type: codec.u8.convert<StreamEnvelopeType>(
      (i) => tryAsU8(i),
      (o: U8) => {
        switch (o) {
          case StreamEnvelopeType.Msg:
            return StreamEnvelopeType.Msg;
          case StreamEnvelopeType.Open:
            return StreamEnvelopeType.Open;
          case StreamEnvelopeType.Close:
            return StreamEnvelopeType.Close;
          default:
            throw new Error(`Invalid 'StreamEnvelopeType' value: ${o}`);
        }
      },
    ),
    data: codec.blob,
  });

  static create({ streamId, type, data }: CodecRecord<StreamEnvelope>) {
    return new StreamEnvelope(streamId, type, data);
  }

  private constructor(
    public readonly streamId: StreamId,
    public readonly type: StreamEnvelopeType,
    public readonly data: BytesBlob,
  ) {}
}

export class NewStream {
  static Codec = codec.Class(NewStream, {
    streamByte: codec.u8,
  });

  static create({ streamByte }: CodecRecord<NewStream>) {
    return new NewStream(streamByte);
  }

  private constructor(public readonly streamByte: StreamKind) {}
}

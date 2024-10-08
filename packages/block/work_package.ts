import type { Bytes, BytesBlob } from "@typeberry/bytes";
import { type CodecRecord, codec } from "@typeberry/codec";
import type { FixedSizeArray } from "@typeberry/collections";
import type { ServiceId } from "./common";
import { HASH_SIZE } from "./hash";
import { RefineContext } from "./refine_context";
import { WorkItem } from "./work_item";

export class Authorizer {
  static Codec = codec.Class(Authorizer, {
    codeHash: codec.bytes(HASH_SIZE),
    params: codec.blob,
  });

  static fromCodec({ codeHash, params }: CodecRecord<Authorizer>) {
    return new Authorizer(codeHash, params);
  }

  constructor(
    public readonly codeHash: Bytes<typeof HASH_SIZE>,
    public readonly params: BytesBlob,
  ) {}
}

export class WorkPackage {
  static Codec = codec.Class(WorkPackage, {
    authorization: codec.blob,
    authCodeHost: codec.u32.cast(),
    authorizer: Authorizer.Codec,
    context: RefineContext.Codec,
    items: codec.sequenceVarLen(WorkItem.Codec),
  });

  static fromCodec({ authorization, authCodeHost, authorizer, context, items }: CodecRecord<WorkPackage>) {
    return new WorkPackage(authorization, authCodeHost, authorizer, context, items);
  }

  constructor(
    public readonly authorization: BytesBlob,
    public readonly authCodeHost: ServiceId,
    public readonly authorizer: Authorizer,
    public readonly context: RefineContext,
    public readonly items: FixedSizeArray<WorkItem, 1 | 2 | 3 | 4>,
  ) {}
}

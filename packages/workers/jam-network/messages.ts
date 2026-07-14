import { Block } from "@typeberry/block/block.js";
import { headerViewWithHashCodec } from "@typeberry/block/header.js";
import { codec } from "@typeberry/codec";
import { createProtocol } from "@typeberry/workers-api/protocol.js";
import type { Api, Internal } from "@typeberry/workers-api/types.js";

/** Browser-safe protocol shared by real and manually controlled networking workers. */
export const protocol = createProtocol("net", {
  toWorker: {
    newHeader: {
      request: headerViewWithHashCodec,
      response: codec.nothing,
    },
    finish: {
      request: codec.nothing,
      response: codec.nothing,
    },
  },
  fromWorker: {
    blocks: {
      request: codec.sequenceVarLen(Block.Codec.View),
      response: codec.nothing,
    },
  },
});

export type NetworkingInternal = Internal<typeof protocol>;
export type NetworkingApi = Api<typeof protocol>;

import { Block } from "@typeberry/block";
import { codec } from "@typeberry/codec";
import { type Api, createProtocol, type Internal } from "@typeberry/workers-api";

export type GeneratorInternal = Internal<typeof protocol>;
export type GeneratorApi = Api<typeof protocol>;

export const protocol = createProtocol("blockgen", {
  toWorker: {
    finish: {
      request: codec.nothing,
      response: codec.nothing,
    },
  },
  fromWorker: {
    block: {
      request: Block.Codec.View,
      response: codec.nothing,
    },
  },
});

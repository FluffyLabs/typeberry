import { bestBlock } from "./methods/best-block.js";
import { finalizedBlock } from "./methods/finalized-block.js";
import { parameters } from "./methods/parameters.js";
import { parent } from "./methods/parent.js";
import { subscribeBestBlock } from "./methods/subscribe-best-block.js";
import { subscribeFinalizedBlock } from "./methods/subscribe-finalized-block.js";
import type { RpcMethod } from "./types.js";

// biome-ignore lint/suspicious/noExplicitAny: the map must be able to store methods with any parameters and return values
export function loadMethodsInto(methods: Map<string, RpcMethod<any, any>>): void {
  methods.set("bestBlock", bestBlock);
  methods.set("parameters", parameters);
  methods.set("subscribeBestBlock", subscribeBestBlock);
  methods.set("finalizedBlock", finalizedBlock);
  methods.set("subscribeFinalizedBlock", subscribeFinalizedBlock);
  methods.set("parent", parent);
}

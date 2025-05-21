import { bestBlock } from "./methods/best-block";
import { finalizedBlock } from "./methods/finalized-block";
import { parameters } from "./methods/parameters";
import { parent } from "./methods/parent";
import { subscribeBestBlock } from "./methods/subscribe-best-block";
import { subscribeFinalizedBlock } from "./methods/subscribe-finalized-block";
import type { RpcMethod } from "./types";

// biome-ignore lint/suspicious/noExplicitAny: the map must be able to store methods with any parameters and return values
export function loadMethodsInto(methods: Map<string, RpcMethod<any, any>>): void {
  methods.set("bestBlock", bestBlock);
  methods.set("parameters", parameters);
  methods.set("subscribeBestBlock", subscribeBestBlock);
  methods.set("finalizedBlock", finalizedBlock);
  methods.set("subscribeFinalizedBlock", subscribeFinalizedBlock);
  methods.set("parent", parent);
}

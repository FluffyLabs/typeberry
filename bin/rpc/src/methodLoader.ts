import { bestBlock } from "./methods/bestBlock";
import { finalizedBlock } from "./methods/finalizedBlock";
import { parameters } from "./methods/parameters";
import { parent } from "./methods/parent";
import { subscribeBestBlock } from "./methods/subscribeBestBlock";
import { subscribeFinalizedBlock } from "./methods/subscribeFinalizedBlock";
import type { RpcMethod } from "./types";

// biome-ignore lint/suspicious/noExplicitAny: the map must be able to store methods with any parameters and return values
export function loadMethods(methods: Map<string, RpcMethod<any, any>>): void {
  methods.set("bestBlock", bestBlock);
  methods.set("parameters", parameters);
  methods.set("subscribeBestBlock", subscribeBestBlock);
  methods.set("finalizedBlock", finalizedBlock);
  methods.set("subscribeFinalizedBlock", subscribeFinalizedBlock);
  methods.set("parent", parent);
}

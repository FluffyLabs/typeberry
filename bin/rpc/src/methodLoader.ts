import { bestBlock } from "./methods/bestBlock";
import { parameters } from "./methods/parameters";
import type { RpcMethod } from "./types";

export function loadMethods(methods: Map<string, RpcMethod>): void {
  methods.set("bestBlock", bestBlock);
  methods.set("parameters", parameters);
}

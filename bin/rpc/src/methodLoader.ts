import { bestBlock } from "./methods/bestBlock";
import type { RpcMethod } from "./types";

export function loadMethods(methods: Map<string, RpcMethod>): void {
  methods.set("bestBlock", bestBlock);
}

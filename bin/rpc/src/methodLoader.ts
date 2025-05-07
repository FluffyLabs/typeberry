import type { MethodRegistry } from "./methodRegistry";
import { bestBlock } from "./methods/bestBlock";

export function loadMethods(registry: MethodRegistry): void {
  registry.register("bestBlock", bestBlock);
}

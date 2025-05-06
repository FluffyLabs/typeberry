import type { MethodRegistry } from "./methodRegistry";
import { echo } from "./methods/echo";

export function loadMethods(registry: MethodRegistry): void {
  registry.register("echo", echo);
}

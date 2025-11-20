import type { Handler } from "../types.js";
import { notImplemented } from "./not-implemented.js";

export const beefyRoot: Handler<"beefyRoot"> = async () => {
  return notImplemented(); // todo [seko] implement when finality is there
};

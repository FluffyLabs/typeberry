import {ChainSpec} from "@typeberry/config";

export function withContext<T>(name: string, cb: (ctx: ChainSpec) => T) {
  return (context: unknown) => {
    if (context instanceof ChainSpec) {
      return cb(context);
    }
    if (context) {
      throw new Error(`[${name}] Unexpected context type ${typeof context} while encoding/decoding.`);
    }
    throw new Error(`[${name}] Missing context while encoding/decoding!`);
  };
}

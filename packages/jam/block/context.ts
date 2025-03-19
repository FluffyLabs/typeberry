import { ChainSpec } from "@typeberry/config";

/**
 * Helper function to cast the context to the expected type when
 * implementing context-dependent codecs.
 */
export function withContext<T>(name: string, cb: (ctx: ChainSpec) => T) {
  return (context: unknown) => {
    if (context instanceof ChainSpec) {
      return cb(context);
    }

    if (context !== undefined) {
      throw new Error(`[${name}] Unexpected context type ${typeof context} while encoding/decoding.`);
    }
    throw new Error(`[${name}] Missing context while encoding/decoding!`);
  };
}

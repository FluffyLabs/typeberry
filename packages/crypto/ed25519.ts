import { ed25519 } from "@noble/curves/ed25519";
import type { Ed25519Key, Ed25519Signature } from "@typeberry/block";
import type { BytesBlob } from "@typeberry/bytes";

// TODO [ToDr] GP references.

/** Signature verification input. */
export type Input<T extends BytesBlob> = {
  /** Signature. */
  signature: Ed25519Signature;
  /** Public key. */
  key: Ed25519Key;
  /** Message to verify. */
  message: T;
};

/**
 * Verify the entire batch of `ed25519` signatures and return the results.
 */
export function verify<T extends BytesBlob>(input: Input<T>[]): Promise<boolean[]> {
  return Promise.resolve(
    input.map(({ signature, message, key }) => {
      const isValid = ed25519.verify(signature.raw, message.raw, key.raw);
      return isValid;
    }),
  );
}

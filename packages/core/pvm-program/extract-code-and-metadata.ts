import { Decoder } from "@typeberry/codec";

/**
 * A function that splits preimage into metadata and code.
 *
 * https://graypaper.fluffylabs.dev/#/cc517d7/109a01109a01?v=0.6.5
 */
export function extractCodeAndMetadata(blobWithMetadata: Uint8Array) {
  const decoder = Decoder.fromBlob(blobWithMetadata);
  const metadata = decoder.bytesBlob().raw;
  const code = blobWithMetadata.subarray(decoder.bytesRead());
  return { metadata, code };
}

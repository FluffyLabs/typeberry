import { ed25519 } from "@noble/curves/ed25519";
import type { Ed25519Key, Ed25519Signature, WorkReportHash } from "@typeberry/block";
import { Bytes } from "@typeberry/bytes";
import { Encoder } from "@typeberry/codec";
import { JAM_INVALID, JAM_VALID } from "@typeberry/signing-context";

export function verifySignature(
  signature: Ed25519Signature,
  pubKey: Ed25519Key,
  workReportHash: WorkReportHash,
  isWorkReportValid: boolean,
) {
  const encoder = Encoder.create();
  const v = isWorkReportValid ? JAM_VALID : JAM_INVALID;
  encoder.bytes(Bytes.fromBlob(v, v.length));
  encoder.bytes(workReportHash);
  const message = encoder.viewResult();
  return ed25519.verify(signature.raw, message.buffer, pubKey.buffer);
}

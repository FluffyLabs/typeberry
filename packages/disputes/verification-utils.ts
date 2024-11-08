import { ed25519 } from "@noble/curves/ed25519";
import type { Ed25519Key, Ed25519Signature, WorkReportHash } from "@typeberry/block";
import { Bytes } from "@typeberry/bytes";
import { Encoder } from "@typeberry/codec";

export function verifySignature(
  signature: Ed25519Signature,
  pubKey: Ed25519Key,
  workReportHash: WorkReportHash,
  vote: boolean,
) {
  const encoder = Encoder.create();
  const textEncoder = new TextEncoder();
  const v = textEncoder.encode(vote ? "jam_valid" : "jam_invalid"); // TODO extract to signing context package
  encoder.bytes(Bytes.fromBlob(v, v.length));
  encoder.bytes(workReportHash);
  const message = encoder.viewResult();
  return ed25519.verify(signature.raw, message.buffer, pubKey.buffer);
}

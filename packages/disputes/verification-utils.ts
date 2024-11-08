import { ed25519 } from "@noble/curves/ed25519";
import type { Ed25519Key, Ed25519Signature, WorkReportHash } from "@typeberry/block";
import { Bytes } from "@typeberry/bytes";
import { Encoder } from "@typeberry/codec";
import {
  JAM_GUARANTEE,
  JAM_INVALID,
  JAM_VALID,
  type JamGuarantee,
  type JamInvalid,
  type JamValid,
} from "@typeberry/signing-context";

function verifySignature(
  signature: Ed25519Signature,
  pubKey: Ed25519Key,
  workReportHash: WorkReportHash,
  signingContext: JamValid | JamInvalid | JamGuarantee,
) {
  const encoder = Encoder.create();
  encoder.bytes(Bytes.fromBlob(signingContext, signingContext.length));
  encoder.bytes(workReportHash);
  const message = encoder.viewResult();
  return ed25519.verify(signature.raw, message.buffer, pubKey.buffer);
}

export function verifyVoteSignature(
  signature: Ed25519Signature,
  pubKey: Ed25519Key,
  workReportHash: WorkReportHash,
  isWorkReportValid: boolean,
) {
  const signingContext = isWorkReportValid ? JAM_VALID : JAM_INVALID;
  return verifySignature(signature, pubKey, workReportHash, signingContext);
}

export function verifyCulpritSignature(
  signature: Ed25519Signature,
  pubKey: Ed25519Key,
  workReportHash: WorkReportHash,
) {
  return verifySignature(signature, pubKey, workReportHash, JAM_GUARANTEE);
}

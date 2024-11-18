import { ed25519 } from "@noble/curves/ed25519";
import type { Ed25519Key, Ed25519Signature, WorkReportHash } from "@typeberry/block";
import type { Culprit, Fault, Judgement } from "@typeberry/block/disputes";
import { Bytes } from "@typeberry/bytes";
import { Encoder } from "@typeberry/codec";
import { JAM_GUARANTEE, JAM_INVALID, JAM_VALID } from "@typeberry/signing-context";

type InputItem = {
  signature: Uint8Array;
  key: Uint8Array;
  message: Uint8Array;
};

export type VerificationInput = InputItem[][];
type VerificationResultItem = { signature: Ed25519Signature; isValid: boolean };
export type VerificationOutput = VerificationResultItem[][];

export function prepareCulpritSignature({ key, signature, workReportHash }: Culprit): InputItem {
  const encoder = Encoder.create();
  encoder.bytes(Bytes.fromBlob(JAM_GUARANTEE, JAM_GUARANTEE.length));
  encoder.bytes(workReportHash);
  const message = encoder.viewResult().raw;
  return {
    key: key.raw,
    signature: signature.raw,
    message,
  };
}

export function prepareFaultSignature({ workReportHash, wasConsideredValid, signature, key }: Fault): InputItem {
  const encoder = Encoder.create();
  const signingContext = wasConsideredValid ? JAM_VALID : JAM_INVALID;
  encoder.bytes(Bytes.fromBlob(signingContext, signingContext.length));
  encoder.bytes(workReportHash);
  const message = encoder.viewResult().raw;
  return {
    key: key.raw,
    signature: signature.raw,
    message,
  };
}

export function prepareJudgementSignature(j: Judgement, workReportHash: WorkReportHash, key: Ed25519Key): InputItem {
  const { isWorkReportValid, signature } = j;
  const signingContext = isWorkReportValid ? JAM_VALID : JAM_INVALID;
  const encoder = Encoder.create();
  encoder.bytes(Bytes.fromBlob(signingContext, signingContext.length));
  encoder.bytes(workReportHash);
  const message = encoder.viewResult().raw;
  return {
    key: key.raw,
    signature: signature.raw,
    message,
  };
}

const SIGNATURE_LENGTH = 64;

// Verification is heavy and currently it is a bottleneck so in the future it will be outsourced to Rust.
// This is why the data structure is complicated but it should allow to pass whole data to Rust at once.
export function vefifyAllSignatures(input: VerificationInput): Promise<VerificationOutput> {
  const output: VerificationOutput = [];

  for (const signatureGroup of input) {
    const verificationGroup: VerificationResultItem[] = [];
    for (const { key, message, signature } of signatureGroup) {
      const isValid = ed25519.verify(signature, message, key);
      verificationGroup.push({
        signature: Bytes.fromBlob(signature, SIGNATURE_LENGTH) as Ed25519Signature,
        isValid,
      });
    }
    output.push(verificationGroup);
  }

  return Promise.resolve(output);
}

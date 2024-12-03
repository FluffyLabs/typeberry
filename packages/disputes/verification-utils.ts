import { ed25519 } from "@noble/curves/ed25519";
import { ED25519_SIGNATURE_BYTES, type Ed25519Key, type Ed25519Signature, type WorkReportHash } from "@typeberry/block";
import type { Culprit, Fault, Judgement } from "@typeberry/block/disputes";
import { Bytes, BytesBlob } from "@typeberry/bytes";
import { asOpaqueType } from "@typeberry/utils";

type InputItem = {
  signature: Uint8Array;
  key: Uint8Array;
  message: Uint8Array;
};

export type VerificationInput = {
  judgements: InputItem[];
  culprits: InputItem[];
  faults: InputItem[];
};
type VerificationResultItem = { signature: Ed25519Signature; isValid: boolean };
export type VerificationOutput = {
  judgements: VerificationResultItem[];
  culprits: VerificationResultItem[];
  faults: VerificationResultItem[];
};

export const JAM_VALID = BytesBlob.blobFromString("jam_valid").raw;
export const JAM_INVALID = BytesBlob.blobFromString("jam_invalid").raw;
export const JAM_GUARANTEE = BytesBlob.blobFromString("jam_guarantee").raw;

export function prepareCulpritSignature({ key, signature, workReportHash }: Culprit): InputItem {
  const message = BytesBlob.blobFromParts(JAM_GUARANTEE, workReportHash.raw).raw;

  return {
    key: key.raw,
    signature: signature.raw,
    message,
  };
}

export function prepareFaultSignature({ workReportHash, wasConsideredValid, signature, key }: Fault): InputItem {
  const signingContext = wasConsideredValid ? JAM_VALID : JAM_INVALID;
  const message = BytesBlob.blobFromParts(signingContext, workReportHash.raw).raw;
  return {
    key: key.raw,
    signature: signature.raw,
    message,
  };
}

export function prepareJudgementSignature(j: Judgement, workReportHash: WorkReportHash, key: Ed25519Key): InputItem {
  const { isWorkReportValid, signature } = j;
  const signingContext = isWorkReportValid ? JAM_VALID : JAM_INVALID;
  const message = BytesBlob.blobFromParts(signingContext, workReportHash.raw).raw;
  return {
    key: key.raw,
    signature: signature.raw,
    message,
  };
}

// Verification is heavy and currently it is a bottleneck so in the future it will be outsourced to Rust.
// This is why the data structure is complicated but it should allow to pass whole data to Rust at once.
export function vefifyAllSignatures(input: VerificationInput): Promise<VerificationOutput> {
  const output: VerificationOutput = { culprits: [], faults: [], judgements: [] };
  const inputEntries = Object.entries(input) as [keyof VerificationInput, InputItem[]][];
  for (const [key, signatureGroup] of inputEntries) {
    const verificationGroup: VerificationResultItem[] = [];
    for (const { key, message, signature } of signatureGroup) {
      const isValid = ed25519.verify(signature, message, key);
      verificationGroup.push({
        signature: asOpaqueType(Bytes.fromBlob(signature, ED25519_SIGNATURE_BYTES)),
        isValid,
      });
    }
    output[key] = verificationGroup;
  }

  return Promise.resolve(output);
}

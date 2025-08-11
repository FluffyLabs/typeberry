import { CryptoError } from "@matrixai/quic/native/types.js";
import { type PeerInfo, VerifyCertError, verifyCertificate } from "./certificate.js";

export function peerVerification() {
  const peer: {
    info: PeerInfo | null;
    /** Takes all certicates the peer presented and all local certifcates from Certificate Authorities (unused) */
    verifyCallback: (certs: Uint8Array[], cas: Uint8Array[]) => Promise<ReturnType<typeof asCryptoError> | undefined>;
  } = {
    info: null,
    verifyCallback: async (certs: Uint8Array[], _cas: Uint8Array[]) => {
      const verification = await verifyCertificate(certs);
      if (verification.isError) {
        return asCryptoError(verification.error);
      }
      peer.info = verification.ok;
      return undefined;
    },
  };
  return peer;
}

function asCryptoError(error: VerifyCertError | undefined) {
  if (error === undefined) {
    return error;
  }
  switch (error) {
    case VerifyCertError.AltNameMismatch:
      return CryptoError.IllegalParameter;
    case VerifyCertError.NotEd25519:
      return CryptoError.InsufficientSecurity;
    case VerifyCertError.PublicKeyTypeMismatch:
      return CryptoError.BadCertificate;
    case VerifyCertError.NoCertificate:
      return CryptoError.CertificateRequired;
    case VerifyCertError.IncorrectSignature:
      return CryptoError.BadCertificate;
    default:
      throw new Error(`Unexpected VerifyCertError: ${error}`);
  }
}

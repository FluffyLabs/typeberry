import crypto, { type JsonWebKey } from "node:crypto";
import { ED25519_KEY_BYTES, type Ed25519Key, type ed25519 } from "@typeberry/crypto";
import { Result } from "@typeberry/utils";
import base32 from "hi-base32";

import * as peculiarWebcrypto from "@peculiar/webcrypto";
import * as x509 from "@peculiar/x509";
import { Bytes, type BytesBlob } from "@typeberry/bytes";
import { Logger } from "@typeberry/logger";

const logger = Logger.new(__filename, "networking");

// TODO [ToDr] Might not be relevant any more and we can use built-in webcrypto.
// overwrite crypto provider to use the @peculiar version
// (ed25519 issues in the node one, see:
// https://github.com/MatrixAI/js-quic/blob/staging/tests/utils.ts#L16C9-L16C64
// )
const webcrypto = new peculiarWebcrypto.Crypto();
x509.cryptoProvider.set(webcrypto);

const CURVE_NAME = "Ed25519";
const KEY_TYPE = "OKP"; // Offline Key Pair

export enum VerifyCertError {
  NoCertificate = 0,
  NotEd25519 = 1,
  PublicKeyTypeMismatch = 2,
  AltNameMismatch = 3,
  IncorrectSignature = 4,
}

export type PeerInfo = {
  id: string;
  key: Ed25519Key;
};

export async function verifyCertificate(certs: Uint8Array[]): Promise<Result<PeerInfo, VerifyCertError>> {
  logger.info("Verifying peer certificate");
  // Must present exactly one cert
  if (!certs.length) {
    logger.log("Rejecting peer with no certificates.");
    return Result.error(VerifyCertError.NoCertificate);
  }

  // Convert first cert DER?PEM
  const der = Buffer.from(certs[0]);
  const b64 = der
    .toString("base64")
    .match(/.{1,64}/g)
    ?.join("\n");
  const pem = `-----BEGIN CERTIFICATE-----\n${b64}\n-----END CERTIFICATE-----`;

  // Parse with Node's X509Certificate (accepts PEM or DER)
  const xc = new crypto.X509Certificate(pem);

  // Must be Ed25519 key
  if (xc.publicKey.asymmetricKeyType !== CURVE_NAME.toLowerCase()) {
    logger.log(`Rejecting peer using non-ed25519 certificate: ${xc.publicKey.asymmetricKeyType}`);
    return Result.error(VerifyCertError.NotEd25519);
  }

  // Extract raw public key via JWK export
  const jwk = xc.publicKey.export({ format: "jwk" });
  if (jwk.kty !== KEY_TYPE || jwk.crv !== CURVE_NAME) {
    logger.log(`Public key type mismatch: ${jwk.kty}, ${jwk.crv}`);
    return Result.error(VerifyCertError.PublicKeyTypeMismatch);
  }

  // SAN must be exactly 'e'+base32(rawPub)
  const expectedSan = altName(jwk);
  const sanField = xc.subjectAltName ?? "";
  const m = sanField.match(/DNS:([^,]+)/);
  if (m === null || m[1] !== expectedSan) {
    logger.log(`AltName mismatch. Expected: '${expectedSan}', got: '${m?.[1]}'`);
    return Result.error(VerifyCertError.AltNameMismatch);
  }

  const key = Buffer.from(jwk.x ?? "", "base64url");

  if (!xc.verify(xc.publicKey)) {
    return Result.error(VerifyCertError.IncorrectSignature);
  }

  const publicKey = Bytes.fromBlob(new Uint8Array(key), ED25519_KEY_BYTES);
  return Result.ok({
    id: expectedSan,
    key: publicKey.asOpaque(),
  });
}

export async function generateKeyPairEd25519(): Promise<{
  publicKey: JsonWebKey;
  privateKey: JsonWebKey;
}> {
  const keyPair = (await webcrypto.subtle.generateKey(
    {
      name: "EdDSA",
      namedCurve: "Ed25519",
    },
    true,
    ["sign", "verify"],
  )) as JsonWebKeyPair;

  return {
    publicKey: await webcrypto.subtle.exportKey("jwk", keyPair.publicKey),
    privateKey: await webcrypto.subtle.exportKey("jwk", keyPair.privateKey),
  };
}

/** Adapted from https://github.com/MatrixAI/js-quic/blob/staging/tests/utils.ts#L388 */
export async function generateCertificate({
  certId,
  subjectKeyPair,
  issuerKeyPair,
  subjectAttrsExtra = [],
  issuerAttrsExtra = [],
  now = new Date(),
}: {
  certId: BytesBlob;
  subjectKeyPair: JsonWebKeyPair;
  issuerKeyPair: JsonWebKeyPair;
  subjectAttrsExtra?: Array<{ [key: string]: string[] }>;
  issuerAttrsExtra?: Array<{ [key: string]: string[] }>;
  now?: Date;
}): Promise<x509.X509Certificate> {
  const subjectPublicCryptoKey = await importEd25519Key(subjectKeyPair.publicKey, KeyType.Public);
  const subjectPrivateCryptoKey = await importEd25519Key(subjectKeyPair.privateKey, KeyType.Private);
  const issuerPrivateCryptoKey = await importEd25519Key(issuerKeyPair.privateKey, KeyType.Private);
  const issuerPublicCryptoKey = await importEd25519Key(issuerKeyPair.publicKey, KeyType.Public);

  // X509 `UTCTime` format only has resolution of seconds
  // this truncates to second resolution
  const notBeforeDate = new Date(now.getTime() - (now.getTime() % 1000));
  const durationSeconds = 2;
  const notAfterDate = new Date(now.getTime() - (now.getTime() % 1000) + durationSeconds * 1000);

  const subjectNodeId = await webcrypto.subtle.digest(
    "SHA-256",
    await webcrypto.subtle.exportKey("spki", subjectPublicCryptoKey),
  );
  const issuerNodeId = await webcrypto.subtle.digest(
    "SHA-256",
    await webcrypto.subtle.exportKey("spki", issuerPublicCryptoKey),
  );
  const serialNumber = certId.toString().substring(2);
  const subjectNodeIdEncoded = Buffer.from(subjectNodeId).toString("hex");
  const issuerNodeIdEncoded = Buffer.from(issuerNodeId).toString("hex");
  // The entire subject attributes and issuer attributes
  // is constructed via `x509.Name` class
  // By default this supports on a limited set of names:
  // CN, L, ST, O, OU, C, DC, E, G, I, SN, T
  // If custom names are desired, this needs to change to constructing
  // `new x509.Name('FOO=BAR', { FOO: '1.2.3.4' })` manually
  // And each custom attribute requires a registered OID
  // Because the OID is what is encoded into ASN.1
  const subjectAttrs = [
    {
      CN: [subjectNodeIdEncoded],
    },
    // Filter out conflicting CN attributes
    ...subjectAttrsExtra.filter((attr) => !("CN" in attr)),
  ];
  const issuerAttrs = [
    {
      CN: [issuerNodeIdEncoded],
    },
    // Filter out conflicting CN attributes
    ...issuerAttrsExtra.filter((attr) => !("CN" in attr)),
  ];
  const certConfig = {
    serialNumber,
    notBefore: notBeforeDate,
    notAfter: notAfterDate,
    subject: subjectAttrs,
    issuer: issuerAttrs,
    signingAlgorithm: issuerPrivateCryptoKey.algorithm,
    publicKey: subjectPublicCryptoKey,
    signingKey: subjectPrivateCryptoKey,
    extensions: [
      new x509.BasicConstraintsExtension(true),
      new x509.KeyUsagesExtension(
        x509.KeyUsageFlags.keyCertSign |
          x509.KeyUsageFlags.cRLSign |
          x509.KeyUsageFlags.digitalSignature |
          x509.KeyUsageFlags.nonRepudiation |
          x509.KeyUsageFlags.keyAgreement |
          x509.KeyUsageFlags.keyEncipherment |
          x509.KeyUsageFlags.dataEncipherment,
      ),
      new x509.ExtendedKeyUsageExtension([]),
      new x509.SubjectAlternativeNameExtension([
        {
          type: "dns",
          value: altName(issuerKeyPair.publicKey),
        },
      ]),
      await x509.SubjectKeyIdentifierExtension.create(subjectPublicCryptoKey),
    ],
  };
  certConfig.signingKey = issuerPrivateCryptoKey;
  return await x509.X509CertificateGenerator.create(certConfig);
}

function altName(ed25519PubKey: JsonWebKey) {
  const rawPub = new Uint8Array(Buffer.from(ed25519PubKey.x ?? "", "base64url"));
  // we remove padding since it's not in the specified alphabet
  // https://github.com/zdave-parity/jam-np/blob/main/simple.md#encryption-and-handshake
  return `e${base32.encode(rawPub).toLowerCase().replace(/=/g, "")}`;
}

enum KeyType {
  /** Used only to verify signatures. */
  Public = 0,
  /** Used only to sign. */
  Private = 1,
}

async function importEd25519Key(key: JsonWebKey, typ: KeyType) {
  if (key.kty !== KEY_TYPE) {
    throw new Error(`Unsupported key type ${key.kty}`);
  }

  const algorithm = {
    name: "EdDSA",
    namedCurve: CURVE_NAME,
  };
  /** https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/importKey */
  return await webcrypto.subtle.importKey(
    "jwk",
    key,
    algorithm,
    true /* Can the key be extracted using `exportKey`? */,
    [typ === KeyType.Public ? "verify" : "sign"],
  );
}

export function certToPEM(cert: x509.X509Certificate) {
  return `${cert.toString("pem")}\n`;
}

export type JsonWebKeyPair = {
  publicKey: JsonWebKey;
  privateKey: JsonWebKey;
};

export function ed25519AsJsonWebKeyPair(keyPair: ed25519.Ed25519Pair): JsonWebKeyPair {
  const key = {
    kty: KEY_TYPE,
    crv: CURVE_NAME,
    x: Buffer.from(keyPair.pubKey.raw).toString("base64url"),
    d: Buffer.from(keyPair.privKey.raw).toString("base64url"),
  };

  return {
    publicKey: {
      ...key,
      d: undefined,
    },
    privateKey: {
      ...key,
      x: undefined,
    },
  };
}

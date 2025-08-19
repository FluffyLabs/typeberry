import { type ServiceGas, tryAsServiceGas } from "@typeberry/block";
import type { AuthorizerHash, ExportsRootHash, WorkPackageHash } from "@typeberry/block/work-report.js";
import { WorkExecResult } from "@typeberry/block/work-result.js";
import { BytesBlob } from "@typeberry/bytes";
import { type CodecRecord, codec } from "@typeberry/codec";
import { HASH_SIZE, type OpaqueHash } from "@typeberry/hash";
import { WithDebug } from "@typeberry/utils";

/**
 * The set of wrangled operand tuples, used as an operand to the PVM Accumulation function.
 *
 * https://graypaper.fluffylabs.dev/#/7e6ff6a/173d03173d03?v=0.6.7
 */
export class Operand extends WithDebug {
  static Codec = codec.Class(Operand, {
    hash: codec.bytes(HASH_SIZE).asOpaque<WorkPackageHash>(),
    exportsRoot: codec.bytes(HASH_SIZE).asOpaque<ExportsRootHash>(),
    authorizerHash: codec.bytes(HASH_SIZE).asOpaque<AuthorizerHash>(),
    payloadHash: codec.bytes(HASH_SIZE),
    gas: codec.varU64.asOpaque<ServiceGas>(),
    result: WorkExecResult.Codec,
    authorizationOutput: codec.blob,
  });

  /**
   * https://graypaper.fluffylabs.dev/#/7e6ff6a/181801189d01?v=0.6.7
   */
  hash: WorkPackageHash; // h
  exportsRoot: ExportsRootHash; // e
  authorizerHash: AuthorizerHash; // a
  authorizationOutput: BytesBlob; // o
  payloadHash: OpaqueHash; // y
  gas: ServiceGas; // g
  result: WorkExecResult; // d

  static create({
    authorizationOutput,
    authorizerHash,
    exportsRoot,
    gas,
    hash,
    payloadHash,
    result,
  }: CodecRecord<Operand>) {
    return new Operand({
      gas: tryAsServiceGas(gas),
      payloadHash: payloadHash.asOpaque(),
      result: result,
      authorizationOutput: BytesBlob.blobFrom(authorizationOutput.raw),
      exportsRoot: exportsRoot.asOpaque(),
      hash: hash.asOpaque(),
      authorizerHash: authorizerHash.asOpaque(),
    });
  }
  private constructor(operand: CodecRecord<Operand>) {
    super();
    this.gas = operand.gas;
    this.payloadHash = operand.payloadHash;
    this.result = operand.result;
    this.authorizationOutput = operand.authorizationOutput;
    this.exportsRoot = operand.exportsRoot;
    this.hash = operand.hash;
    this.authorizerHash = operand.authorizerHash;
  }

  static new(operand: Pick<Operand, keyof Operand>) {
    return new Operand(operand);
  }
}

export class Operand_0_6_4 {
  static Codec = codec.Class(Operand_0_6_4, {
    hash: codec.bytes(HASH_SIZE).asOpaque<WorkPackageHash>(),
    exportsRoot: codec.bytes(HASH_SIZE).asOpaque<ExportsRootHash>(),
    authorizerHash: codec.bytes(HASH_SIZE).asOpaque<AuthorizerHash>(),
    authorizationOutput: codec.blob,
    payloadHash: codec.bytes(HASH_SIZE),
    result: WorkExecResult.Codec,
  });

  /**
   * https://graypaper.fluffylabs.dev/#/68eaa1f/17d302175803?v=0.6.4
   */
  hash: WorkPackageHash; // h
  exportsRoot: ExportsRootHash; // e
  authorizerHash: AuthorizerHash; // a
  authorizationOutput: BytesBlob; // o
  payloadHash: OpaqueHash; // y
  result: WorkExecResult; // d

  static create({
    authorizationOutput,
    authorizerHash,
    exportsRoot,
    hash,
    payloadHash,
    result,
  }: CodecRecord<Operand_0_6_4>) {
    return new Operand_0_6_4({
      payloadHash,
      result: result,
      authorizationOutput,
      exportsRoot,
      hash,
      authorizerHash,
    });
  }

  private constructor(operand: CodecRecord<Operand_0_6_4>) {
    this.payloadHash = operand.payloadHash;
    this.result = operand.result;
    this.authorizationOutput = operand.authorizationOutput;
    this.exportsRoot = operand.exportsRoot;
    this.hash = operand.hash;
    this.authorizerHash = operand.authorizerHash;
  }

  static new(operand: Pick<Operand_0_6_4, keyof Operand_0_6_4>) {
    return new Operand_0_6_4(operand);
  }
}

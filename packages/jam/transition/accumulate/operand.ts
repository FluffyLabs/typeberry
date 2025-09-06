import { type ServiceGas, tryAsServiceGas } from "@typeberry/block";
import type { AuthorizerHash, ExportsRootHash, WorkPackageHash } from "@typeberry/block/work-report.js";
import { WorkExecResult } from "@typeberry/block/work-result.js";
import { BytesBlob } from "@typeberry/bytes";
import { type CodecRecord, codec } from "@typeberry/codec";
import { HASH_SIZE, type OpaqueHash } from "@typeberry/hash";
import { Compatibility, TestSuite, WithDebug } from "@typeberry/utils";

/**
 * The set of wrangled operand tuples, used as an operand to the PVM Accumulation function.
 *
 * https://graypaper.fluffylabs.dev/#/7e6ff6a/173d03173d03?v=0.6.7
 */
export class Operand extends WithDebug {
  // JamDuna 0.6.5 uses a different order of operands.
  static Codec = codec.Class(
    Operand,
    Compatibility.isSuite(TestSuite.JAMDUNA)
      ? {
          hash: codec.bytes(HASH_SIZE).asOpaque<WorkPackageHash>(),
          exportsRoot: codec.bytes(HASH_SIZE).asOpaque<ExportsRootHash>(),
          authorizerHash: codec.bytes(HASH_SIZE).asOpaque<AuthorizerHash>(),
          authorizationOutput: codec.blob,
          payloadHash: codec.bytes(HASH_SIZE),
          gas: codec.varU64.asOpaque<ServiceGas>(),
          result: WorkExecResult.Codec,
        }
      : {
          // h
          hash: codec.bytes(HASH_SIZE).asOpaque<WorkPackageHash>(),
          // e
          exportsRoot: codec.bytes(HASH_SIZE).asOpaque<ExportsRootHash>(),
          // a
          authorizerHash: codec.bytes(HASH_SIZE).asOpaque<AuthorizerHash>(),
          // y
          payloadHash: codec.bytes(HASH_SIZE),
          // g
          gas: codec.varU64.asOpaque<ServiceGas>(),
          // d
          result: WorkExecResult.Codec,
          // o
          authorizationOutput: codec.blob,
        },
  );

  /**
   * https://graypaper.fluffylabs.dev/#/7e6ff6a/181801189d01?v=0.6.7
   */
  hash: WorkPackageHash;
  exportsRoot: ExportsRootHash;
  authorizerHash: AuthorizerHash;
  payloadHash: OpaqueHash;
  gas: ServiceGas;
  result: WorkExecResult;
  authorizationOutput: BytesBlob;

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

import { type ServiceGas, tryAsServiceGas } from "@typeberry/block";
import type { AuthorizerHash, ExportsRootHash, WorkPackageHash } from "@typeberry/block/work-report";
import { WorkExecResult } from "@typeberry/block/work-result";
import { BytesBlob } from "@typeberry/bytes";
import { type CodecRecord, codec } from "@typeberry/codec";
import { HASH_SIZE, type OpaqueHash } from "@typeberry/hash";

/**
 * The set of wrangled operand tuples, used as an operand to the PVM Accumulation function.
 *
 * https://graypaper.fluffylabs.dev/#/7e6ff6a/173d03173d03?v=0.6.7
 */
export class Operand {
  static Codec = codec.Class(Operand, {
    gas: codec.u64.asOpaque<ServiceGas>(),
    payloadHash: codec.bytes(HASH_SIZE),
    result: WorkExecResult.Codec,
    authorizationOutput: codec.blob,
    exportsRoot: codec.bytes(HASH_SIZE).asOpaque<ExportsRootHash>(),
    hash: codec.bytes(HASH_SIZE).asOpaque<WorkPackageHash>(),
    authorizerHash: codec.bytes(HASH_SIZE).asOpaque<AuthorizerHash>(),
  });

  /**
   * https://graypaper.fluffylabs.dev/#/7e6ff6a/181801189d01?v=0.6.7
   */
  gas: ServiceGas; // g
  payloadHash: OpaqueHash; // y
  result: WorkExecResult; // d
  authorizationOutput: BytesBlob; // o
  exportsRoot: ExportsRootHash; // e
  hash: WorkPackageHash; // h
  authorizerHash: AuthorizerHash; // a

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
  private constructor(operand: Pick<Operand, keyof Operand>) {
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

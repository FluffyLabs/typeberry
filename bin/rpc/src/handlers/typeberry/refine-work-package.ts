import { tryAsCoreIndex } from "@typeberry/block";
import type { WorkItemExtrinsic } from "@typeberry/block/work-item.js";
import { WorkPackage } from "@typeberry/block/work-package.js";
import { WorkReport } from "@typeberry/block/work-report.js";
import { BytesBlob } from "@typeberry/bytes";
import { Decoder, Encoder } from "@typeberry/codec";
import { asKnownSize } from "@typeberry/collections";
import { WithHash } from "@typeberry/hash";
import { type ImportedSegment, Refine } from "@typeberry/in-core";
import { Logger } from "@typeberry/logger";
import { type Handler, RpcError, RpcErrorCode } from "@typeberry/rpc-validation";

const logger = Logger.new(import.meta.filename, "submitWorkPackage");

/**
 * Simulate package refinemenet.
 *
 * https://github.com/polkadot-fellows/JIPs/blob/772ce90bfc33f4e1de9de3bbe10c561753cc0d41/JIP-2.md#submitworkpackagecore-package-extrinsics
 */
export const refineWorkPackage: Handler<"typeberry_refineWorkPackage"> = async (
  [coreIndexRaw, workPackageBytes, extrinsicsRaw],
  { db, chainSpec, pvmBackend, blake2b },
) => {
  const coreIndex = tryAsCoreIndex(coreIndexRaw);

  // Decode the work package
  const workPackageBlob = BytesBlob.blobFrom(workPackageBytes);
  const workPackage = Decoder.decodeObject(WorkPackage.Codec, workPackageBlob, chainSpec);

  // Hash the work package
  const workPackageHash = blake2b.hashBytes(workPackageBlob).asOpaque();
  const workPackageAndHash = new WithHash(workPackageHash, workPackage);

  logger.info`Submitting work package ${workPackageHash} to core ${coreIndex} with ${workPackage.items.length} items`;

  // Convert extrinsics to the expected format (per work item)
  // For now, we assume the extrinsics are provided in a flat array and need to be
  // distributed to work items according to their extrinsic specs
  const extrinsics = distributeExtrinsics(workPackage, extrinsicsRaw);

  // For now, we don't have any imports - this would need to be fetched from DA layer
  // TODO [RPC] Fetch imported segments from DA layer based on work items' importSegments
  const emptyImports: ImportedSegment[] = workPackage.items.map(() => ({
    index: 0 as never, // Empty import for now
    data: BytesBlob.empty() as never,
  }));
  const imports = asKnownSize(emptyImports);

  // Create refine instance and process the work package
  const refine = new Refine(chainSpec, db.states, pvmBackend, blake2b);
  const result = await refine.refine(workPackageAndHash, coreIndex, imports, extrinsics);

  if (result.isError) {
    throw new RpcError(RpcErrorCode.Other, `Refine error: ${result.details()}`);
  }

  logger.info`Work package ${workPackageHash} refined successfully on core ${coreIndex}`;

  // encode report as response
  const report = Encoder.encodeObject(WorkReport.Codec, result.ok.report, chainSpec);
  // And concatenated all exports
  const exports = BytesBlob.blobFromParts(result.ok.exports.flat().map((segment) => segment.raw));

  return {
    report: report.raw,
    exports: exports.raw,
  };
};

/**
 * Distribute the flat array of extrinsics to work items based on their extrinsic specs.
 */
function distributeExtrinsics(
  workPackage: WorkPackage,
  extrinsicsRaw: Uint8Array[],
): ReturnType<typeof asKnownSize<WorkItemExtrinsic[], "for each work item">> {
  const result: WorkItemExtrinsic[][] = [];
  let extrinsicIndex = 0;

  for (const item of workPackage.items) {
    const itemExtrinsics: WorkItemExtrinsic[] = [];
    for (let i = 0; i < item.extrinsic.length; i++) {
      if (extrinsicIndex >= extrinsicsRaw.length) {
        throw new RpcError(
          RpcErrorCode.Other,
          `Not enough extrinsics provided. Expected at least ${extrinsicIndex + 1}, got ${extrinsicsRaw.length}`,
        );
      }
      itemExtrinsics.push(BytesBlob.blobFrom(extrinsicsRaw[extrinsicIndex]) as WorkItemExtrinsic);
      extrinsicIndex++;
    }
    result.push(itemExtrinsics);
  }

  return asKnownSize(result);
}

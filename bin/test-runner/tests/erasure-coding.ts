import { BytesBlob } from "@typeberry/bytes";
import { Logger } from "@typeberry/logger";
import type { FromJson } from "../json-parser";

export class EcTest {
  static fromJson: FromJson<EcTest> = {
    data: ["string", BytesBlob.parseBlobNoPrefix],
    chunks: ["array", ["string", BytesBlob.parseBlobNoPrefix]],
  };

  data!: BytesBlob;
  chunks!: BytesBlob[];
}

export class PageProof {
  static fromJson: FromJson<PageProof> = {
    data: ["string", BytesBlob.parseBlobNoPrefix],
    page_proofs: ["array", ["string", BytesBlob.parseBlobNoPrefix]],
    segments_root: ["string", BytesBlob.parseBlobNoPrefix],
  };

  data!: BytesBlob;
  page_proofs!: BytesBlob[];
  segments_root!: BytesBlob;
}

export class SegmentEc {
  static fromJson: FromJson<SegmentEc> = {
    segment_ec: ["array", ["string", BytesBlob.parseBlobNoPrefix]],
  };

  segment_ec!: BytesBlob[];
}

export class SegmentEcTest {
  static fromJson: FromJson<SegmentEcTest> = {
    data: ["string", BytesBlob.parseBlobNoPrefix],
    segments: ["array", SegmentEc.fromJson],
    segments_root: ["string", BytesBlob.parseBlobNoPrefix],
  };

  data!: BytesBlob;
  segments!: SegmentEc[];
  segments_root!: BytesBlob;
}

export class SegmentRoot {
  static fromJson: FromJson<SegmentRoot> = {
    data: ["string", BytesBlob.parseBlobNoPrefix],
    chunks: ["array", ["string", BytesBlob.parseBlobNoPrefix]],
    chunks_root: ["string", BytesBlob.parseBlobNoPrefix],
  };

  data!: BytesBlob;
  chunks!: BytesBlob[];
  chunks_root!: BytesBlob;
}

const logger = Logger.new(global.__filename, "test-runner/erasure-coding");

export async function runEcTest(test: EcTest) {
  logger.trace(JSON.stringify(test, null, 2));
  logger.error("Not implemented yet!");
}

export async function runPageProofTest(test: PageProof) {
  logger.trace(JSON.stringify(test, null, 2));
  logger.error("Not implemented yet!");
}

export async function runSegmentEcTest(test: SegmentEcTest) {
  logger.trace(JSON.stringify(test, null, 2));
  logger.error("Not implemented yet!");
}

export async function runSegmentRootTest(test: SegmentRoot) {
  logger.trace(JSON.stringify(test, null, 2));
  logger.error("Not implemented yet!");
}

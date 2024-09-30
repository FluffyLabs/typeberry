import { BytesBlob } from "@typeberry/bytes";
import { Logger } from "@typeberry/logger";
import { ARRAY, FROM_STRING, type FromJson } from "../json-parser";

const BYTES = FROM_STRING(BytesBlob.parseBlobNoPrefix);

export class EcTest {
  static fromJson: FromJson<EcTest> = {
    data: BYTES,
    chunks: ARRAY(BYTES),
  };

  data!: BytesBlob;
  chunks!: BytesBlob[];
}

export class PageProof {
  static fromJson: FromJson<PageProof> = {
    data: BYTES,
    page_proofs: ARRAY(BYTES),
    segments_root: BYTES,
  };

  data!: BytesBlob;
  page_proofs!: BytesBlob[];
  segments_root!: BytesBlob;
}

export class SegmentEc {
  static fromJson: FromJson<SegmentEc> = {
    segment_ec: ARRAY(BYTES),
  };

  segment_ec!: BytesBlob[];
}

export class SegmentEcTest {
  static fromJson: FromJson<SegmentEcTest> = {
    data: BYTES,
    segments: ARRAY(SegmentEc.fromJson),
    segments_root: BYTES,
  };

  data!: BytesBlob;
  segments!: SegmentEc[];
  segments_root!: BytesBlob;
}

export class SegmentRoot {
  static fromJson: FromJson<SegmentRoot> = {
    data: BYTES,
    chunks: ARRAY(BYTES),
    chunks_root: BYTES,
  };

  data!: BytesBlob;
  chunks!: BytesBlob[];
  chunks_root!: BytesBlob;
}

const logger = Logger.new(__filename, "test-runner/erasure-coding");

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

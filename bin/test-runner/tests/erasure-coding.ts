import { BytesBlob } from "@typeberry/bytes";
import { Logger } from "@typeberry/logger";
import { ARRAY, type FromJson, OBJECT, STRING } from "../json-parser";

export class EcTest {
  static fromJson: FromJson<EcTest> = OBJECT({
    data: STRING(BytesBlob.parseBlobNoPrefix),
    chunks: ARRAY(STRING(BytesBlob.parseBlobNoPrefix)),
  });

  data!: BytesBlob;
  chunks!: BytesBlob[];
}

export class PageProof {
  static fromJson: FromJson<PageProof> = OBJECT({
    data: STRING(BytesBlob.parseBlobNoPrefix),
    page_proofs: ARRAY(STRING(BytesBlob.parseBlobNoPrefix)),
    segments_root: STRING(BytesBlob.parseBlobNoPrefix),
  });

  data!: BytesBlob;
  page_proofs!: BytesBlob[];
  segments_root!: BytesBlob;
}

export class SegmentEc {
  static fromJson: FromJson<SegmentEc> = OBJECT({
    segment_ec: ARRAY(STRING(BytesBlob.parseBlobNoPrefix)),
  });

  segment_ec!: BytesBlob[];
}

export class SegmentEcTest {
  static fromJson: FromJson<SegmentEcTest> = OBJECT({
    data: STRING(BytesBlob.parseBlobNoPrefix),
    segments: ARRAY(SegmentEc.fromJson),
    segments_root: STRING(BytesBlob.parseBlobNoPrefix),
  });

  data!: BytesBlob;
  segments!: SegmentEc[];
  segments_root!: BytesBlob;
}

export class SegmentRoot {
  static fromJson: FromJson<SegmentRoot> = OBJECT({
    data: STRING(BytesBlob.parseBlobNoPrefix),
    chunks: ARRAY(STRING(BytesBlob.parseBlobNoPrefix)),
    chunks_root: STRING(BytesBlob.parseBlobNoPrefix),
  });

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

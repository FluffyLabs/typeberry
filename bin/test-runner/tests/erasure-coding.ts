import { BytesBlob } from "@typeberry/bytes";
import { type FromJson, json } from "@typeberry/json-parser";
import { Logger } from "@typeberry/logger";

namespace fromJson {
  export const bytesBlob = json.fromString(BytesBlob.parseBlobNoPrefix);
}

export class EcTest {
  static fromJson: FromJson<EcTest> = {
    data: fromJson.bytesBlob,
    chunks: json.array(fromJson.bytesBlob),
  };

  data!: BytesBlob;
  chunks!: BytesBlob[];
}

export class PageProof {
  static fromJson: FromJson<PageProof> = {
    data: fromJson.bytesBlob,
    page_proofs: json.array(fromJson.bytesBlob),
    segments_root: fromJson.bytesBlob,
  };

  data!: BytesBlob;
  page_proofs!: BytesBlob[];
  segments_root!: BytesBlob;
}

export class SegmentEc {
  static fromJson: FromJson<SegmentEc> = {
    segment_ec: json.array(fromJson.bytesBlob),
  };

  segment_ec!: BytesBlob[];
}

export class SegmentEcTest {
  static fromJson: FromJson<SegmentEcTest> = {
    data: fromJson.bytesBlob,
    segments: json.array(SegmentEc.fromJson),
    segments_root: fromJson.bytesBlob,
  };

  data!: BytesBlob;
  segments!: SegmentEc[];
  segments_root!: BytesBlob;
}

export class SegmentRoot {
  static fromJson: FromJson<SegmentRoot> = {
    data: fromJson.bytesBlob,
    chunks: json.array(fromJson.bytesBlob),
    chunks_root: fromJson.bytesBlob,
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

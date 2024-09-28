import { Bytes, BytesBlob } from "@typeberry/bytes";
import { Logger } from "@typeberry/logger";
import { NUMBER, OBJECT, STRING, type FromJson } from "../json-parser";

const BYTES32 = STRING((v) => Bytes.parseBytes(v, 32));

export class Header {
  static fromJson: FromJson<Header> = OBJECT({
    parent: BYTES32,
    parent_state_root: BYTES32,
    extrinsic_hash: BYTES32,
    slot: NUMBER(),
    epoch_mark: OBJECT({
      entropy: BYTES32,
    }),
    tickets_mark: ANY(() => null),
    offenders_mark: ARRAY(),
  });

  parent!: Bytes<32>;
  parent_state_root!: Bytes<32>;
  extrinsic_hash!: Bytes<32>;
  slot!: number;
  epoch_mark: {
    entropy: Bytes<32>;
  }
  tickets_mark?: null;
  offenders_mark?: [];
  author_index: number;
  entropy_source:
  seal
}
const logger = Logger.new(global.__filename, "test-runner/codec");

export async function runHeaderTest(test: Header) {
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

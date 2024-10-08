import assert from "node:assert";
import fs from "node:fs";
import { CodecContext } from "@typeberry/block/context";
import {
  type GuaranteesExtrinsic,
  ReportGuarantee,
  ValidatorSignature,
  guaranteesExtrinsicCodec,
} from "@typeberry/block/gaurantees";
import { BytesBlob } from "@typeberry/bytes";
import { Decoder, Encoder } from "@typeberry/codec";
import { json } from "@typeberry/json-parser";
import { fromJson } from ".";
import type { JsonObject } from "../../json-format";
import { workReportFromJson } from "./work_report";

const validatorSignatureFromJson = json.object<JsonObject<ValidatorSignature>, ValidatorSignature>(
  {
    validator_index: "number",
    signature: fromJson.ed25519Signature,
  },
  ({ validator_index, signature }) => new ValidatorSignature(validator_index, signature),
);

const reportGuaranteeFromJson = json.object<ReportGuarantee>(
  {
    report: workReportFromJson,
    slot: "number",
    signatures: json.array(validatorSignatureFromJson),
  },
  ({ report, slot, signatures }) => new ReportGuarantee(report, slot, signatures),
);

export const guaranteesExtrinsicFromJson = json.array(reportGuaranteeFromJson);

export async function runGuaranteesExtrinsicTest(test: GuaranteesExtrinsic, file: string) {
  const encoded = new Uint8Array(fs.readFileSync(file.replace("json", "bin")));

  const myEncoded = Encoder.encodeObject(guaranteesExtrinsicCodec, test, new CodecContext());
  assert.deepStrictEqual(myEncoded.toString(), BytesBlob.fromBlob(encoded).toString());

  const decoded = Decoder.decodeObject(guaranteesExtrinsicCodec, encoded, new CodecContext());
  assert.deepStrictEqual(decoded, test);
}

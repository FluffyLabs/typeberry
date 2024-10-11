import assert from "node:assert";
import fs from "node:fs";
import type { HASH_SIZE } from "@typeberry/block";
import type { Gas, ServiceId } from "@typeberry/block";
import { CodecContext } from "@typeberry/block/context";
import { WorkExecResult, WorkExecResultKind, WorkResult } from "@typeberry/block/work-result";
import { type Bytes, BytesBlob } from "@typeberry/bytes";
import { Decoder, Encoder } from "@typeberry/codec";
import { json } from "@typeberry/json-parser";
import type { U32 } from "@typeberry/numbers";
import { bytes32 } from ".";

// TODO [ToDr] Introduce fromJson.union?
const workExecResultFromJson = json.object<JsonWorkExecResult, WorkExecResult>(
  {
    ok: json.optional(json.fromString(BytesBlob.parseBlob)),
    out_of_gas: json.optional(json.fromAny(() => null)),
    panic: json.optional(json.fromAny(() => null)),
    bad_code: json.optional(json.fromAny(() => null)),
    code_oversize: json.optional(json.fromAny(() => null)),
  },
  (val) => {
    const { ok, out_of_gas, panic, bad_code, code_oversize } = val;
    if (ok) {
      return new WorkExecResult(WorkExecResultKind.ok as U32, ok);
    }
    if (out_of_gas === null) {
      return new WorkExecResult(WorkExecResultKind.outOfGas as U32);
    }
    if (panic === null) {
      return new WorkExecResult(WorkExecResultKind.panic as U32);
    }
    if (bad_code === null) {
      return new WorkExecResult(WorkExecResultKind.badCode as U32);
    }
    if (code_oversize === null) {
      return new WorkExecResult(WorkExecResultKind.codeOversize as U32);
    }

    throw new Error("Invalid WorkExecResult");
  },
);

type JsonWorkExecResult = {
  ok?: BytesBlob;
  out_of_gas?: null;
  panic?: null;
  bad_code?: null;
  code_oversize?: null;
};

export const workResultFromJson = json.object<JsonWorkResult, WorkResult>(
  {
    service: "number",
    code_hash: bytes32(),
    payload_hash: bytes32(),
    gas_ratio: "number",
    result: workExecResultFromJson,
  },
  ({ service, code_hash, payload_hash, gas_ratio, result }) =>
    new WorkResult(service, code_hash, payload_hash, BigInt(gas_ratio) as Gas, result),
);

type JsonWorkResult = {
  service: ServiceId;
  code_hash: Bytes<typeof HASH_SIZE>;
  payload_hash: Bytes<typeof HASH_SIZE>;
  // TODO [ToDr] We don't have enough precision here for full bigint so 🤞
  // otherwise we will need to use a custom JSON parser.
  gas_ratio: number;
  result: WorkExecResult;
};

export async function runWorkResultTest(test: WorkResult, file: string) {
  const encoded = new Uint8Array(fs.readFileSync(file.replace("json", "bin")));

  const myEncoded = Encoder.encodeObject(WorkResult.Codec, test, new CodecContext());
  assert.deepStrictEqual(myEncoded.toString(), BytesBlob.fromBlob(encoded).toString());

  const decoded = Decoder.decodeObject(WorkResult.Codec, encoded, new CodecContext());
  assert.deepStrictEqual(decoded, test);
}

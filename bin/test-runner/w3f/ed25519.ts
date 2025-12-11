import assert from "node:assert";
import { it } from "node:test";
import { Bytes, BytesBlob } from "@typeberry/bytes";
import { type Ed25519Key, ed25519, initWasm } from "@typeberry/crypto";
import { type FromJson, json } from "@typeberry/json-parser";

const bytes32NoPrefix = <T extends Bytes<32>>() =>
  json.fromString<T>((v) => Bytes.parseBytesNoPrefix(v, 32).asOpaque());

class Ed25519Test {
  static fromJson: FromJson<Ed25519Test> = {
    number: "number",
    desc: "string",
    pk: bytes32NoPrefix(),
    r: bytes32NoPrefix(),
    s: bytes32NoPrefix(),
    msg: "string",
    pk_canonical: "boolean",
    r_canonical: "boolean",
  };

  number!: number;
  desc!: string;
  pk!: Ed25519Key;
  r!: Bytes<32>;
  s!: Bytes<32>;
  msg!: string;
  pk_canonical!: boolean;
  r_canonical!: boolean;
}

export const ed25519TestsFromJson = json.array(Ed25519Test.fromJson);

export async function runEd25519Test(testContents: Ed25519Test[]) {
  await initWasm();

  const data = testContents.map((testContent) => ({
    signature: Bytes.fromBlob(BytesBlob.blobFromParts(testContent.r.raw, testContent.s.raw).raw, 64).asOpaque(),
    message: BytesBlob.parseBlobNoPrefix(testContent.msg),
    key: testContent.pk,
  }));

  const results = await ed25519.verify(data);

  for (let i = 0; i < data.length; i++) {
    await it(`should verify correctly test ${i} ${testContents[i].desc}`, () => {
      assert.strictEqual(results[i], true);
    });
  }

  await it("should verify all tests in batch", async () => {
    const batchResult = await ed25519.verifyBatch(data);

    assert.strictEqual(batchResult, true);
  });
}

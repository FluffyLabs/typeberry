import assert from "node:assert";
import fs from "node:fs";
import type { HeaderHash, TimeSlot } from "@typeberry/block";
import { CodecContext } from "@typeberry/block/context";
import { type BeefyHash, RefineContext } from "@typeberry/block/refine-context";
import { type Bytes, BytesBlob } from "@typeberry/bytes";
import { Decoder, Encoder } from "@typeberry/codec";
import { json } from "@typeberry/json-parser";
import type { TrieHash } from "@typeberry/trie";
import { bytes32 } from ".";

export const refineContextFromJson = json.object<JsonRefineContext, RefineContext>(
  {
    anchor: bytes32(),
    state_root: bytes32(),
    beefy_root: bytes32(),
    lookup_anchor: bytes32(),
    lookup_anchor_slot: "number",
    prerequisite: json.optional(bytes32()),
  },
  ({ anchor, state_root, beefy_root, lookup_anchor, lookup_anchor_slot, prerequisite }) =>
    new RefineContext(anchor, state_root, beefy_root, lookup_anchor, lookup_anchor_slot, prerequisite),
);

type JsonRefineContext = {
  anchor: HeaderHash;
  state_root: TrieHash;
  beefy_root: BeefyHash;
  lookup_anchor: HeaderHash;
  lookup_anchor_slot: TimeSlot;
  prerequisite?: Bytes<32>;
};

export async function runRefineContextTest(test: RefineContext, file: string) {
  const encoded = new Uint8Array(fs.readFileSync(file.replace("json", "bin")));

  const myEncoded = Encoder.encodeObject(RefineContext.Codec, test, new CodecContext());
  assert.deepStrictEqual(myEncoded.toString(), BytesBlob.fromBlob(encoded).toString());

  const decoded = Decoder.decodeObject(RefineContext.Codec, encoded, new CodecContext());
  assert.deepStrictEqual(decoded, test);
}

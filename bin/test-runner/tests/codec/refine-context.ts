import type { HeaderHash, TimeSlot } from "@typeberry/block";
import { type BeefyHash, RefineContext } from "@typeberry/block/refine-context";
import type { Bytes } from "@typeberry/bytes";
import { json } from "@typeberry/json-parser";
import type { TrieHash } from "@typeberry/trie";
import { fromJson, runCodecTest } from "./common";

export const refineContextFromJson = json.object<JsonRefineContext, RefineContext>(
  {
    anchor: fromJson.bytes32(),
    state_root: fromJson.bytes32(),
    beefy_root: fromJson.bytes32(),
    lookup_anchor: fromJson.bytes32(),
    lookup_anchor_slot: "number",
    prerequisites: json.array(fromJson.bytes32()),
  },
  ({ anchor, state_root, beefy_root, lookup_anchor, lookup_anchor_slot, prerequisites }) =>
    new RefineContext(anchor, state_root, beefy_root, lookup_anchor, lookup_anchor_slot, prerequisites),
);

type JsonRefineContext = {
  anchor: HeaderHash;
  state_root: TrieHash;
  beefy_root: BeefyHash;
  lookup_anchor: HeaderHash;
  lookup_anchor_slot: TimeSlot;
  prerequisites: Bytes<32>[];
};

export async function runRefineContextTest(test: RefineContext, file: string) {
  runCodecTest(RefineContext.Codec, test, file);
}

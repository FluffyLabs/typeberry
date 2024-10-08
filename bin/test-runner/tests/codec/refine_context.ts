import type { HeaderHash, TimeSlot } from "@typeberry/block";
import { type BeefyHash, RefineContext } from "@typeberry/block/refine_context";
import type { Bytes } from "@typeberry/bytes";
import { json } from "@typeberry/json-parser";
import type { TrieHash } from "@typeberry/trie";
import { bytes32, logger } from ".";

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
  logger.trace(JSON.stringify(test, null, 2));
  logger.error(`Not implemented yet! ${file}`);
}

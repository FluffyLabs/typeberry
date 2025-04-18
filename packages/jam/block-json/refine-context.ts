import type { HeaderHash, StateRootHash, TimeSlot } from "@typeberry/block";
import { type BeefyHash, RefineContext } from "@typeberry/block/refine-context";
import type { WorkPackageHash } from "@typeberry/block/work-report";
import { json } from "@typeberry/json-parser";
import { fromJson } from "./common";

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
  state_root: StateRootHash;
  beefy_root: BeefyHash;
  lookup_anchor: HeaderHash;
  lookup_anchor_slot: TimeSlot;
  prerequisites: WorkPackageHash[];
};

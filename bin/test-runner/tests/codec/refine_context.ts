import type { Bytes } from "@typeberry/bytes";
import { json } from "@typeberry/json-parser";
import type { TrieHash } from "@typeberry/trie";
import { type BeefyHash, type HeaderHash, type Slot, bytes32, logger } from ".";

export class RefineContext {
  static fromJson = json.object<RefineContext>(
    {
      anchor: bytes32(),
      state_root: bytes32(),
      beefy_root: bytes32(),
      lookup_anchor: bytes32(),
      lookup_anchor_slot: "number",
      prerequisite: json.optional(bytes32()),
    },
    (x) => Object.assign(new RefineContext(), x),
  );

  anchor!: HeaderHash;
  state_root!: TrieHash;
  beefy_root!: BeefyHash;
  lookup_anchor!: HeaderHash;
  lookup_anchor_slot!: Slot;
  prerequisite?: Bytes<32>;

  private constructor() {}
}

export async function runRefineContextTest(test: RefineContext, file: string) {
  logger.trace(JSON.stringify(test, null, 2));
  logger.error(`Not implemented yet! ${file}`);
}

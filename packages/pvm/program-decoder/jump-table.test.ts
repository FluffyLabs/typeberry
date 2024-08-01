import assert from "node:assert";
import { describe, it } from "node:test";

import { JumpTable } from "./jump-table";

describe("JumpTable", () => {
  it("should return true when an index exist in jump table", () => {
    const jumpTableItemLength = 4;
    const bytes = new Uint8Array([0xe0, 0, 0, 0x20]);
    const jumpTable = new JumpTable(jumpTableItemLength, bytes);
    const indexToCheck = 2 ** 21;

    const result = jumpTable.hasIndex(indexToCheck);

    assert.strictEqual(result, true);
  });

  it("should return false when an index not exist in jump table", () => {
    const jumpTableItemLength = 4;
    const bytes = new Uint8Array([0xe0, 0, 0, 0x20]);
    const jumpTable = new JumpTable(jumpTableItemLength, bytes);
    const indexToCheck = 2 ** 21 + 1;

    const result = jumpTable.hasIndex(indexToCheck);

    assert.strictEqual(result, false);
  });
});

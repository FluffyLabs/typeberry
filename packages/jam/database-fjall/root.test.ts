import assert from "node:assert";
import * as fs from "node:fs";
import { describe, it } from "node:test";
import { FjallRoot } from "./root.js";

const key = Buffer.from("key");
const value = Buffer.from("value");

describe("FjallRoot", () => {
  it("deletes a partition and recreates it empty", async () => {
    const dbPath = fs.mkdtempSync("typeberry-fjall-root-");
    const root = await FjallRoot.open(dbPath, { ephemeral: true });
    try {
      const first = await root.writablePartition("scratch");
      await first.insert(key, value);

      await root.deletePartition("scratch");

      const second = await root.writablePartition("scratch");
      assert.strictEqual(second.get(key), null);
    } finally {
      await root.close();
      fs.rmSync(dbPath, { recursive: true, force: true });
    }
  });
});

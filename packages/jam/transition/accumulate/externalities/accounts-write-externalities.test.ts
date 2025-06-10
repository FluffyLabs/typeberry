import assert from "node:assert";
import { describe, it } from "node:test";

import { tryAsServiceId } from "@typeberry/block";
import { Bytes, BytesBlob } from "@typeberry/bytes";
import { HASH_SIZE } from "@typeberry/hash";
import { AccountsWriteExternalities } from "./accounts-write-externalities.js";

describe("accounts-write-externalities", () => {
  describe("write", () => {
    it("should not be implemented yet", () => {
      const serviceId = tryAsServiceId(0);
      const hash = Bytes.fill(HASH_SIZE, 1);
      const data = BytesBlob.empty();

      const accountsWriteExternalities = new AccountsWriteExternalities();

      const tryToWrite = () => accountsWriteExternalities.write(serviceId, hash, data);

      assert.throws(tryToWrite, new Error("Method not implemented."));
    });
  });

  describe("readSnapshotLength", () => {
    it("should not be implemented yet", () => {
      const serviceId = tryAsServiceId(0);
      const hash = Bytes.fill(HASH_SIZE, 1);

      const accountsWriteExternalities = new AccountsWriteExternalities();

      const tryToRead = () => accountsWriteExternalities.readSnapshotLength(serviceId, hash);

      assert.throws(tryToRead, new Error("Method not implemented."));
    });
  });

  describe("isStorageFull", () => {
    it("should not be implemented yet", () => {
      const serviceId = tryAsServiceId(0);

      const accountsWriteExternalities = new AccountsWriteExternalities();

      const tryToCheck = () => accountsWriteExternalities.isStorageFull(serviceId);

      assert.throws(tryToCheck, new Error("Method not implemented."));
    });
  });
});

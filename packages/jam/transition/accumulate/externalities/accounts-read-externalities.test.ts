import assert from "node:assert";
import { describe, it } from "node:test";

import { tryAsServiceId } from "@typeberry/block";
import { Bytes } from "@typeberry/bytes";
import { HASH_SIZE } from "@typeberry/hash";
import { AccountsReadExternalities } from "./accounts-read-externalities.js";

describe("accounts-read-externalities", () => {
  describe("read", () => {
    it("should not be implemented yet", () => {
      const serviceId = tryAsServiceId(0);
      const hash = Bytes.fill(HASH_SIZE, 1);

      const accountsReadExternalities = new AccountsReadExternalities();

      const tryToRead = () => accountsReadExternalities.read(serviceId, hash);

      assert.throws(tryToRead, new Error("Method not implemented."));
    });
  });
});

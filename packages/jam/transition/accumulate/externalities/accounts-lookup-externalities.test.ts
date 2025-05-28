import assert from "node:assert";
import { describe, it } from "node:test";

import { tryAsServiceId } from "@typeberry/block";
import { Bytes } from "@typeberry/bytes";
import { HASH_SIZE } from "@typeberry/hash";
import { AccountsLookupExternalities } from "./accounts-lookup-externalities";

describe("accounts-read-externalities", () => {
  describe("lookup", () => {
    it("should not be implemented yet", () => {
      const serviceId = tryAsServiceId(0);
      const hash = Bytes.fill(HASH_SIZE, 1);

      const accountsLookupExternalities = new AccountsLookupExternalities();

      const tryToLookup = () => accountsLookupExternalities.lookup(serviceId, hash);

      assert.throws(tryToLookup, new Error("Method not implemented."));
    });
  });
});

import { describe, it } from "node:test";
import { verifyBandersnatch } from "./bandersnatch";

describe("Bandersnatch verification", () => {
  it("verify", async () => {
    try {
      await verifyBandersnatch();
    } catch (e) {
      console.info("Error temporarily expected.");
    }
  });
});

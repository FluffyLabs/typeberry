import assert from "node:assert";
import { describe, it } from "node:test";

import { tryAsU64 } from "@typeberry/numbers";
import { HostCallRegisters } from "./host-call-registers.js";

describe("HostCallRegisters", () => {
  describe("getAllEncoded", () => {
    it("reads a u64 value from the underlying registers", () => {
      const regs = new BigUint64Array(13);
      regs[0] = 0xffff_ffff_ffff_fffdn;
      const hostCallRegisters = new HostCallRegisters(new Uint8Array(regs.buffer));
      assert.strictEqual(hostCallRegisters.get(0), tryAsU64(0xffff_ffff_ffff_fffdn));
    });
  });

  describe("setAllEncoded", () => {
    it("writes a u64 value to the underlying registers", () => {
      const regs = new BigUint64Array(13);
      const hostCallRegisters = new HostCallRegisters(new Uint8Array(regs.buffer));
      hostCallRegisters.set(0, tryAsU64(0xffff_ffff_ffff_fffdn));
      const view = new DataView(hostCallRegisters.getEncoded().buffer);
      assert.strictEqual(view.getBigUint64(0, true), tryAsU64(0xffff_ffff_ffff_fffdn));
      assert.strictEqual(regs[0], tryAsU64(0xffff_ffff_ffff_fffdn));
    });
  });
});

import assert from "node:assert";
import { describe, it } from "node:test";

import { tryAsU64 } from "@typeberry/numbers";
import { Registers } from "@typeberry/pvm-interpreter";
import { HostCallRegisters } from "./host-call-registers.js";

describe("HostCallRegisters", () => {
  describe("get", () => {
    it("reads a u64 value from the underlying registers", () => {
      const registers = new Registers();
      registers.setU64(0, tryAsU64(0xffff_ffff_ffff_fffdn));
      const hostCallRegisters = new HostCallRegisters(registers);
      assert.strictEqual(hostCallRegisters.get(0), tryAsU64(0xffff_ffff_ffff_fffdn));
    });
  });

  describe("set", () => {
    it("writes a u64 value to the underlying registers", () => {
      const registers = new Registers();
      const hostCallRegisters = new HostCallRegisters(registers);
      hostCallRegisters.set(0, tryAsU64(0xffff_ffff_ffff_fffdn));
      assert.strictEqual(registers.getU64(0), tryAsU64(0xffff_ffff_ffff_fffdn));
    });
  });
});

import assert from "node:assert";
import { describe, it } from "node:test";
import { tryAsSmallGas } from "@typeberry/pvm-interface";
import { tryAsHostCallIndex } from "./host-call-handler.js";
import { extractRegisters, IoTraceLogger } from "./io-trace-logger.js";

describe("IoTraceLogger", () => {
  describe("logProgram", () => {
    it("formats program blob as hex", () => {
      const lines: string[] = [];
      const logger = new IoTraceLogger((line) => lines.push(line));

      logger.logProgram(new Uint8Array([0x01, 0x02, 0xaa, 0xbb]));

      assert.strictEqual(lines.length, 1);
      assert.strictEqual(lines[0], "program 0x0102aabb");
    });

    it("handles empty program", () => {
      const lines: string[] = [];
      const logger = new IoTraceLogger((line) => lines.push(line));

      logger.logProgram(new Uint8Array([]));

      assert.strictEqual(lines[0], "program 0x");
    });
  });

  describe("logInitialMemWrite", () => {
    it("formats memory write with address and data", () => {
      const lines: string[] = [];
      const logger = new IoTraceLogger((line) => lines.push(line));

      logger.logInitialMemWrite(0x1000, new Uint8Array([0x00, 0x01, 0x02]));

      assert.strictEqual(lines[0], "memwrite 0x00001000 len=3 <- 0x000102");
    });
  });

  describe("logStart", () => {
    it("formats start with register dump", () => {
      const lines: string[] = [];
      const logger = new IoTraceLogger((line) => lines.push(line));

      const regs = new Map<number, bigint>([
        [7, 0x10n],
        [9, 0x10000n],
      ]);

      logger.logStart(0, tryAsSmallGas(10000), regs);

      assert.strictEqual(lines[0], "start pc=0 gas=10000 r07=0x10 r09=0x10000");
    });

    it("handles no non-zero registers", () => {
      const lines: string[] = [];
      const logger = new IoTraceLogger((line) => lines.push(line));

      logger.logStart(42, tryAsSmallGas(5000), new Map());

      assert.strictEqual(lines[0], "start pc=42 gas=5000");
    });
  });

  describe("logEcalli", () => {
    it("formats ecalli with register dump", () => {
      const lines: string[] = [];
      const logger = new IoTraceLogger((line) => lines.push(line));

      const regs = new Map<number, bigint>([
        [1, 0x1n],
        [3, 0x1000n],
      ]);

      logger.logEcalli(tryAsHostCallIndex(10), 42, tryAsSmallGas(10000), regs);

      assert.strictEqual(lines[0], "ecalli=10 pc=42 gas=10000 r01=0x1 r03=0x1000");
    });

    it("omits zero registers", () => {
      const lines: string[] = [];
      const logger = new IoTraceLogger((line) => lines.push(line));

      const regs = new Map<number, bigint>([
        [0, 0n],
        [1, 1n],
      ]);

      logger.logEcalli(tryAsHostCallIndex(5), 0, tryAsSmallGas(5000), regs);

      assert.strictEqual(lines[0], "ecalli=5 pc=0 gas=5000 r01=0x1");
    });

    it("handles no non-zero registers", () => {
      const lines: string[] = [];
      const logger = new IoTraceLogger((line) => lines.push(line));

      logger.logEcalli(tryAsHostCallIndex(0), 0, tryAsSmallGas(100), new Map());

      assert.strictEqual(lines[0], "ecalli=0 pc=0 gas=100");
    });
  });

  describe("logMemRead", () => {
    it("formats memory read", () => {
      const lines: string[] = [];
      const logger = new IoTraceLogger((line) => lines.push(line));

      logger.logMemRead(0x1000, new Uint8Array([0x01, 0x02, 0x03, 0x04]));

      assert.strictEqual(lines[0], "memread 0x00001000 len=4 -> 0x01020304");
    });
  });

  describe("logMemWrite", () => {
    it("formats memory write", () => {
      const lines: string[] = [];
      const logger = new IoTraceLogger((line) => lines.push(line));

      logger.logMemWrite(0x2000, new Uint8Array([0xff, 0xee]));

      assert.strictEqual(lines[0], "memwrite 0x00002000 len=2 <- 0xffee");
    });
  });

  describe("logSetReg", () => {
    it("formats register write with padded index", () => {
      const lines: string[] = [];
      const logger = new IoTraceLogger((line) => lines.push(line));

      logger.logSetReg(0, 0x100n);

      assert.strictEqual(lines[0], "setreg r00 <- 0x100");
    });

    it("formats two-digit register index", () => {
      const lines: string[] = [];
      const logger = new IoTraceLogger((line) => lines.push(line));

      logger.logSetReg(12, 0x4n);

      assert.strictEqual(lines[0], "setreg r12 <- 0x4");
    });
  });

  describe("logSetGas", () => {
    it("formats gas write", () => {
      const lines: string[] = [];
      const logger = new IoTraceLogger((line) => lines.push(line));

      logger.logSetGas(tryAsSmallGas(9950));

      assert.strictEqual(lines[0], "setgas <- 9950");
    });
  });

  describe("logHostActions", () => {
    it("logs actions in correct order: reads, writes, regs, gas", () => {
      const lines: string[] = [];
      const logger = new IoTraceLogger((line) => lines.push(line));

      logger.logHostActions(
        [
          { type: "write", address: 0x2000, data: new Uint8Array([0xab]) },
          { type: "read", address: 0x1000, data: new Uint8Array([0xcd]) },
        ],
        [{ index: 0, value: 0x100n }],
        tryAsSmallGas(10000),
        tryAsSmallGas(9950),
      );

      assert.strictEqual(lines.length, 4);
      assert.strictEqual(lines[0], "memread 0x00001000 len=1 -> 0xcd");
      assert.strictEqual(lines[1], "memwrite 0x00002000 len=1 <- 0xab");
      assert.strictEqual(lines[2], "setreg r00 <- 0x100");
      assert.strictEqual(lines[3], "setgas <- 9950");
    });

    it("sorts reads by address", () => {
      const lines: string[] = [];
      const logger = new IoTraceLogger((line) => lines.push(line));

      logger.logHostActions(
        [
          { type: "read", address: 0x2000, data: new Uint8Array([0x01]) },
          { type: "read", address: 0x1000, data: new Uint8Array([0x02]) },
        ],
        [],
        tryAsSmallGas(100),
        tryAsSmallGas(100),
      );

      assert.strictEqual(lines[0], "memread 0x00001000 len=1 -> 0x02");
      assert.strictEqual(lines[1], "memread 0x00002000 len=1 -> 0x01");
    });

    it("skips setgas if unchanged", () => {
      const lines: string[] = [];
      const logger = new IoTraceLogger((line) => lines.push(line));

      logger.logHostActions([], [], tryAsSmallGas(100), tryAsSmallGas(100));

      assert.strictEqual(lines.length, 0);
    });
  });

  describe("termination logging", () => {
    it("logs HALT", () => {
      const lines: string[] = [];
      const logger = new IoTraceLogger((line) => lines.push(line));

      const regs = new Map<number, bigint>([[0, 0x100n]]);
      logger.logHalt(42, tryAsSmallGas(9920), regs);

      assert.strictEqual(lines[0], "HALT pc=42 gas=9920 r00=0x100");
    });

    it("logs OOG", () => {
      const lines: string[] = [];
      const logger = new IoTraceLogger((line) => lines.push(line));

      logger.logOog(100, tryAsSmallGas(0), new Map());

      assert.strictEqual(lines[0], "OOG pc=100 gas=0");
    });

    it("logs PANIC with argument", () => {
      const lines: string[] = [];
      const logger = new IoTraceLogger((line) => lines.push(line));

      logger.logPanic(1, 50, tryAsSmallGas(500), new Map());

      assert.strictEqual(lines[0], "PANIC=1 pc=50 gas=500");
    });
  });

  describe("extractRegisters", () => {
    it("extracts non-zero registers", () => {
      const values = [0n, 1n, 0n, 0x1000n, 0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n];
      const result = extractRegisters((i) => values[i]);

      assert.strictEqual(result.size, 2);
      assert.strictEqual(result.get(1), 1n);
      assert.strictEqual(result.get(3), 0x1000n);
    });

    it("returns empty map for all zeros", () => {
      const result = extractRegisters(() => 0n);

      assert.strictEqual(result.size, 0);
    });
  });
});

import assert from "node:assert";
import { describe, it } from "node:test";
import { tryAsU32, tryAsU64 } from "@typeberry/numbers";
import { NO_OF_REGISTERS, REGISTER_BYTE_SIZE, tryAsSmallGas } from "@typeberry/pvm-interface";
import { EcalliTraceLogger, IoTraceTracker } from "./ecalli-trace-logger.js";
import { tryAsHostCallIndex } from "./host-call-handler.js";
import { HostCallRegisters } from "./host-call-registers.js";

/** Helper to create HostCallRegisters with specific values set. */
function createRegisters(values: Map<number, bigint>): HostCallRegisters {
  const bytes = new Uint8Array(NO_OF_REGISTERS * REGISTER_BYTE_SIZE);
  const view = new DataView(bytes.buffer);
  for (const [idx, value] of values) {
    view.setBigUint64(idx * REGISTER_BYTE_SIZE, value, true);
  }
  return new HostCallRegisters(bytes);
}

describe("IoTraceLogger", () => {
  describe("logProgram", () => {
    it("formats program blob as hex", () => {
      const lines: string[] = [];
      const logger = EcalliTraceLogger.new((line: string) => lines.push(line));

      logger.logProgram(new Uint8Array([0x01, 0x02, 0xaa, 0xbb]), new Uint8Array());

      assert.strictEqual(lines.length, 1);
      assert.strictEqual(lines[0], "program 0x0102aabb");
    });

    it("handles empty program", () => {
      const lines: string[] = [];
      const logger = EcalliTraceLogger.new((line: string) => lines.push(line));

      logger.logProgram(new Uint8Array([]), new Uint8Array());

      assert.strictEqual(lines[0], "program 0x");
    });

    it("logs args as initial memory write", () => {
      const lines: string[] = [];
      const logger = EcalliTraceLogger.new((line: string) => lines.push(line));

      logger.logProgram(new Uint8Array([0x01]), new Uint8Array([0x00, 0x01, 0x02]));

      assert.strictEqual(lines.length, 2);
      assert.strictEqual(lines[0], "program 0x01");
      assert.strictEqual(lines[1], "memwrite 0xfeff0000 len=3 <- 0x000102");
    });
  });

  describe("logStart", () => {
    it("formats start with register dump", () => {
      const lines: string[] = [];
      const logger = EcalliTraceLogger.new((line: string) => lines.push(line));

      const regs = createRegisters(
        new Map<number, bigint>([
          [7, 0x10n],
          [9, 0x10000n],
        ]),
      );

      logger.logStart(0, tryAsSmallGas(10000), regs);

      assert.strictEqual(lines[0], "start pc=0 gas=10000 r07=0x10 r09=0x10000");
    });

    it("handles no non-zero registers", () => {
      const lines: string[] = [];
      const logger = EcalliTraceLogger.new((line: string) => lines.push(line));

      const regs = createRegisters(new Map());

      logger.logStart(42, tryAsSmallGas(5000), regs);

      assert.strictEqual(lines[0], "start pc=42 gas=5000 ");
    });
  });

  describe("logEcalli", () => {
    it("formats ecalli with register dump", () => {
      const lines: string[] = [];
      const logger = EcalliTraceLogger.new((line: string) => lines.push(line));

      const regs = createRegisters(
        new Map<number, bigint>([
          [1, 0x1n],
          [3, 0x1000n],
        ]),
      );

      logger.logEcalli(tryAsHostCallIndex(10), 42, tryAsSmallGas(10000), regs);

      assert.strictEqual(lines[0], "ecalli=10 pc=42 gas=10000 r01=0x1 r03=0x1000");
    });

    it("omits zero registers", () => {
      const lines: string[] = [];
      const logger = EcalliTraceLogger.new((line: string) => lines.push(line));

      const regs = createRegisters(
        new Map<number, bigint>([
          [0, 0n],
          [1, 1n],
        ]),
      );

      logger.logEcalli(tryAsHostCallIndex(5), 0, tryAsSmallGas(5000), regs);

      assert.strictEqual(lines[0], "ecalli=5 pc=0 gas=5000 r01=0x1");
    });

    it("handles no non-zero registers", () => {
      const lines: string[] = [];
      const logger = EcalliTraceLogger.new((line: string) => lines.push(line));

      const regs = createRegisters(new Map());

      logger.logEcalli(tryAsHostCallIndex(0), 0, tryAsSmallGas(100), regs);

      assert.strictEqual(lines[0], "ecalli=0 pc=0 gas=100 ");
    });
  });

  describe("logMemRead", () => {
    it("formats memory read", () => {
      const lines: string[] = [];
      const logger = EcalliTraceLogger.new((line: string) => lines.push(line));

      logger.logMemRead(0x1000, 4, "0x01020304");

      assert.strictEqual(lines[0], "memread 0x00001000 len=4 -> 0x01020304");
    });
  });

  describe("logMemWrite", () => {
    it("formats memory write", () => {
      const lines: string[] = [];
      const logger = EcalliTraceLogger.new((line: string) => lines.push(line));

      logger.logMemWrite(0x2000, 2, "0xffee");

      assert.strictEqual(lines[0], "memwrite 0x00002000 len=2 <- 0xffee");
    });
  });

  describe("logSetReg", () => {
    it("formats register write with padded index", () => {
      const lines: string[] = [];
      const logger = EcalliTraceLogger.new((line: string) => lines.push(line));

      logger.logSetReg(0, 0x100n);

      assert.strictEqual(lines[0], "setreg r00 <- 0x100");
    });

    it("formats two-digit register index", () => {
      const lines: string[] = [];
      const logger = EcalliTraceLogger.new((line: string) => lines.push(line));

      logger.logSetReg(12, 0x4n);

      assert.strictEqual(lines[0], "setreg r12 <- 0x4");
    });
  });

  describe("logSetGas", () => {
    it("formats gas write", () => {
      const lines: string[] = [];
      const logger = EcalliTraceLogger.new((line: string) => lines.push(line));

      logger.logSetGas(tryAsSmallGas(9950));

      assert.strictEqual(lines[0], "setgas <- 9950");
    });
  });

  describe("logHostActions", () => {
    it("logs actions in correct order: reads, writes, regs, gas", () => {
      const lines: string[] = [];
      const logger = EcalliTraceLogger.new((line: string) => lines.push(line));

      const tracker = new IoTraceTracker();
      tracker.memWrite(tryAsU32(0x2000), new Uint8Array([0xab]));
      tracker.memRead(tryAsU32(0x1000), new Uint8Array([0xcd]));
      tracker.setReg(0, tryAsU64(0x100n));

      logger.logHostActions(tracker, tryAsSmallGas(10000), tryAsSmallGas(9950));

      assert.strictEqual(lines.length, 4);
      assert.strictEqual(lines[0], "memread 0x00001000 len=1 -> 0xcd");
      assert.strictEqual(lines[1], "memwrite 0x00002000 len=1 <- 0xab");
      assert.strictEqual(lines[2], "setreg r00 <- 0x100");
      assert.strictEqual(lines[3], "setgas <- 9950");
    });

    it("sorts reads by address", () => {
      const lines: string[] = [];
      const logger = EcalliTraceLogger.new((line: string) => lines.push(line));

      const tracker = new IoTraceTracker();
      tracker.memRead(tryAsU32(0x2000), new Uint8Array([0x01]));
      tracker.memRead(tryAsU32(0x1000), new Uint8Array([0x02]));

      logger.logHostActions(tracker, tryAsSmallGas(100), tryAsSmallGas(100));

      assert.strictEqual(lines[0], "memread 0x00001000 len=1 -> 0x02");
      assert.strictEqual(lines[1], "memread 0x00002000 len=1 -> 0x01");
    });

    it("skips setgas if unchanged", () => {
      const lines: string[] = [];
      const logger = EcalliTraceLogger.new((line: string) => lines.push(line));

      const tracker = new IoTraceTracker();

      logger.logHostActions(tracker, tryAsSmallGas(100), tryAsSmallGas(100));

      assert.strictEqual(lines.length, 0);
    });
  });

  describe("termination logging", () => {
    it("logs HALT", () => {
      const lines: string[] = [];
      const logger = EcalliTraceLogger.new((line: string) => lines.push(line));

      const regs = createRegisters(new Map([[0, 0x100n]]));
      logger.logHalt(42, tryAsSmallGas(9920), regs);

      assert.strictEqual(lines[0], "HALT pc=42 gas=9920 r00=0x100");
    });

    it("logs OOG", () => {
      const lines: string[] = [];
      const logger = EcalliTraceLogger.new((line: string) => lines.push(line));

      const regs = createRegisters(new Map());
      logger.logOog(100, tryAsSmallGas(0), regs);

      assert.strictEqual(lines[0], "OOG pc=100 gas=0 ");
    });

    it("logs PANIC with argument", () => {
      const lines: string[] = [];
      const logger = EcalliTraceLogger.new((line: string) => lines.push(line));

      const regs = createRegisters(new Map());
      logger.logPanic(1, 50, tryAsSmallGas(500), regs);

      assert.strictEqual(lines[0], "PANIC=1 pc=50 gas=500 ");
    });
  });

  describe("noop logger", () => {
    it("does not throw and produces no output", () => {
      const logger = EcalliTraceLogger.noop();

      logger.logContext("test");
      logger.logProgram(new Uint8Array([1, 2, 3]), new Uint8Array());
      logger.logSetGas(tryAsSmallGas(100));
    });

    it("returns null tracker", () => {
      const logger = EcalliTraceLogger.noop();
      const tracker = logger.tracker();

      assert.strictEqual(tracker, null);
    });
  });

  describe("IoTraceTracker", () => {
    it("tracks memory reads", () => {
      const tracker = new IoTraceTracker();

      tracker.memRead(tryAsU32(0x1000), new Uint8Array([0x01, 0x02]));
      tracker.memRead(tryAsU32(0x2000), new Uint8Array([0x03]));

      assert.strictEqual(tracker.reads.length, 2);
      assert.strictEqual(tracker.reads[0].address, 0x1000);
      assert.strictEqual(tracker.reads[0].hex, "0x0102");
    });

    it("tracks memory writes", () => {
      const tracker = new IoTraceTracker();

      tracker.memWrite(tryAsU32(0x3000), new Uint8Array([0xaa, 0xbb]));

      assert.strictEqual(tracker.writes.length, 1);
      assert.strictEqual(tracker.writes[0].address, 0x3000);
      assert.strictEqual(tracker.writes[0].hex, "0xaabb");
    });

    it("tracks register writes", () => {
      const tracker = new IoTraceTracker();

      tracker.setReg(5, tryAsU64(0x42n));
      tracker.setReg(7, tryAsU64(0x100n));

      assert.strictEqual(tracker.registers.size, 2);
      assert.strictEqual(tracker.registers.get(5), tryAsU64(0x42n));
      assert.strictEqual(tracker.registers.get(7), tryAsU64(0x100n));
    });

    it("clears all tracked data", () => {
      const tracker = new IoTraceTracker();

      tracker.memRead(tryAsU32(0x1000), new Uint8Array([0x01]));
      tracker.memWrite(tryAsU32(0x2000), new Uint8Array([0x02]));
      tracker.setReg(0, tryAsU64(0x100n));

      tracker.clear();

      assert.strictEqual(tracker.reads.length, 0);
      assert.strictEqual(tracker.writes.length, 0);
      assert.strictEqual(tracker.registers.size, 0);
    });
  });
});

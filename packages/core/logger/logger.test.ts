import assert from "node:assert";
import { describe, it } from "node:test";
import { Logger } from "./logger.js";
import { Level } from "./options.js";
import type { Transport } from "./transport.js";

describe("Logger", () => {
  it("should call transport methods with correct log levels", () => {
    const mockTransport = new MockTransport();

    // Configure logger with mock transport
    Logger.configureAllFromOptions(
      {
        workingDir: "",
        defaultLevel: Level.INSANE,
        modules: new Map(),
      },
      () => mockTransport,
    );

    const logger = Logger.new("test");

    // Test all log levels
    logger.insane`insane message`;
    logger.trace`trace message`;
    logger.log`log message`;
    logger.info`info message`;
    logger.warn`warn message`;
    logger.error`error message`;

    assert.strictEqual(mockTransport.calls.length, 6);
    assert.strictEqual(mockTransport.calls[0].level, Level.INSANE);
    assert.strictEqual(mockTransport.calls[1].level, Level.TRACE);
    assert.strictEqual(mockTransport.calls[2].level, Level.LOG);
    assert.strictEqual(mockTransport.calls[3].level, Level.INFO);
    assert.strictEqual(mockTransport.calls[4].level, Level.WARN);
    assert.strictEqual(mockTransport.calls[5].level, Level.ERROR);
    assert.strictEqual(mockTransport.calls[0].levelAndName[1], "test");
  });

  it("should return the configured log level", () => {
    Logger.configureAllFromOptions(
      {
        workingDir: "",
        defaultLevel: Level.INFO,
        modules: new Map(),
      },
      () => ({
        insane: () => {},
        trace: () => {},
        log: () => {},
        info: () => {},
        warn: () => {},
        error: () => {},
      }),
    );

    const logger = Logger.new("test");

    assert.strictEqual(logger.getLevel(), Level.INFO);
  });

  it("should respect module-specific log levels", () => {
    const mockTransport = new MockTransport();

    // Configure with TRACE as default, but pvm module with INSANE level
    Logger.configureAllFromOptions(
      {
        workingDir: "",
        defaultLevel: Level.TRACE,
        modules: new Map([["pvm", Level.INSANE]]),
      },
      () => mockTransport,
    );

    const pvmLogger = Logger.new("pvm");
    const otherLogger = Logger.new("other");

    // pvm logger should output INSANE messages
    pvmLogger.insane`pvm insane message`;
    pvmLogger.trace`pvm trace message`;

    // other logger should NOT output INSANE messages (default is TRACE)
    otherLogger.insane`other insane message`;
    otherLogger.trace`other trace message`;

    // Verify pvm logger outputs both insane and trace
    const pvmCalls = mockTransport.calls.filter((c) => c.levelAndName[1] === "pvm");
    assert.strictEqual(pvmCalls.length, 2);
    assert.strictEqual(pvmCalls[0].level, Level.INSANE);
    assert.strictEqual(pvmCalls[0].message, "pvm insane message");
    assert.strictEqual(pvmCalls[1].level, Level.TRACE);
    assert.strictEqual(pvmCalls[1].message, "pvm trace message");

    // Verify other logger only outputs trace (not insane)
    const otherCalls = mockTransport.calls.filter((c) => c.levelAndName[1] === "other");
    assert.strictEqual(otherCalls.length, 1);
    assert.strictEqual(otherCalls[0].level, Level.TRACE);
    assert.strictEqual(otherCalls[0].message, "other trace message");
  });
});

/** Mock transport that stores all log calls for testing purposes. */
class MockTransport implements Transport {
  public calls: Array<{ level: Level; levelAndName: readonly [Level, string]; message: string }> = [];

  private appendCall(level: Level, levelAndName: readonly [Level, string], strings: TemplateStringsArray) {
    if (level < levelAndName[0]) {
      return;
    }

    this.calls.push({ level, levelAndName, message: String(strings[0]) });
  }

  insane(levelAndName: readonly [Level, string], strings: TemplateStringsArray) {
    this.appendCall(Level.INSANE, levelAndName, strings);
  }

  trace(levelAndName: readonly [Level, string], strings: TemplateStringsArray) {
    this.appendCall(Level.TRACE, levelAndName, strings);
  }

  log(levelAndName: readonly [Level, string], strings: TemplateStringsArray) {
    this.appendCall(Level.LOG, levelAndName, strings);
  }

  info(levelAndName: readonly [Level, string], strings: TemplateStringsArray) {
    this.appendCall(Level.INFO, levelAndName, strings);
  }

  warn(levelAndName: readonly [Level, string], strings: TemplateStringsArray) {
    this.appendCall(Level.WARN, levelAndName, strings);
  }

  error(levelAndName: readonly [Level, string], strings: TemplateStringsArray) {
    this.appendCall(Level.ERROR, levelAndName, strings);
  }
}

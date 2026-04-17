import { describe, it, spyOn } from "bun:test";
import assert from "node:assert";
import { deepEqual } from "@typeberry/utils";
import { HELP_MESSAGE, parseArgs, SelectedPvm } from "./common.js";

describe("test runner common", () => {
  it("should parse pvm argument", () => {
    const args = ["--pvm", "ananas", "file1.json", "file2.json"];

    const result = parseArgs(args);

    deepEqual(result, {
      initialFiles: ["file1.json", "file2.json"],
      pvms: [SelectedPvm.Ananas],
      accumulateSequentially: false,
    });
  });

  it("should have both pvms by default", () => {
    const args = ["file1.json", "file2.json"];

    const result = parseArgs(args);

    deepEqual(result, {
      initialFiles: ["file1.json", "file2.json"],
      pvms: [SelectedPvm.Ananas, SelectedPvm.Builtin],
      accumulateSequentially: false,
    });
  });

  it("should throw on invalid pvm", () => {
    const args = ["--pvm=invalid", "file1.json", "file2.json"];

    assert.throws(
      () => {
        const _result = parseArgs(args);
      },
      {
        message: "Unknown pvm value: invalid. Use one of ananas, builtin.",
      },
    );
  });

  it("should parse --accumulate-sequentially without value as true", () => {
    const args = ["--accumulate-sequentially", "file1.json"];

    const result = parseArgs(args);

    deepEqual(result, {
      initialFiles: ["file1.json"],
      pvms: [SelectedPvm.Ananas, SelectedPvm.Builtin],
      accumulateSequentially: true,
    });
  });

  it("should parse --accumulate-sequentially=something as true", () => {
    const args = ["--accumulate-sequentially=something", "file1.json"];

    const result = parseArgs(args);

    deepEqual(result, {
      initialFiles: ["file1.json"],
      pvms: [SelectedPvm.Ananas, SelectedPvm.Builtin],
      accumulateSequentially: true,
    });
  });

  it("should parse --accumulate-sequentially=false as false", () => {
    const args = ["--accumulate-sequentially=false", "file1.json"];

    const result = parseArgs(args);

    deepEqual(result, {
      initialFiles: ["file1.json"],
      pvms: [SelectedPvm.Ananas, SelectedPvm.Builtin],
      accumulateSequentially: false,
    });
  });

  it("should print help with --help", () => {
    const args = ["--help"];
    const logMock = spyOn(console, "log").mockImplementation(() => {});
    const exitMock = spyOn(process, "exit").mockImplementation((() => undefined) as () => never);

    parseArgs(args);

    assert.strictEqual(exitMock.mock.calls.length, 1);
    assert.strictEqual(logMock.mock.calls.length, 1);
    const output = logMock.mock.calls[0][0] as string;
    assert.strictEqual(output, HELP_MESSAGE);

    logMock.mockRestore();
    exitMock.mockRestore();
  });
});

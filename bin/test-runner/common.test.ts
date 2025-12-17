import assert from "node:assert";
import { describe, it } from "node:test";
import { deepEqual } from "@typeberry/utils";
import { parseArgs, SelectedPvm } from "./common.js";

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
});

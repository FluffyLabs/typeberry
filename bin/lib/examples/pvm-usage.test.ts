// biome-ignore-all lint/suspicious/noConsole: We do want to print that.

import assert from "node:assert";
import { describe, it } from "node:test";
import { Status } from "@typeberry/pvm-interface";

describe("PVM Examples", () => {
  it("should demonstrate running a PVM program", async () => {
    // <!-- example:pvm-basic -->
    const { Interpreter } = await import("@typeberry/lib/pvm-interpreter");
    const { tryAsGas } = await import("@typeberry/lib/pvm-interface");
    const { BytesBlob } = await import("@typeberry/lib/bytes");

    // Load a PVM program from hex
    const programHex = "0x0000213308013309012803009577ff51070c648ac8980864a928f3648733083309013200499352d500";
    const program = BytesBlob.parseBlob(programHex);

    // Create interpreter and initialize with program
    const pvm = new Interpreter();
    pvm.resetGeneric(program.raw, 0, tryAsGas(1000));

    // dump the program data
    console.table(pvm.dumpProgram());

    // Run the program
    pvm.runProgram();

    // Program executed successfully
    assert.equal(pvm.getStatus(), Status.OOG);
    assert.equal(pvm.getPC(), 12);
    // <!-- /example:pvm-basic -->
  });

  it("should demonstrate accessing PVM registers after execution", async () => {
    // <!-- example:pvm-registers -->
    const { Interpreter } = await import("@typeberry/lib/pvm-interpreter");
    const { tryAsGas } = await import("@typeberry/lib/pvm-interface");
    const { BytesBlob } = await import("@typeberry/lib/bytes");

    const programHex = "0x0000210408010409010503000277ff07070c528a08980852a905f3528704080409111300499352d500";
    const program = BytesBlob.parseBlob(programHex);

    const pvm = new Interpreter();
    pvm.resetGeneric(program.raw, 0, tryAsGas(1000));
    pvm.runProgram();

    // Access register values after execution
    const reg0 = pvm.registers.getU64(0);

    // Registers contain BigInt values
    assert.strictEqual(typeof reg0, "bigint");
    // <!-- /example:pvm-registers -->
  });

  it("should demonstrate gas tracking in PVM", async () => {
    // <!-- example:pvm-gas -->
    const { Interpreter } = await import("@typeberry/lib/pvm-interpreter");
    const { tryAsGas } = await import("@typeberry/lib/pvm-interface");
    const { BytesBlob } = await import("@typeberry/lib/bytes");

    const programHex = "0x0000210408010409010503000277ff07070c528a08980852a905f3528704080409111300499352d500";
    const program = BytesBlob.parseBlob(programHex);

    const initialGas = tryAsGas(1000);
    const pvm = new Interpreter();
    pvm.resetGeneric(program.raw, 0, initialGas);
    pvm.runProgram();

    // Check remaining gas after execution
    const remainingGas = pvm.gas.get();

    // Gas should have been consumed
    assert.ok(remainingGas < initialGas);
    // <!-- /example:pvm-gas -->
  });
});

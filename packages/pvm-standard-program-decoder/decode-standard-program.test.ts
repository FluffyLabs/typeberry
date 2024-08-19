import { describe, it } from "node:test";
import assert from "node:assert";
import { decodeStandardProgram } from "./decode-standard-program";

const O_LENGTH = new Uint8Array([0x04, 0x00, 0x00]); // E_3(|o|) = 04 00 00
const W_LENGTH = new Uint8Array([0x02, 0x00, 0x00]); // E_3(|w|) = 02 00 00
const Z = new Uint8Array([0x03, 0x00]); // E_2(z) = 03 00
const STACK_SIZE = new Uint8Array([0x20, 0x00, 0x00]); // E_3(s) = 20 00 00
const O = new Uint8Array([0xab, 0xcd, 0xef, 0x01]); // o = AB CD EF 01
const W = new Uint8Array([0x12, 0x34]); // w = 12 34
const C_LENGTH = new Uint8Array([0x06, 0x00, 0x00, 0x00]); // E_4(|c|) = 06 00 00 00
const C = new Uint8Array([0x12, 0x34, 0x56, 0x78, 0x9a, 0xbc]); // c = 12 34 56 78 9A BC

const PROGRAM = new Uint8Array([...O_LENGTH, ...W_LENGTH, ...Z, ...STACK_SIZE, ...O, ...W, ...C_LENGTH, ...C]);
const ARGS = new Uint8Array([0x1, 0x2, 0x3]);

describe("decodeStandardProgram", () => {
  const decodedProgram = decodeStandardProgram(PROGRAM, ARGS);

    it("should exctract code correctly", () => {
        assert.deepStrictEqual(decodedProgram.code, C);
    });

    it("should write args length to 12th register", () => {
        const registerIndex = 11;

        assert.strictEqual(decodedProgram.registers[registerIndex], ARGS.length);
    });

    it("should prepare readable memory segments", () => {
        const expectedMemory = [
            {
              start: 65536,
              end: 65540,
              data: O
            },
            { start: 65540, end: 81920, data: null },
            {
              start: 4278124544,
              end: 4278124547,
              data: ARGS
            },
            { start: 4278124547, end: 4278140931, data: null }
          ];

          assert.deepStrictEqual(decodedProgram.memory.readable, expectedMemory);
    });

    it("should prepare writeable memory segments", () => {
        const expectedMemory = [
            { start: 196608, end: 196610, data: W },
            { start: 196610, end: 262144, data: null },
            { start: 4278042624, end: 4278059008, data: null }
          ]

          assert.deepStrictEqual(decodedProgram.memory.writeable, expectedMemory);
    });

    it("sbrkIndex", () => {
        const expectedSbreak = 262144;

        assert.strictEqual(decodedProgram.memory.sbrkIndex, expectedSbreak);
    });
});

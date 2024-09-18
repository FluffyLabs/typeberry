import { add, complete, configure, cycle, save, suite } from "@typeberry/benchmark/setup";

function parseByteFromCharCodes(s: string): number {
  const a = parseCharCode(s.charCodeAt(0));
  const b = parseCharCode(s.charCodeAt(1));
  return (a << 8) | b;
}

const CODE_OF_0 = "0".charCodeAt(0);
const CODE_OF_9 = "9".charCodeAt(0);
const CODE_OF_a = "a".charCodeAt(0);
const CODE_OF_f = "f".charCodeAt(0);
const CODE_OF_A = "A".charCodeAt(0);
const CODE_OF_F = "F".charCodeAt(0);

function parseCharCode(x: number) {
  if (x >= CODE_OF_0 && x <= CODE_OF_9) {
    return x - CODE_OF_0;
  }

  if (x >= CODE_OF_a && x <= CODE_OF_f) {
    return 10 + x - CODE_OF_a;
  }

  if (x >= CODE_OF_A && x <= CODE_OF_F) {
    return 10 + x - CODE_OF_A;
  }

  throw new Error(`Invalid characters in hex byte string: ${String.fromCharCode(x)}`);
}

function parseByteFromNibbles(s: string): number {
  return (parseNibble(s[0]) << 4) | parseNibble(s[1]);
}
function parseNibble(n: string): number {
  switch (n) {
    case "0":
      return 0;
    case "1":
      return 1;
    case "2":
      return 2;
    case "3":
      return 3;
    case "4":
      return 4;
    case "5":
      return 5;
    case "6":
      return 6;
    case "7":
      return 7;
    case "8":
      return 8;
    case "9":
      return 9;
    case "A":
    case "a":
      return 10;
    case "B":
    case "b":
      return 11;
    case "C":
    case "c":
      return 12;
    case "D":
    case "d":
      return 13;
    case "E":
    case "e":
      return 14;
    case "F":
    case "f":
      return 15;
    default:
      throw new Error(`Invalid nibble: ${n}`);
  }
}

const data: string[] = [];
const size = 256;
for (let i = 0; i < size; i += 1) {
  data.push((i % 256).toString(16).padStart(2, "0"));
}

module.exports = () =>
  suite(
    "Bytes / hex parsing",

    add("parse hex using `Number` with NaN checking", () => {
      return data.map((byte) => {
        const n = Number(`0x${byte}`);
        if (Number.isNaN(n)) {
          throw new Error("Not a number");
        }
      });
    }),

    add("parse hex from char codes", () => {
      return data.map((byte) => parseByteFromCharCodes(byte));
    }),

    add("parse hex from string nibbles", () => {
      return data.map((byte) => parseByteFromNibbles(byte));
    }),

    cycle(),
    complete(),
    configure({}),
    ...save(__filename),
  );

if (require.main === module) {
  module.exports();
}

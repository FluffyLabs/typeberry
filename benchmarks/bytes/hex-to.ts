import { add, complete, configure, cycle, save, suite } from "@typeberry/benchmark/setup";

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
    return x - CODE_OF_a;
  }

  if (x >= CODE_OF_A && x <= CODE_OF_F) {
    return x - CODE_OF_A;
  }

  throw new Error(`Invalid characters in hex byte string: ${String.fromCharCode(x)}`);
}

const size = 256;
const data: number[] = [];
for (let i = 0; i < size; i += 1) {
  data.push(i);
}

function byteToHexString(byte: number): string {
  const nibbleToString = (n: number) => {
    if (n > 9) {
      return String.fromCharCode(n + CODE_OF_a);
    }
    return String.fromCharCode(n + CODE_OF_0);
  };

  return `${nibbleToString(byte >>> 4)}${nibbleToString(byte & 0xf)}`;
}

module.exports = () =>
  suite(
    "Bytes / into hex",

    add("number toString + padding", () => {
      return data.map((byte) => byte.toString(16).padStart(2, "0"));
    }),

    add("manual", () => {
      return data.map((byte) => byteToHexString(byte));
    }),

    cycle(),
    complete(),
    configure({}),
    ...save(__filename),
  );

if (require.main === module) {
  module.exports();
}

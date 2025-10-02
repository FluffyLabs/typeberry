import { pathToFileURL } from "node:url";
import { add, complete, configure, cycle, save, suite } from "@typeberry/benchmark/setup.js";
import { Logger } from "@typeberry/logger";

const HASH_LENGTH: number = 32;
const logger = Logger.new(import.meta.filename, "hash");

type ByteHash = Byte[];
type NumberHash = number[];
type StringHash = string[];
type PackedNumberHash = number[];
type BigIntHash = bigint[];

function generateHash<T>(convert: (n: number) => T): T[] {
  const result: T[] = [];
  for (let i = 0; i < HASH_LENGTH; i += 1) {
    const val = convert(Math.floor(Math.random() * 255));
    result.push(val);
  }
  return result;
}

function generateNumberHash(): NumberHash {
  return generateHash((n) => n);
}

function generateStringHash(): StringHash {
  return generateHash((byte) => {
    return byte.toString(16);
  });
}

function generateByteHash(): ByteHash {
  return generateHash((byte) => {
    const val = `x${byte.toString(16).padStart(2, "0")}`;
    // biome-ignore lint/security/noGlobalEval: Having a large switch is no-go.
    return eval(val);
  });
}

function generateUintHash(): Uint8Array {
  const hash = new Uint8Array(HASH_LENGTH);
  for (let i = 0; i < HASH_LENGTH; i += 1) {
    const val = Math.floor(Math.random() * 255);
    hash[i] = val;
  }
  return hash;
}

function generatePackedHash(): PackedNumberHash {
  const r = () => Math.floor(Math.random() * 255);
  const hash: PackedNumberHash = [];
  for (let i = 0; i < HASH_LENGTH / 4; i += 1) {
    let num = r();
    num = (num << 8) + r();
    num = (num << 8) + r();
    num = (num << 8) + r();
    hash.push(num);
  }
  return hash;
}

function generateBigIntHash(): BigIntHash {
  const r = () => BigInt(Math.floor(Math.random() * 255));
  const hash: BigIntHash = [];
  for (let i = 0; i < HASH_LENGTH / 8; i += 1) {
    let num = r();
    for (let j = 0; j < 7; j += 1) {
      num = (num << 8n) + r();
    }
    hash.push(num);
  }

  return hash;
}

function generateUint32Hash(): Uint32Array {
  const r = () => Math.floor(Math.random() * 255);
  const hash = new Uint32Array(HASH_LENGTH / 4);
  for (let i = 0; i < HASH_LENGTH / 4; i += 1) {
    let num = r();
    num = (num << 8) + r();
    num = (num << 8) + r();
    num = (num << 8) + r();
    hash[i] = num;
  }
  return hash;
}

function generate<T>(name: string, f: () => T): T[] {
  const start = process.memoryUsage();
  const result: T[] = [];
  for (let i = 0; i < 2 ** 10; i += 1) {
    result.push(f());
  }
  const end = process.memoryUsage();
  logger.log`[${name}] mem diff: ${Math.round(((start.heapUsed - end.heapUsed) / 1024 / 1024) * 100) / 100}MB`;
  return result;
}

function compareInLine8<T>(a: ArrayLike<T>, b: ArrayLike<T>) {
  return (
    a[0] === b[0] &&
    a[1] === b[1] &&
    a[2] === b[2] &&
    a[3] === b[3] &&
    a[4] === b[4] &&
    a[5] === b[5] &&
    a[6] === b[6] &&
    a[7] === b[7]
  );
}

function compareInLine4<T>(a: ArrayLike<T>, b: ArrayLike<T>) {
  return a[0] === b[0] && a[1] === b[1] && a[2] === b[2] && a[3] === b[3];
}

function isSame<T>(a: ArrayLike<T>, b: ArrayLike<T>) {
  const len = a.length;
  for (let idx = 0; idx < len; idx += 1) {
    if (a[idx] !== b[idx]) {
      return false;
    }
  }

  return true;
}

function findDuplicates<T>(list: ArrayLike<T>[], compare = isSame): ArrayLike<T>[] {
  const found: ArrayLike<T>[] = [];

  for (const a of list) {
    for (const b of list) {
      if (compare(a, b)) {
        found.push(a);
      }
    }
  }

  return found;
}

export default function run() {
  return suite(
    "Hash + Symbols",

    add("hash with numeric representation", () => {
      const hashes = generate("numeric", generateNumberHash);
      return () => {
        findDuplicates(hashes);
      };
    }),

    add("hash with string representation", () => {
      const hashes = generate("string", generateStringHash);
      return () => {
        findDuplicates(hashes);
      };
    }),

    add("hash with symbol representation", () => {
      const hashes = generate("symbol", generateByteHash);
      return () => {
        findDuplicates(hashes);
      };
    }),

    add("hash with uint8 representation", () => {
      const hashes = generate("uint", generateUintHash);
      return () => {
        findDuplicates(hashes);
      };
    }),

    add("hash with packed representation", () => {
      const hashes = generate("packed", generatePackedHash);
      const compare = HASH_LENGTH === 32 ? compareInLine8 : HASH_LENGTH === 16 ? compareInLine4 : isSame;
      return () => {
        findDuplicates(hashes, compare);
      };
    }),

    add("hash with bigint representation", () => {
      const hashes = generate("bigint", generateBigIntHash);
      const compare = HASH_LENGTH === 64 ? compareInLine8 : HASH_LENGTH === 32 ? compareInLine4 : isSame;
      return () => {
        findDuplicates(hashes, compare);
      };
    }),

    add("hash with uint32 representation", () => {
      const hashes = generate("uint32", generateUint32Hash);
      const compare = HASH_LENGTH === 32 ? compareInLine8 : HASH_LENGTH === 16 ? compareInLine4 : isSame;

      return () => {
        findDuplicates(hashes, compare);
      };
    }),

    cycle(),
    complete(),
    configure({}),
    ...save(import.meta.filename),
  );
}

const x00 = Symbol("0x00");
const x01 = Symbol("0x01");
const x02 = Symbol("0x02");
const x03 = Symbol("0x03");
const x04 = Symbol("0x04");
const x05 = Symbol("0x05");
const x06 = Symbol("0x06");
const x07 = Symbol("0x07");
const x08 = Symbol("0x08");
const x09 = Symbol("0x09");
const x0a = Symbol("0x0a");
const x0b = Symbol("0x0b");
const x0c = Symbol("0x0c");
const x0d = Symbol("0x0d");
const x0e = Symbol("0x0e");
const x0f = Symbol("0x0f");
const x10 = Symbol("0x10");
const x11 = Symbol("0x11");
const x12 = Symbol("0x12");
const x13 = Symbol("0x13");
const x14 = Symbol("0x14");
const x15 = Symbol("0x15");
const x16 = Symbol("0x16");
const x17 = Symbol("0x17");
const x18 = Symbol("0x18");
const x19 = Symbol("0x19");
const x1a = Symbol("0x1a");
const x1b = Symbol("0x1b");
const x1c = Symbol("0x1c");
const x1d = Symbol("0x1d");
const x1e = Symbol("0x1e");
const x1f = Symbol("0x1f");
const x20 = Symbol("0x20");
const x21 = Symbol("0x21");
const x22 = Symbol("0x22");
const x23 = Symbol("0x23");
const x24 = Symbol("0x24");
const x25 = Symbol("0x25");
const x26 = Symbol("0x26");
const x27 = Symbol("0x27");
const x28 = Symbol("0x28");
const x29 = Symbol("0x29");
const x2a = Symbol("0x2a");
const x2b = Symbol("0x2b");
const x2c = Symbol("0x2c");
const x2d = Symbol("0x2d");
const x2e = Symbol("0x2e");
const x2f = Symbol("0x2f");
const x30 = Symbol("0x30");
const x31 = Symbol("0x31");
const x32 = Symbol("0x32");
const x33 = Symbol("0x33");
const x34 = Symbol("0x34");
const x35 = Symbol("0x35");
const x36 = Symbol("0x36");
const x37 = Symbol("0x37");
const x38 = Symbol("0x38");
const x39 = Symbol("0x39");
const x3a = Symbol("0x3a");
const x3b = Symbol("0x3b");
const x3c = Symbol("0x3c");
const x3d = Symbol("0x3d");
const x3e = Symbol("0x3e");
const x3f = Symbol("0x3f");
const x40 = Symbol("0x40");
const x41 = Symbol("0x41");
const x42 = Symbol("0x42");
const x43 = Symbol("0x43");
const x44 = Symbol("0x44");
const x45 = Symbol("0x45");
const x46 = Symbol("0x46");
const x47 = Symbol("0x47");
const x48 = Symbol("0x48");
const x49 = Symbol("0x49");
const x4a = Symbol("0x4a");
const x4b = Symbol("0x4b");
const x4c = Symbol("0x4c");
const x4d = Symbol("0x4d");
const x4e = Symbol("0x4e");
const x4f = Symbol("0x4f");
const x50 = Symbol("0x50");
const x51 = Symbol("0x51");
const x52 = Symbol("0x52");
const x53 = Symbol("0x53");
const x54 = Symbol("0x54");
const x55 = Symbol("0x55");
const x56 = Symbol("0x56");
const x57 = Symbol("0x57");
const x58 = Symbol("0x58");
const x59 = Symbol("0x59");
const x5a = Symbol("0x5a");
const x5b = Symbol("0x5b");
const x5c = Symbol("0x5c");
const x5d = Symbol("0x5d");
const x5e = Symbol("0x5e");
const x5f = Symbol("0x5f");
const x60 = Symbol("0x60");
const x61 = Symbol("0x61");
const x62 = Symbol("0x62");
const x63 = Symbol("0x63");
const x64 = Symbol("0x64");
const x65 = Symbol("0x65");
const x66 = Symbol("0x66");
const x67 = Symbol("0x67");
const x68 = Symbol("0x68");
const x69 = Symbol("0x69");
const x6a = Symbol("0x6a");
const x6b = Symbol("0x6b");
const x6c = Symbol("0x6c");
const x6d = Symbol("0x6d");
const x6e = Symbol("0x6e");
const x6f = Symbol("0x6f");
const x70 = Symbol("0x70");
const x71 = Symbol("0x71");
const x72 = Symbol("0x72");
const x73 = Symbol("0x73");
const x74 = Symbol("0x74");
const x75 = Symbol("0x75");
const x76 = Symbol("0x76");
const x77 = Symbol("0x77");
const x78 = Symbol("0x78");
const x79 = Symbol("0x79");
const x7a = Symbol("0x7a");
const x7b = Symbol("0x7b");
const x7c = Symbol("0x7c");
const x7d = Symbol("0x7d");
const x7e = Symbol("0x7e");
const x7f = Symbol("0x7f");
const x80 = Symbol("0x80");
const x81 = Symbol("0x81");
const x82 = Symbol("0x82");
const x83 = Symbol("0x83");
const x84 = Symbol("0x84");
const x85 = Symbol("0x85");
const x86 = Symbol("0x86");
const x87 = Symbol("0x87");
const x88 = Symbol("0x88");
const x89 = Symbol("0x89");
const x8a = Symbol("0x8a");
const x8b = Symbol("0x8b");
const x8c = Symbol("0x8c");
const x8d = Symbol("0x8d");
const x8e = Symbol("0x8e");
const x8f = Symbol("0x8f");
const x90 = Symbol("0x90");
const x91 = Symbol("0x91");
const x92 = Symbol("0x92");
const x93 = Symbol("0x93");
const x94 = Symbol("0x94");
const x95 = Symbol("0x95");
const x96 = Symbol("0x96");
const x97 = Symbol("0x97");
const x98 = Symbol("0x98");
const x99 = Symbol("0x99");
const x9a = Symbol("0x9a");
const x9b = Symbol("0x9b");
const x9c = Symbol("0x9c");
const x9d = Symbol("0x9d");
const x9e = Symbol("0x9e");
const x9f = Symbol("0x9f");
const xa0 = Symbol("0xa0");
const xa1 = Symbol("0xa1");
const xa2 = Symbol("0xa2");
const xa3 = Symbol("0xa3");
const xa4 = Symbol("0xa4");
const xa5 = Symbol("0xa5");
const xa6 = Symbol("0xa6");
const xa7 = Symbol("0xa7");
const xa8 = Symbol("0xa8");
const xa9 = Symbol("0xa9");
const xaa = Symbol("0xaa");
const xab = Symbol("0xab");
const xac = Symbol("0xac");
const xad = Symbol("0xad");
const xae = Symbol("0xae");
const xaf = Symbol("0xaf");
const xb0 = Symbol("0xb0");
const xb1 = Symbol("0xb1");
const xb2 = Symbol("0xb2");
const xb3 = Symbol("0xb3");
const xb4 = Symbol("0xb4");
const xb5 = Symbol("0xb5");
const xb6 = Symbol("0xb6");
const xb7 = Symbol("0xb7");
const xb8 = Symbol("0xb8");
const xb9 = Symbol("0xb9");
const xba = Symbol("0xba");
const xbb = Symbol("0xbb");
const xbc = Symbol("0xbc");
const xbd = Symbol("0xbd");
const xbe = Symbol("0xbe");
const xbf = Symbol("0xbf");
const xc0 = Symbol("0xc0");
const xc1 = Symbol("0xc1");
const xc2 = Symbol("0xc2");
const xc3 = Symbol("0xc3");
const xc4 = Symbol("0xc4");
const xc5 = Symbol("0xc5");
const xc6 = Symbol("0xc6");
const xc7 = Symbol("0xc7");
const xc8 = Symbol("0xc8");
const xc9 = Symbol("0xc9");
const xca = Symbol("0xca");
const xcb = Symbol("0xcb");
const xcc = Symbol("0xcc");
const xcd = Symbol("0xcd");
const xce = Symbol("0xce");
const xcf = Symbol("0xcf");
const xd0 = Symbol("0xd0");
const xd1 = Symbol("0xd1");
const xd2 = Symbol("0xd2");
const xd3 = Symbol("0xd3");
const xd4 = Symbol("0xd4");
const xd5 = Symbol("0xd5");
const xd6 = Symbol("0xd6");
const xd7 = Symbol("0xd7");
const xd8 = Symbol("0xd8");
const xd9 = Symbol("0xd9");
const xda = Symbol("0xda");
const xdb = Symbol("0xdb");
const xdc = Symbol("0xdc");
const xdd = Symbol("0xdd");
const xde = Symbol("0xde");
const xdf = Symbol("0xdf");
const xe0 = Symbol("0xe0");
const xe1 = Symbol("0xe1");
const xe2 = Symbol("0xe2");
const xe3 = Symbol("0xe3");
const xe4 = Symbol("0xe4");
const xe5 = Symbol("0xe5");
const xe6 = Symbol("0xe6");
const xe7 = Symbol("0xe7");
const xe8 = Symbol("0xe8");
const xe9 = Symbol("0xe9");
const xea = Symbol("0xea");
const xeb = Symbol("0xeb");
const xec = Symbol("0xec");
const xed = Symbol("0xed");
const xee = Symbol("0xee");
const xef = Symbol("0xef");
const xf0 = Symbol("0xf0");
const xf1 = Symbol("0xf1");
const xf2 = Symbol("0xf2");
const xf3 = Symbol("0xf3");
const xf4 = Symbol("0xf4");
const xf5 = Symbol("0xf5");
const xf6 = Symbol("0xf6");
const xf7 = Symbol("0xf7");
const xf8 = Symbol("0xf8");
const xf9 = Symbol("0xf9");
const xfa = Symbol("0xfa");
const xfb = Symbol("0xfb");
const xfc = Symbol("0xfc");
const xfd = Symbol("0xfd");
const xfe = Symbol("0xfe");
const xff = Symbol("0xff");

type Byte =
  | typeof x00
  | typeof x01
  | typeof x02
  | typeof x03
  | typeof x04
  | typeof x05
  | typeof x06
  | typeof x07
  | typeof x08
  | typeof x09
  | typeof x0a
  | typeof x0b
  | typeof x0c
  | typeof x0d
  | typeof x0e
  | typeof x0f
  | typeof x10
  | typeof x11
  | typeof x12
  | typeof x13
  | typeof x14
  | typeof x15
  | typeof x16
  | typeof x17
  | typeof x18
  | typeof x19
  | typeof x1a
  | typeof x1b
  | typeof x1c
  | typeof x1d
  | typeof x1e
  | typeof x1f
  | typeof x20
  | typeof x21
  | typeof x22
  | typeof x23
  | typeof x24
  | typeof x25
  | typeof x26
  | typeof x27
  | typeof x28
  | typeof x29
  | typeof x2a
  | typeof x2b
  | typeof x2c
  | typeof x2d
  | typeof x2e
  | typeof x2f
  | typeof x30
  | typeof x31
  | typeof x32
  | typeof x33
  | typeof x34
  | typeof x35
  | typeof x36
  | typeof x37
  | typeof x38
  | typeof x39
  | typeof x3a
  | typeof x3b
  | typeof x3c
  | typeof x3d
  | typeof x3e
  | typeof x3f
  | typeof x40
  | typeof x41
  | typeof x42
  | typeof x43
  | typeof x44
  | typeof x45
  | typeof x46
  | typeof x47
  | typeof x48
  | typeof x49
  | typeof x4a
  | typeof x4b
  | typeof x4c
  | typeof x4d
  | typeof x4e
  | typeof x4f
  | typeof x50
  | typeof x51
  | typeof x52
  | typeof x53
  | typeof x54
  | typeof x55
  | typeof x56
  | typeof x57
  | typeof x58
  | typeof x59
  | typeof x5a
  | typeof x5b
  | typeof x5c
  | typeof x5d
  | typeof x5e
  | typeof x5f
  | typeof x60
  | typeof x61
  | typeof x62
  | typeof x63
  | typeof x64
  | typeof x65
  | typeof x66
  | typeof x67
  | typeof x68
  | typeof x69
  | typeof x6a
  | typeof x6b
  | typeof x6c
  | typeof x6d
  | typeof x6e
  | typeof x6f
  | typeof x70
  | typeof x71
  | typeof x72
  | typeof x73
  | typeof x74
  | typeof x75
  | typeof x76
  | typeof x77
  | typeof x78
  | typeof x79
  | typeof x7a
  | typeof x7b
  | typeof x7c
  | typeof x7d
  | typeof x7e
  | typeof x7f
  | typeof x80
  | typeof x81
  | typeof x82
  | typeof x83
  | typeof x84
  | typeof x85
  | typeof x86
  | typeof x87
  | typeof x88
  | typeof x89
  | typeof x8a
  | typeof x8b
  | typeof x8c
  | typeof x8d
  | typeof x8e
  | typeof x8f
  | typeof x90
  | typeof x91
  | typeof x92
  | typeof x93
  | typeof x94
  | typeof x95
  | typeof x96
  | typeof x97
  | typeof x98
  | typeof x99
  | typeof x9a
  | typeof x9b
  | typeof x9c
  | typeof x9d
  | typeof x9e
  | typeof x9f
  | typeof xa0
  | typeof xa1
  | typeof xa2
  | typeof xa3
  | typeof xa4
  | typeof xa5
  | typeof xa6
  | typeof xa7
  | typeof xa8
  | typeof xa9
  | typeof xaa
  | typeof xab
  | typeof xac
  | typeof xad
  | typeof xae
  | typeof xaf
  | typeof xb0
  | typeof xb1
  | typeof xb2
  | typeof xb3
  | typeof xb4
  | typeof xb5
  | typeof xb6
  | typeof xb7
  | typeof xb8
  | typeof xb9
  | typeof xba
  | typeof xbb
  | typeof xbc
  | typeof xbd
  | typeof xbe
  | typeof xbf
  | typeof xc0
  | typeof xc1
  | typeof xc2
  | typeof xc3
  | typeof xc4
  | typeof xc5
  | typeof xc6
  | typeof xc7
  | typeof xc8
  | typeof xc9
  | typeof xca
  | typeof xcb
  | typeof xcc
  | typeof xcd
  | typeof xce
  | typeof xcf
  | typeof xd0
  | typeof xd1
  | typeof xd2
  | typeof xd3
  | typeof xd4
  | typeof xd5
  | typeof xd6
  | typeof xd7
  | typeof xd8
  | typeof xd9
  | typeof xda
  | typeof xdb
  | typeof xdc
  | typeof xdd
  | typeof xde
  | typeof xdf
  | typeof xe0
  | typeof xe1
  | typeof xe2
  | typeof xe3
  | typeof xe4
  | typeof xe5
  | typeof xe6
  | typeof xe7
  | typeof xe8
  | typeof xe9
  | typeof xea
  | typeof xeb
  | typeof xec
  | typeof xed
  | typeof xee
  | typeof xef
  | typeof xf0
  | typeof xf1
  | typeof xf2
  | typeof xf3
  | typeof xf4
  | typeof xf5
  | typeof xf6
  | typeof xf7
  | typeof xf8
  | typeof xf9
  | typeof xfa
  | typeof xfb
  | typeof xfc
  | typeof xfd
  | typeof xfe
  | typeof xff;

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  run();
}

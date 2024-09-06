import { Buffer } from "buffer";
import { check } from "@typeberry/utils";

// TODO:
// 1. Change underlying structure of TestDesc to buffer, because sometimes we
// want to use Uint8 and sometimes Uint32 and it affects performance
// 2. Test bloom filters
// 3. Finish base64 key
// 4. Merge all structures to create something efficient (if we want it)
//
// Important questions:
// 1. What is distribution of key prefix? Is it some uniform distribution? If yes, then first
// 4-6 bytes are great hash of key
// 2.

class Bytes32 {
  array = new Uint32Array(8);

  constructor(array: Uint8Array, index: number) {
    for (let i = 0; i < 8; i++) {
      var idx = i * 4 + index;

      // TODO change to Uint32Array
      this.array[i] = (array[idx] << 24) + (array[idx + 1] << 16) + (array[idx + 2] << 8) + array[idx + 3];
    }

    //		console.log("Created");
    //		this.print();
  }

  hash() {
    var ret = this.array[0];
    for (let i = 1; i < this.array.length; i++) ret ^= this.array[i];

    return ret;
  }

  toNumber() {
    var ret = this.array[0];

    for (let i = 1; i < 8; i++) {
      ret *= 1 << 32;
      ret += this.array[i];
    }
    return ret;
  }

  toBigInt()
  {
    var ret = BigInt(this.array[0]);

    for (let i = 1; i < 8; i++) {
      ret *= BigInt(1 << 32);
      ret += BigInt(this.array[i]);
    }
    return ret;
  }

  static compare(a: Bytes32, b: Bytes32) {
    for (let i = 0; i < 8; i++) {
      var diff = a.array[i] - b.array[i];
      if (diff != 0) return diff;
    }
    return 0;
  }

  print() {
    var str = "";
    for (let i = 0; i < 8; i++) {
      str += this.array[i];
    }

    console.log(str);
  }
}

// Interface used by TestDesc
interface TestMapInterface {
  insert(array: Uint8Array, index: number, count: number): void;
  commitInserts(): void;
  query(array: Uint8Array, index: number, count: number): number;
}

class MapStructure implements TestMapInterface {
  map: Map<number, number> = new Map<number, number>();

  insert(array: Uint8Array, index: number, count: number) {
    var key = (array[index] << 24) + (array[index + 1] << 16) + (array[index + 2] << 8) + array[index + 3];

    //		console.log("insert: " + key);

    this.map.set(key, 1);
  }

  commitInserts() {}

  query(array: Uint8Array, index: number, count: number) {
    var key = (array[index] << 24) + (array[index + 1] << 16) + (array[index + 2] << 8) + array[index + 3];

    //		console.log("query: " + key);

    if (this.map.has(key)) return 1;

    return 0;
  }
}

class MultiMapNumber implements TestMapInterface {
  map = new Map<number, Map<number, Map<number, Map<number, Map<number, Map<number, number>>>>>>();

  insert(array: Uint8Array, index: number, count: number) {
    var keys: number[] = [];

    for (let i = 0; i < 6; i++) {
      var idx = i * 6;

      var shift = 8 * 5;
      var key = 0;
      for (let j = 0; j < 6; j++) {
        if (idx + j < count) key += array[index + idx + j] << shift;
        shift -= 8;
      }

      keys.push(key);
    }

    // TODO I think there is a better way to implement that
    if (!this.map.has(keys[0])) {
      this.map.set(keys[0], new Map<number, Map<number, Map<number, Map<number, Map<number, number>>>>>());
    }
    if (!this.map.get(keys[0])!.has(keys[1])) {
      this.map.get(keys[0])!.set(keys[1], new Map<number, Map<number, Map<number, Map<number, number>>>>());
    }
    if (!this.map.get(keys[0])!.get(keys[1])!.has(keys[2])) {
      this.map.get(keys[0])!.get(keys[1])!.set(keys[2], new Map<number, Map<number, Map<number, number>>>());
    }
    if (!this.map.get(keys[0])!.get(keys[1])!.get(keys[2])!.has(keys[3])) {
      this.map.get(keys[0])!.get(keys[1])!.get(keys[2])!.set(keys[3], new Map<number, Map<number, number>>());
    }
    if (!this.map.get(keys[0])!.get(keys[1])!.get(keys[2])!.get(keys[3])!.has(keys[4])) {
      this.map.get(keys[0])!.get(keys[1])!.get(keys[2])!.get(keys[3])!.set(keys[4], new Map<number, number>());
    }
    if (!this.map.get(keys[0])!.get(keys[1])!.get(keys[2])!.get(keys[3])!.get(keys[4])!.has(keys[5])) {
      this.map.get(keys[0])!.get(keys[1])!.get(keys[2])!.get(keys[3])!.get(keys[4])!.set(keys[5], 1);
    }

    /*var key = (array[index] << 24) + (array[index+1] << 16) + (array[index+2] << 8) + array[index+3];

//              console.log("insert: " + key);

                this.map.set(key, 1);*/
  }

  commitInserts() {}

  query(array: Uint8Array, index: number, count: number) {
    var keys: number[] = [];

    for (let i = 0; i < 6; i++) {
      var idx = i * 6;

      var shift = 8 * 5;
      var key = 0;
      for (let j = 0; j < 6; j++) {
        if (idx + j < count) key += array[index + idx + j] << shift;
        shift -= 8;
      }

      keys.push(key);
    }

    // TODO I believe there is a better way to implement it
    if (!this.map.has(keys[0])) {
      return 0;
    }
    if (!this.map.get(keys[0])!.has(keys[1])) {
      return 0;
    }
    if (!this.map.get(keys[0])!.get(keys[1])!.has(keys[2])) {
      return 0;
    }
    if (!this.map.get(keys[0])!.get(keys[1])!.get(keys[2])!.has(keys[3])) {
      return 0;
    }
    if (!this.map.get(keys[0])!.get(keys[1])!.get(keys[2])!.get(keys[3])!.has(keys[4])) {
      return 0;
    }
    if (!this.map.get(keys[0])!.get(keys[1])!.get(keys[2])!.get(keys[3])!.get(keys[4])!.has(keys[5])) {
      return 0;
    }

    return 1;
  }
}

function bytesToHexStringExtended(buffer: Uint8Array, index: number, count: number): string {
  // TODO [ToDr] consider using TextDecoder API?
  let s = "0x";
  for (let i = 0; i < count; i++) {
    s += buffer[index + i].toString(16).padStart(2, "0");
  }
  return s;
}

class MapString implements TestMapInterface {
  map: Map<string, number> = new Map<string, number>();

  insert(array: Uint8Array, index: number, count: number) {
    var key = bytesToHexStringExtended(array, index, count);
    //                var key = (array[index] << 24) + (array[index+1] << 16) + (array[index+2] << 8) + array[index];

    //              console.log("insert: " + key);

    this.map.set(key, 1);
  }

  commitInserts() {}

  query(array: Uint8Array, index: number, count: number) {
    var key = bytesToHexStringExtended(array, index, count);
    //                var key = (array[index] << 24) + (array[index+1] << 16) + (array[index+2] << 8) + array[index];

    //              console.log("query: " + key);

    if (this.map.has(key)) return 1;

    return 0;
  }
}

// TODO
class MapBase64 implements TestMapInterface {
  map: Map<string, number> = new Map<string, number>();

  insert(array: Uint8Array, index: number, count: number) {
    // TODO assert count == 32
    var bytes = new Bytes32(array, index);
    var key = atob(new TextDecoder().decode(bytes.array));
    this.map.set(key, 1);
  }

  commitInserts() {}

  query(array: Uint8Array, index: number, count: number) {
    var bytes = new Bytes32(array, index);
    // TODO btoa expects string
    var key = atob(new TextDecoder().decode(bytes.array));

    if (this.map.has(key)) return 1;

    return 0;
  }
}

class MapHash implements TestMapInterface {
  map: Map<number, BigInt[]> = new Map<number, BigInt[]>();

  insert(array: Uint8Array, index: number, count: number) {
    // TODO assert count == 32
    var bytes = new Bytes32(array, index);
    var key = bytes.hash();
    if (this.map.has(key)) this.map.get(key)!.push(bytes.toBigInt());
    else this.map.set(key, [bytes.toBigInt()]);
  }

  commitInserts() {}

  query(array: Uint8Array, index: number, count: number) {
    // TODO assert count == 32
    var bytes = new Bytes32(array, index);
    var key = bytes.hash();

    if (this.map.has(key)) {
      var idx = this.map.get(key)!.indexOf(bytes.toBigInt());
      if (idx == -1) return 0;
      return 1;
    }

    return 0;
  }
}

class SimpleHash implements TestMapInterface {
  array: Array<Boolean> = [];

  constructor() {
    for (let i = 0; i < 100000000; i++) this.array.push(false);
  }

  insert(array: Uint8Array, index: number, count: number) {
    var hash = 0;
    // TODO assert count == 32
    for (let i = 0; i < 8; i++) {
      var idx = i * 4 + index;
      var sub_val = (array[idx] << 24) + (array[idx + 1] << 16) + (array[idx + 2] << 8) + array[idx];

      hash ^= sub_val;
    }
    hash %= 100000000;
    this.array[hash] = true;
  }

  commitInserts() {}

  query(array: Uint8Array, index: number, count: number) {
    var hash = 0;
    // TODO assert count == 32
    for (let i = 0; i < 8; i++) {
      var idx = i * 4 + index;
      var sub_val = (array[idx] << 24) + (array[idx + 1] << 16) + (array[idx + 2] << 8) + array[idx];

      hash ^= sub_val;
    }
    hash %= 100000000;

    if (this.array[hash]) return 1;
    return 0;
  }
}

class ArrayNumber implements TestMapInterface {
  array: Array<number> = [];

  insert(array: Uint8Array, index: number, count: number) {
    var key = (array[index] << 24) + (array[index + 1] << 16) + (array[index + 2] << 8) + array[index + 3];

    this.array.push(key);
  }

  commitInserts() {
    this.array.sort((n1, n2) => n1 - n2);
    // surprising
    //	this.array.sort();
  }

  query(array: Uint8Array, index: number, count: number) {
    var key = (array[index] << 24) + (array[index + 1] << 16) + (array[index + 2] << 8) + array[index + 3];

    return this.binarySearch(this.array, key);
  }

  binarySearch(array: number[], needle: number) {
    var begin = 0;
    var end = array.length;

    while (end - begin > 1) {
      // TODO we seriously need to do floating operation here? :P
      var mid = Math.floor((begin + end) / 2);

      if (array[mid] > needle) end = mid;
      else begin = mid;
    }

    //		console.log("begin: " + begin);
    if (array[begin] == needle) return 1;
    else return 0;
  }
}

class ArrayBigNumber implements TestMapInterface {
  array: Array<BigInt> = [];

  insert(array: Uint8Array, index: number, count: number) {
    var key = BigInt(0);
    for (let i = 0; i < count; i++) {
      key *= 256n;
      key += BigInt(array[index + i]);
    }

    this.array.push(key);
  }

  commitInserts() {
    this.array.sort((n1: BigInt, n2: BigInt) => {
      if (n1 > n2) return 1;
      else if (n1 < n2) return -1;
      else return 0;
    });

    //		for(let i =0;i < this.array.length;i++)
    //		{
    //			console.log(this.array[i]);
    //		}
    // surprising
    //	this.array.sort();
  }

  query(array: Uint8Array, index: number, count: number) {
    var key = BigInt(0);
    for (let i = 0; i < count; i++) {
      key *= 256n;
      key += BigInt(array[index + i]);
    }

    return this.binarySearch(this.array, key);
  }

  binarySearch(array: BigInt[], needle: BigInt) {
    var begin = 0;
    var end = array.length;

    while (end - begin > 1) {
      // TODO we seriously need to do floating operation here? :P
      var mid = Math.floor((begin + end) / 2);

      if (array[mid] > needle) end = mid;
      else begin = mid;
    }

    //		console.log("begin: " + begin);
    if (array[begin] == needle) return 1;
    else return 0;
  }
}

class ArrayBytes32 {
  array: Array<Bytes32> = [];

  insert(array: Uint8Array, index: number, count: number) {
    // TODO assert count == 32
    //console.log("Pushing: " + index);
    this.array.push(new Bytes32(array, index));
  }

  commitInserts() {
    //		for(let i = 0;i < this.array.length;i++)
    //		{
    //			this.array[i].print();
    //		}
    this.array.sort((n1, n2) => Bytes32.compare(n1, n2));

    //		for(let i = 0;i < this.array.length;i++)
    //		{
    //			this.array[i].print();
    //		}
    // surprising
    //	this.array.sort();
  }

  query(array: Uint8Array, index: number, count: number) {
    // TODO assert count == 32
    return this.binarySearch(this.array, new Bytes32(array, index));
  }

  binarySearch(array: Bytes32[], needle: Bytes32) {
    var begin = 0;
    var end = array.length;

    while (end - begin > 1) {
      // TODO we seriously need to do floating operation here? :P
      var mid = Math.floor((begin + end) / 2);

      if (Bytes32.compare(array[mid], needle) > 0) end = mid;
      else begin = mid;
    }

    //		console.log("begin: " + begin);
    if (Bytes32.compare(array[begin], needle) == 0) return 1;
    else return 0;
  }
}

class Timer {
  start_time_ns: number;
  constructor() {
    this.start_time_ns = 0;
  }
  start() {
    var start_time = process.hrtime();

    this.start_time_ns = start_time[0] * 1000000000 + start_time[1];
  }
  // returns time in ms
  stop_ms() {
    var end_time = process.hrtime();
    var end_time_ns = end_time[0] * 1000000000 + end_time[1];

    var diff = end_time_ns - this.start_time_ns;

    return diff / 1000000;
  }
  stop(label: string) {
    var end_time = process.hrtime();
    var end_time_ns = end_time[0] * 1000000000 + end_time[1];

    var diff = end_time_ns - this.start_time_ns;

    console.log(label + ": " + diff / 1000000 + " ms");
  }
}

class TestStep {
  name: string;
  inserts = 0;
  reads_hit = 0;
  reads_miss = 0;

  constructor(name: string, inserts: number, reads_hit: number, reads_miss: number) {
    this.name = name;
    this.inserts = inserts;
    this.reads_hit = reads_hit;
    this.reads_miss = reads_miss;
  }

  getOpsCount() {
    return this.inserts + this.reads_hit + this.reads_miss;
  }

  createName() {
    return this.name + "(" + this.inserts + "/" + this.reads_hit + "/" + this.reads_miss + ")";
  }
}

class TestDesc {
  steps: Array<TestStep> = [];
  finished = false;

  inserts!: Uint8Array;
  reads_hit!: Uint8Array;
  reads_miss!: Uint8Array;

  key_size: number;

  constructor(key_size: number) {
    // TODO
    // assert(key_size > 0 && key_size < 33)
    this.key_size = key_size;
  }

  insert(name: string, count: number) {
    // TODO
    //		assert(this.finished === false);
    this.steps.push(new TestStep(name, count, 0, 0));
  }

  read(name: string, hit: number, miss: number) {
    // TODO
    //		assert(this.finished === false);
    this.steps.push(new TestStep(name, 0, hit, miss));
  }

  commit() {
    var inserts_count = 0;
    var reads_hit_count = 0;
    var reads_miss_count = 0;

    for (let i = 0; i < this.steps.length; i++) {
      inserts_count += this.steps[i].inserts;
      reads_hit_count += this.steps[i].reads_hit;
      reads_miss_count += this.steps[i].reads_miss;
    }

    this.inserts = this.generateRandomUint8Array(inserts_count * this.key_size);
    this.reads_hit = new Uint8Array(reads_hit_count * this.key_size);

    // Random is almost always miss
    this.reads_miss = this.generateRandomUint8Array(reads_miss_count * this.key_size);

    var inserted = 0;
    var hits = 0;
    for (let i = 0; i < this.steps.length; i++) {
      inserted += this.steps[i].inserts;

      if (this.steps[i].reads_hit > 0) {
        // TODO
        // assert(inserted > 0)
        var src_indexes = this.generateRandomUint32(this.steps[i].reads_hit);

        //				console.log("reads_hit: " + this.steps[i].reads_hit);

        for (let j = 0; j < this.steps[i].reads_hit; j++) {
          var src_idx = (src_indexes[j] % inserted) * this.key_size;
          var dst_idx = hits * this.key_size;

          //					console.log("src_idx: " + src_idx);

          for (let k = 0; k < this.key_size; k++) {
            this.reads_hit[dst_idx + k] = this.inserts[src_idx + k];
          }

          hits++;
        }
      }
    }

    // TODO
    //		assert(this.finished === false);
    this.finished = true;
  }

  go(map: TestMapInterface, name: string) {
    var inserts = 0;
    var reads_hit = 0;
    var reads_miss = 0;

    var hits = 0;

    var timer = new Timer();

    console.log(name + " TEST:");

    for (let i = 0; i < this.steps.length; i++) {
      timer.start();
      for (let j = 0; j < this.steps[i].inserts; j++) {
        map.insert(this.inserts, inserts * this.key_size, this.key_size);
        inserts++;
      }

      if (this.steps[i].inserts > 0) map.commitInserts();

      for (let j = 0; j < this.steps[i].reads_hit; j++) {
        hits += map.query(this.reads_hit, reads_hit * this.key_size, this.key_size);
        reads_hit++;
      }

      for (let j = 0; j < this.steps[i].reads_miss; j++) {
        hits += map.query(this.reads_miss, reads_miss * this.key_size, this.key_size);
        reads_miss++;
      }

      timer.stop(this.steps[i].createName());
      //			var time_s = timer.stop_ms() / 1000;
      //			console.log(this.steps[i].createName() + (this.steps[i].getOpsCount() / (time_s)) + "op/s");
    }

    var ops = inserts + reads_hit + reads_miss;

    console.log("Test name: " + name + " hits: " + hits + "\n\n");
    return hits;
  }

  // TODO copy&paste, change to generics
  generateRandomUint8Array(count: number) {
    const buffer = new ArrayBuffer(((count + (65536 - 1)) / 65536) * 65536);

    for (let i = 0; i < count; i += 65536) {
      const array = new Uint8Array(buffer, i, 65536);

      globalThis.crypto.getRandomValues(array);
    }

    return new Uint8Array(buffer);
  }

  generateRandomUint32(count: number) {
    const key_size = 4;

    const buffer = new ArrayBuffer(count * key_size + 65536);

    for (let i = 0; i < count * key_size; i += 65536) {
      // TODO what if 65536/key_size is bigger than remaining buffer? Test
      const array = new Uint32Array(buffer, i, 65536 / key_size);

      globalThis.crypto.getRandomValues(array);
    }

    return new Uint32Array(buffer);
  }
}

var test = new TestDesc(32);

var iterations = 5;
var add_per_iter = 2000000;
var query_per_iter = 100000;

for (let i = 0; i < iterations; i++) {
  test.insert("populate i: " + i, add_per_iter);
  test.read("hit i:" + i, query_per_iter, 0);
  test.read("miss i:" + i, 0, query_per_iter);
}
//test.read("hit + miss", 100000, 100000);
test.commit();

test.go(new MapStructure(), "PROBABILISTIC Map<number, number>");
test.go(new MapHash(), "EXACT Map hash");
test.go(new SimpleHash(), "PROBABILISTIC Simple hash");
// TODO
//test.go(new MapBase64(), "Map<string, number> Base64 encoding");
test.go(new ArrayNumber(), "PROABILISTIC Array<number>");
test.go(new ArrayBigNumber(), "EXACT Array<bignum>");
test.go(new ArrayBytes32(), "EXACT ArrayBytes32");
test.go(new MultiMapNumber(), "EXACT Map<Map<...");
test.go(new MapString(), "EXACT Map<string, number>");

//console.log("Map<number, number> hits: " + hits);

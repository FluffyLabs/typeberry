import assert from "node:assert";
import { add, complete, configure, cycle, save, suite } from "@typeberry/benchmark/setup";
import { Bytes } from "@typeberry/bytes";
import { Decoder, Encoder } from "@typeberry/codec";
import { BYTES, CLASS, type Record, VAR_U64, type View } from "@typeberry/codec/descriptors";

class TestHeader {
  static Codec = CLASS(TestHeader, {
    blockNumber: VAR_U64,
    parentHeaderHash: BYTES(32),
    priorStateRoot: BYTES(32),
    extrinsicHash: BYTES(32),
  });

  public readonly blockNumber: bigint;
  public readonly parentHeaderHash: Bytes<32>;
  public readonly priorStateRoot: Bytes<32>;
  public readonly extrinsicHash: Bytes<32>;

  constructor(o: Record<TestHeader>) {
    this.blockNumber = o.blockNumber;
    this.parentHeaderHash = o.parentHeaderHash;
    this.priorStateRoot = o.priorStateRoot;
    this.extrinsicHash = o.extrinsicHash;
  }
}

const encoder = Encoder.create();
const parentHeaderHash = Bytes.fill(32, 1);
const priorStateRoot = Bytes.fill(32, 5);
const extrinsicHash = Bytes.fill(32, 0x42);

TestHeader.Codec.encode(
  encoder,
  new TestHeader({
    blockNumber: 10_000_000n,
    parentHeaderHash,
    priorStateRoot,
    extrinsicHash,
  }),
);

const encodedData = encoder.viewResult();

function compare(name: string, runView: (view: View<TestHeader>) => void, runHeader: (header: TestHeader) => void) {
  return [
    add(`Get ${name} from View`, () => {
      const view = TestHeader.Codec.View.fromBytesBlob(encodedData);
      runView(view);
    }),

    add(`Get ${name} from Decoded`, () => {
      const header = TestHeader.Codec.decode(Decoder.fromBytesBlob(encodedData));
      runHeader(header);
    }),
  ];
}

module.exports = () =>
  suite(
    "Codec Views",

    ...compare(
      "the first field",
      (view) => {
        assert.deepStrictEqual(view.blockNumber(), 10_000_000n);
      },
      (header) => {
        assert.deepStrictEqual(header.blockNumber, 10_000_000n);
      },
    ),

    ...compare(
      "two fields",
      (view) => {
        assert.deepStrictEqual(view.blockNumber(), 10_000_000n);
        view.priorStateRoot();
      },
      (header) => {
        assert.deepStrictEqual(header.blockNumber, 10_000_000n);
        header.priorStateRoot;
      },
    ),

    ...compare(
      "only third fields",
      (view) => {
        view.parentHeaderHash();
      },
      (header) => {
        header.parentHeaderHash;
      },
    ),

    cycle(),
    complete(),
    configure({}),
    ...save(__filename),
  );

if (require.main === module) {
  module.exports();
}

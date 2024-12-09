import assert from "node:assert";
import { add, complete, configure, cycle, save, suite } from "@typeberry/benchmark/setup";
import { Bytes } from "@typeberry/bytes";
import { type CodecRecord, Decoder, type DescribedBy, Encoder, codec } from "@typeberry/codec";
import { type U64, tryAsU64 } from "@typeberry/numbers";

class TestHeader {
  static Codec = codec.Class(TestHeader, {
    blockNumber: codec.varU64,
    parentHeaderHash: codec.bytes(32),
    priorStateRoot: codec.bytes(32),
    extrinsicHash: codec.bytes(32),
  });

  static fromCodec(o: CodecRecord<TestHeader>) {
    return new TestHeader(o);
  }

  public readonly blockNumber: U64;
  public readonly parentHeaderHash: Bytes<32>;
  public readonly priorStateRoot: Bytes<32>;
  public readonly extrinsicHash: Bytes<32>;

  constructor(o: CodecRecord<TestHeader>) {
    this.blockNumber = o.blockNumber;
    this.parentHeaderHash = o.parentHeaderHash;
    this.priorStateRoot = o.priorStateRoot;
    this.extrinsicHash = o.extrinsicHash;
  }
}

class TestBlock {
  static Codec = codec.Class(TestBlock, {
    extrinsic: codec.sequenceFixLen(codec.bytes(128), 10),
    header1: TestHeader.Codec,
    header2: TestHeader.Codec,
  });

  static fromCodec(o: CodecRecord<TestBlock>) {
    return new TestBlock(o);
  }

  public readonly extrinsic: Bytes<128>[];
  public readonly header1: TestHeader;
  public readonly header2: TestHeader;

  constructor(o: CodecRecord<TestBlock>) {
    this.extrinsic = o.extrinsic;
    this.header1 = o.header1;
    this.header2 = o.header2;
  }
}

const encoder = Encoder.create();
const parentHeaderHash = Bytes.fill(32, 1);
const priorStateRoot = Bytes.fill(32, 5);
const extrinsicHash = Bytes.fill(32, 0x42);
const testHeader = new TestHeader({
  blockNumber: tryAsU64(10_000_000n),
  parentHeaderHash,
  priorStateRoot,
  extrinsicHash,
});
const testExtrinsic = Array(10).fill(Bytes.fill(128, 0x69));

TestBlock.Codec.encode(
  encoder,
  new TestBlock({
    header1: testHeader,
    header2: testHeader,
    extrinsic: testExtrinsic,
  }),
);

const encodedData = encoder.viewResult();

function compare(
  name: string,
  runView: (view: DescribedBy<typeof TestBlock.Codec.View>) => void,
  runBlock?: (block: TestBlock) => void,
) {
  const res = [
    add(`Get ${name} from View`, () => {
      const view = TestBlock.Codec.View.decode(Decoder.fromBytesBlob(encodedData));
      runView(view);
    }),
  ];

  if (runBlock) {
    res.unshift(
      add(`Get ${name} from Decoded`, () => {
        const header = TestBlock.Codec.decode(Decoder.fromBytesBlob(encodedData));
        runBlock(header);
      }),
    );
  }

  return res;
}

module.exports = () =>
  suite(
    "Codec Views",

    ...compare(
      "the first field",
      (view) => {
        assert.deepStrictEqual(view.header2.view().blockNumber.materialize(), 10_000_000n);
      },
      (block) => {
        assert.deepStrictEqual(block.header2.blockNumber, 10_000_000n);
      },
    ),

    ...compare("the first field as view", (view) => {
      assert.deepStrictEqual(view.header2.view().blockNumber.view(), 10_000_000n);
    }),

    ...compare(
      "two fields",
      (view) => {
        const headerView = view.header2.view();
        assert.deepStrictEqual(headerView.blockNumber.materialize(), 10_000_000n);
        headerView.priorStateRoot.materialize();
      },
      (block) => {
        assert.deepStrictEqual(block.header2.blockNumber, 10_000_000n);
        block.header2.priorStateRoot;
      },
    ),

    ...compare("two fields from materialized", (view) => {
      const headerView = view.header2.materialize();
      assert.deepStrictEqual(headerView.blockNumber, 10_000_000n);
      headerView.priorStateRoot;
    }),

    ...compare("two fields as views", (view) => {
      const headerView = view.header2.view();
      assert.deepStrictEqual(headerView.blockNumber.view(), 10_000_000n);
      headerView.priorStateRoot.view();
    }),

    ...compare(
      "only third field",
      (view) => {
        view.header2.view().parentHeaderHash.materialize();
      },
      (block) => {
        block.header2.parentHeaderHash;
      },
    ),

    ...compare("only third field as view", (view) => {
      view.header2.view().parentHeaderHash.view();
    }),

    cycle(),
    complete(),
    configure({}),
    ...save(__filename),
  );

if (require.main === module) {
  module.exports();
}

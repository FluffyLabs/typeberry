import assert from "node:assert";
import { pathToFileURL } from "node:url";
import { add, complete, configure, cycle, save, suite } from "@typeberry/benchmark/setup.js";
import { Bytes } from "@typeberry/bytes";
import { type CodecRecord, Decoder, type DescribedBy, Encoder, type SequenceView, codec } from "@typeberry/codec";
import { type U64, tryAsU64 } from "@typeberry/numbers";

class TestHeader {
  static Codec = codec.Class(TestHeader, {
    blockNumber: codec.varU64,
    parentHeaderHash: codec.bytes(32),
  });

  static create({ blockNumber, parentHeaderHash }: CodecRecord<TestHeader>) {
    return new TestHeader(blockNumber, parentHeaderHash);
  }

  private constructor(
    public readonly blockNumber: U64,
    public readonly parentHeaderHash: Bytes<32>,
  ) {}
}

const ELEMENTS = 100;
const headerSequence = codec.sequenceVarLen(TestHeader.Codec);
const collection: TestHeader[] = [];
for (let i = 0; i < ELEMENTS; i++) {
  const parentHeaderHash = Bytes.fill(32, i);

  collection.push(TestHeader.create({ blockNumber: tryAsU64(10_000_000n + BigInt(i)), parentHeaderHash }));
}
const encodedData = Encoder.encodeObject(headerSequence, collection);

function compare(
  name: string,
  runDecoded: (s: TestHeader[]) => void,
  runView: (s: SequenceView<TestHeader, DescribedBy<typeof TestHeader.Codec.View>>) => void,
) {
  return [
    add(`Get ${name} from Decoded`, () => {
      const headerSeq = headerSequence.decode(Decoder.fromBytesBlob(encodedData));
      runDecoded(headerSeq);
    }),

    add(`Get ${name} from View`, () => {
      const headerSeq = headerSequence.View.decode(Decoder.fromBytesBlob(encodedData));
      runView(headerSeq);
    }),
  ];
}

export default function run() {
  return suite(
    "Sequence Views",

    ...compare(
      "first element",
      (headerSeq) => {
        assert.deepStrictEqual(headerSeq[0].blockNumber, 10_000_000n);
      },
      (headerSeq) => {
        assert.deepStrictEqual(headerSeq.get(0)?.view().blockNumber.materialize(), 10_000_000n);
      },
    ),

    ...compare(
      "50th element",
      (headerSeq) => {
        assert.deepStrictEqual(headerSeq[50].blockNumber, 10_000_050n);
      },
      (headerSeq) => {
        assert.deepStrictEqual(headerSeq.get(50)?.view().blockNumber.materialize(), 10_000_050n);
      },
    ),

    ...compare(
      "last element",
      (headerSeq) => {
        assert.deepStrictEqual(headerSeq[ELEMENTS - 1].blockNumber, 10_000_000n + BigInt(ELEMENTS - 1));
      },
      (headerSeq) => {
        assert.deepStrictEqual(
          headerSeq
            .get(ELEMENTS - 1)
            ?.view()
            .blockNumber.materialize(),
          10_000_000n + BigInt(ELEMENTS - 1),
        );
      },
    ),

    cycle(),
    complete(),
    configure({}),
    ...save(import.meta.filename),
  );
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  run();
}

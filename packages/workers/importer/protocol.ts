import { Block, type HeaderHash, headerViewWithHashCodec, type StateRootHash } from "@typeberry/block";
import { BytesBlob } from "@typeberry/bytes";
import { type CodecRecord, codec } from "@typeberry/codec";
import { PVMBackend } from "@typeberry/config-node";
import { HASH_SIZE, type OpaqueHash } from "@typeberry/hash";
import { tryAsU8, tryAsU32 } from "@typeberry/numbers";
import { StateEntries } from "@typeberry/state-merkleization";
import { assertNever, Result } from "@typeberry/utils";
import { type Api, createProtocol, type Internal } from "@typeberry/workers-api";

const importBlockResultCodec = <T extends OpaqueHash>(hashName: string) =>
  codec.custom<Result<T, string>>(
    {
      name: `Result<${hashName}, string>`,
      sizeHint: { bytes: 1, isExact: false },
    },
    (e, x) => {
      e.varU32(tryAsU32(x.isOk ? 0 : 1));
      if (x.isOk) {
        e.bytes(x.ok);
      } else {
        e.bytesBlob(BytesBlob.blobFromString(`${x.error}`));
      }
    },
    (d) => {
      const kind = d.varU32();
      if (kind === 0) {
        const hash = d.bytes(HASH_SIZE);
        return Result.ok<T>(hash.asOpaque());
      }
      if (kind === 1) {
        const error = d.bytesBlob();
        const errorMsg = error.asText();
        return Result.error(errorMsg, () => errorMsg);
      }

      throw new Error(`Invalid Result: ${kind}`);
    },
    (s) => {
      const kind = s.decoder.varU32();
      if (kind === 0) {
        s.bytes(HASH_SIZE);
      } else if (kind === 1) {
        s.bytesBlob();
      } else {
        throw new Error(`Invalid Result: ${kind}`);
      }
    },
  );

export const protocol = createProtocol("importer", {
  toWorker: {
    getStateEntries: {
      request: codec.bytes(HASH_SIZE).asOpaque<HeaderHash>(),
      response: codec.optional(StateEntries.Codec),
    },
    getBestStateRootHash: {
      request: codec.nothing,
      response: codec.bytes(HASH_SIZE).asOpaque<StateRootHash>(),
    },
    importBlock: {
      request: Block.Codec.View,
      response: importBlockResultCodec<HeaderHash>("HeaderHash"),
    },
    finish: {
      request: codec.nothing,
      response: codec.nothing,
    },
  },
  fromWorker: {
    bestHeaderAnnouncement: {
      request: headerViewWithHashCodec,
      response: codec.nothing,
    },
  },
});

export type ImporterInternal = Internal<typeof protocol>;
export type ImporterApi = Api<typeof protocol>;

export class ImporterConfig {
  static Codec = codec.Class(ImporterConfig, {
    omitSealVerification: codec.bool,
    pvm: codec.u8.convert(
      (i) => {
        switch (i) {
          case PVMBackend.BuiltIn:
            return tryAsU8(0);
          case PVMBackend.Ananas:
            return tryAsU8(1);
          case PVMBackend.BuiltinAnanas:
            return tryAsU8(2);
          default:
            assertNever(i);
        }
      },
      (o) => {
        switch (o) {
          case 0:
            return PVMBackend.BuiltIn;
          case 1:
            return PVMBackend.Ananas;
          case 2:
            return PVMBackend.BuiltinAnanas;
          default:
            throw new Error(`Unimplemented interpreter of index ${o}`);
        }
      },
    ),
  });

  static create({ omitSealVerification, pvm }: CodecRecord<ImporterConfig>) {
    return new ImporterConfig(omitSealVerification, pvm);
  }

  private constructor(
    public readonly omitSealVerification: boolean,
    public readonly pvm: PVMBackend,
  ) {}
}

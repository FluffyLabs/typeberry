import { Bytes } from "@typeberry/bytes";
import { Logger } from "@typeberry/logger";
import { FROM_STRING } from "../../json-parser";
import {Opaque} from "@typeberry/utils";

export const bytes32 = <T extends Bytes<32>>() => FROM_STRING((v) => Bytes.parseBytes(v, 32) as T);

export type HeaderHash = Opaque<Bytes<32>, "HeaderHash">

export type ValidatorIndex = Opaque<number, "ValidatorIndex[u16]">;
export type Slot = Opaque<number, "Slot[u32]">;

export type Ed25519Signature = Opaque<Bytes<64>, "Ed25519Signature">;
export const ed25519SignatureFromJson = FROM_STRING(v => Bytes.parseBytes(v, 64) as Ed25519Signature);

export const logger = Logger.new(global.__filename, "test-runner/codec");

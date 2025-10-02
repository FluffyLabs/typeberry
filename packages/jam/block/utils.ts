import {Decoder, Descriptor, Encoder} from "@typeberry/codec";
import {ChainSpec} from "@typeberry/config";

/**
 * Take an input data and re-encode that data as view.
 *
 * NOTE: this function should NEVER be used in any production code,
 * it's only a test helper.
 */
export function reencodeAsView<T, V>(
  codec: Descriptor<T, V>,
  object: T,
  chainSpec?: ChainSpec,
): V {
  const encoded = Encoder.encodeObject(codec, object, chainSpec);
  return Decoder.decodeObject(codec.View, encoded, chainSpec);
}


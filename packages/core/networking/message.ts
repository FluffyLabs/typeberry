import { Buffer } from "node:buffer";
import { Encoder } from "@typeberry/codec";

export const MSG_LEN_PREFIX_BYTES = 4;
const MSG_LENGTH_BUFFER = new Uint8Array(MSG_LEN_PREFIX_BYTES);

/**
 * Encode message length into a buffer.
 *
 * NOTE: the returned buffer will be re-used so it's meant to be immediatelly written
 * down to the socket.
 */
export function encodeMessageLength(message: Uint8Array) {
  const encoder = Encoder.create({
    destination: MSG_LENGTH_BUFFER,
  });
  encoder.i32(message.length);
  return MSG_LENGTH_BUFFER;
}

/**
 * Only triggers the `callback` in case full data blob is received.
 *
 * Each message should be prefixed with a single U32 denoting the length of the next data
 * frame that should be interpreted as single chunk.
 */
export function handleMessageFragmentation(callback: (data: Uint8Array) => void): (data: Uint8Array) => void {
  let buffer = Buffer.alloc(0);
  let expectedLength = -1;

  return (data: Uint8Array) => {
    buffer = Buffer.concat([buffer as Uint8Array, data]);
    do {
      // we now expect a length prefix.
      if (expectedLength === -1) {
        // not enough data to parse the length, wait for more.
        if (buffer.length < MSG_LEN_PREFIX_BYTES) {
          break;
        }

        expectedLength = buffer.readUint32LE();
        buffer = buffer.subarray(MSG_LEN_PREFIX_BYTES);
      }

      // we don't have enough data, so let's wait.
      if (buffer.length < expectedLength) {
        break;
      }

      // full chunk can be parsed now, but there might be some more.
      const chunk = buffer.subarray(0, expectedLength);
      buffer = buffer.subarray(expectedLength);
      expectedLength = -1;
      callback(new Uint8Array(chunk));
    } while (buffer.length > 0);
  };
}

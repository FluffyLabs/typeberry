/**
 * Custom base32 encoding used for networking.
 *
 * This is not matching the RFC 4648 because of
 * bit ordering.
 *
 * NOTE [ToDr] consider optimizing.
 */
export function base32(input: Uint8Array) {
  function getBit(i: number) {
    const byte = i >> 3;
    const bit = i % 8;

    const val = input.at(byte) ?? 0;
    const ret = (val >> bit) & 0x1;
    return ret;
  }

  const res: string[] = [];
  for (let i = 0; i < input.length * 8; i += 5) {
    let num = 0;
    for (let j = i + 4; j >= i; j--) {
      num <<= 1;
      num |= getBit(j);
    }
    res.push(ALPHABET[num]);
  }
  return res.join("");
}

const ALPHABET = "abcdefghijklmnopqrstuvwxyz234567";

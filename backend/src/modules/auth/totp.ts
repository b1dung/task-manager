import { createHmac, randomBytes, timingSafeEqual } from 'crypto';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32Encode(input: Buffer): string {
  let bits = '';
  for (const byte of input) bits += byte.toString(2).padStart(8, '0');
  let output = '';
  for (let index = 0; index < bits.length; index += 5) {
    output +=
      ALPHABET[parseInt(bits.slice(index, index + 5).padEnd(5, '0'), 2)];
  }
  return output;
}

function base32Decode(input: string): Buffer {
  let bits = '';
  for (const char of input.replace(/=+$/g, '').toUpperCase()) {
    const value = ALPHABET.indexOf(char);
    if (value < 0) throw new Error('Invalid base32 secret');
    bits += value.toString(2).padStart(5, '0');
  }
  const bytes: number[] = [];
  for (let index = 0; index + 8 <= bits.length; index += 8) {
    bytes.push(parseInt(bits.slice(index, index + 8), 2));
  }
  return Buffer.from(bytes);
}

function codeAt(secret: string, counter: number): string {
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac('sha1', base32Decode(secret))
    .update(buffer)
    .digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const value = (digest.readUInt32BE(offset) & 0x7fffffff) % 1_000_000;
  return value.toString().padStart(6, '0');
}

export function createTotpSecret(): string {
  return base32Encode(randomBytes(20));
}

export function verifyTotp(
  secret: string,
  code: string,
  now = Date.now(),
): boolean {
  if (!/^\d{6}$/.test(code)) return false;
  const counter = Math.floor(now / 30_000);
  return [-1, 0, 1].some((window) => {
    const expected = Buffer.from(codeAt(secret, counter + window));
    const actual = Buffer.from(code);
    return (
      expected.length === actual.length && timingSafeEqual(expected, actual)
    );
  });
}

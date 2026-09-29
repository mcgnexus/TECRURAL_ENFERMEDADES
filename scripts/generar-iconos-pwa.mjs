import { deflateSync } from "node:zlib";
import { writeFile } from "node:fs/promises";

const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  crcTable[n] = c >>> 0;
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const name = Buffer.from(type);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([name, data])));
  return Buffer.concat([length, name, data, checksum]);
}

function pixel(x, y, size) {
  const scale = size / 512;
  const cx = x / scale;
  const cy = y / scale;
  const edge = Math.min(cx, cy, 512 - cx, 512 - cy);
  const cornerX = cx < 84 ? 84 - cx : cx > 428 ? cx - 428 : 0;
  const cornerY = cy < 84 ? 84 - cy : cy > 428 ? cy - 428 : 0;
  const roundedCorner = cornerX > 0 && cornerY > 0 && cornerX ** 2 + cornerY ** 2 > 84 ** 2;
  if (edge <= 0 || roundedCorner) return [0, 0, 0, 0];

  const dx = cx - 256;
  const dy = cy - 256;
  const radius = Math.hypot(dx, dy);
  const ring = radius >= 80 && radius <= 112;
  const spoke = (Math.abs(dx) < 10 && radius >= 56 && radius <= 164) || (Math.abs(dy) < 10 && radius >= 56 && radius <= 164);
  if (ring || spoke) return [34, 197, 94, 255];
  return [22, 101, 52, 255];
}

function createPng(size) {
  const stride = size * 4 + 1;
  const raw = Buffer.alloc(stride * size);
  for (let y = 0; y < size; y++) {
    const row = y * stride;
    raw[row] = 0;
    for (let x = 0; x < size; x++) pixel(x, y, size).forEach((value, channel) => {
      raw[row + 1 + x * 4 + channel] = value;
    });
  }

  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8;
  header[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

for (const size of [192, 512]) {
  await writeFile(new URL(`../public/icon-${size}.png`, import.meta.url), createPng(size));
}

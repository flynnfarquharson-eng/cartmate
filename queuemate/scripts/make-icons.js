// Generates the ticket icon PNGs with no dependencies: node scripts/make-icons.js
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function png(size) {
  const px = (x, y) => {
    // Coordinates normalised to a 0..1 square.
    const u = (x + 0.5) / size;
    const v = (y + 0.5) / size;
    const inTicket = u > 0.08 && u < 0.92 && v > 0.22 && v < 0.78;
    const notch = Math.hypot(u - 0.08, v - 0.5) < 0.1 || Math.hypot(u - 0.92, v - 0.5) < 0.1;
    if (!inTicket || notch) return [0, 0, 0, 0];
    const perforation = Math.abs(u - 0.66) < 0.015 && Math.floor(v * 14) % 2 === 0;
    if (perforation) return [255, 255, 255, 255];
    const bar = v > 0.4 && v < 0.6 && u > 0.2 && u < 0.2 + 0.36 * 0.7;
    if (bar) return [255, 255, 255, 230];
    return [79, 70, 229, 255];
  };
  const rows = [];
  for (let y = 0; y < size; y++) {
    const row = [0];
    for (let x = 0; x < size; x++) row.push(...px(x, y));
    rows.push(Buffer.from(row));
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(Buffer.concat(rows))),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

for (const size of [16, 48, 128]) {
  fs.writeFileSync(path.join(__dirname, '..', 'icons', `icon${size}.png`), png(size));
}

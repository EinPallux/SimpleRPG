/** Standard CRC-32 (IEEE) over a string's UTF-16 code units — save integrity check. */
const TABLE = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[i] = c >>> 0;
  }
  return t;
})();

export function crc32(text: string): number {
  let crc = 0xffffffff;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    crc = (crc >>> 8) ^ TABLE[(crc ^ (code & 0xff)) & 0xff]!;
    crc = (crc >>> 8) ^ TABLE[(crc ^ (code >>> 8)) & 0xff]!;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

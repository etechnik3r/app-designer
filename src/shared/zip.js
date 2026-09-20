/* Minimaler ZIP-Schreiber, Methode "store" (ohne Komprimierung).
   Grund: der Inhalt eines Export-Pakets ist im Wesentlichen eine
   HTML-Datei mit bereits komprimierten Bildern darin - Deflate
   wuerde dort fast nichts bringen und braeuchte eine Fremd-
   bibliothek. So bleibt der Baukasten abhaengigkeitsfrei.         */

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[i] = c >>> 0;
  }
  return table;
})();

export function crc32(bytes) {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function toBytes(content) {
  if (content instanceof Uint8Array) return content;
  if (content instanceof ArrayBuffer) return new Uint8Array(content);
  return new TextEncoder().encode(String(content));
}

/* DOS-Zeitstempel. Vor 1980 gibt es im ZIP-Format nicht. */
function dosDateTime(date) {
  const year = Math.max(1980, date.getFullYear());
  return {
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1),
    date: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
  };
}

class ByteWriter {
  constructor() { this.parts = []; this.length = 0; }
  bytes(b) { this.parts.push(b); this.length += b.length; return this; }
  u16(v) { return this.bytes(new Uint8Array([v & 0xff, (v >>> 8) & 0xff])); }
  u32(v) {
    return this.bytes(new Uint8Array([v & 0xff, (v >>> 8) & 0xff, (v >>> 16) & 0xff, (v >>> 24) & 0xff]));
  }
  concat() {
    const out = new Uint8Array(this.length);
    let offset = 0;
    for (const part of this.parts) { out.set(part, offset); offset += part.length; }
    return out;
  }
}

/* files: [{ name, content }]  ->  Uint8Array mit dem ZIP-Inhalt */
export function makeZip(files, when = new Date()) {
  const { time, date } = dosDateTime(when);
  const body = new ByteWriter();
  const central = new ByteWriter();
  let offset = 0;

  for (const file of files) {
    const nameBytes = new TextEncoder().encode(file.name);
    const data = toBytes(file.content);
    const crc = crc32(data);

    body.u32(0x04034b50).u16(20).u16(0x0800).u16(0)      // 0x0800: Namen sind UTF-8
        .u16(time).u16(date).u32(crc).u32(data.length).u32(data.length)
        .u16(nameBytes.length).u16(0).bytes(nameBytes).bytes(data);

    central.u32(0x02014b50).u16(20).u16(20).u16(0x0800).u16(0)
           .u16(time).u16(date).u32(crc).u32(data.length).u32(data.length)
           .u16(nameBytes.length).u16(0).u16(0).u16(0).u16(0).u32(0)
           .u32(offset).bytes(nameBytes);

    offset = body.length;
  }

  const centralBytes = central.concat();
  const bodyBytes = body.concat();
  const end = new ByteWriter();
  end.u32(0x06054b50).u16(0).u16(0)
     .u16(files.length).u16(files.length)
     .u32(centralBytes.length).u32(bodyBytes.length).u16(0);

  const out = new Uint8Array(bodyBytes.length + centralBytes.length + end.length);
  out.set(bodyBytes, 0);
  out.set(centralBytes, bodyBytes.length);
  out.set(end.concat(), bodyBytes.length + centralBytes.length);
  return out;
}

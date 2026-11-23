import { deflateRawSync, inflateRawSync } from "node:zlib";

type ZipEntry = {
  name: string;
  flags: number;
  method: number;
  time: number;
  date: number;
  crc: number;
  compressed: Buffer;
  uncompressedSize: number;
  localExtra: Buffer;
  centralExtra: Buffer;
  comment: Buffer;
  internalAttributes: number;
  externalAttributes: number;
  versionMadeBy: number;
  versionNeeded: number;
};

const localSignature = 0x04034b50;
const centralSignature = 0x02014b50;
const endSignature = 0x06054b50;

function findEnd(buffer: Buffer) {
  const start = Math.max(0, buffer.length - 65_557);
  for (let index = buffer.length - 22; index >= start; index -= 1)
    if (buffer.readUInt32LE(index) === endSignature) return index;
  throw new Error("Invalid DOCX package: ZIP directory was not found.");
}

function readEntries(input: Uint8Array) {
  const buffer = Buffer.from(input);
  const end = findEnd(buffer);
  const count = buffer.readUInt16LE(end + 10);
  let offset = buffer.readUInt32LE(end + 16);
  const entries: ZipEntry[] = [];
  for (let index = 0; index < count; index += 1) {
    if (buffer.readUInt32LE(offset) !== centralSignature)
      throw new Error("Invalid DOCX package: malformed ZIP directory.");
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localOffset = buffer.readUInt32LE(offset + 42);
    const localNameLength = buffer.readUInt16LE(localOffset + 26);
    const localExtraLength = buffer.readUInt16LE(localOffset + 28);
    if (buffer.readUInt32LE(localOffset) !== localSignature)
      throw new Error("Invalid DOCX package: malformed ZIP entry.");
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const dataOffset = localOffset + 30 + localNameLength + localExtraLength;
    entries.push({
      name: buffer.subarray(offset + 46, offset + 46 + nameLength).toString("utf8"),
      versionMadeBy: buffer.readUInt16LE(offset + 4),
      versionNeeded: buffer.readUInt16LE(offset + 6),
      flags: buffer.readUInt16LE(offset + 8),
      method: buffer.readUInt16LE(offset + 10),
      time: buffer.readUInt16LE(offset + 12),
      date: buffer.readUInt16LE(offset + 14),
      crc: buffer.readUInt32LE(offset + 16),
      compressed: buffer.subarray(dataOffset, dataOffset + compressedSize),
      uncompressedSize: buffer.readUInt32LE(offset + 24),
      localExtra: buffer.subarray(
        localOffset + 30 + localNameLength,
        localOffset + 30 + localNameLength + localExtraLength,
      ),
      centralExtra: buffer.subarray(
        offset + 46 + nameLength,
        offset + 46 + nameLength + extraLength,
      ),
      comment: buffer.subarray(
        offset + 46 + nameLength + extraLength,
        offset + 46 + nameLength + extraLength + commentLength,
      ),
      internalAttributes: buffer.readUInt16LE(offset + 36),
      externalAttributes: buffer.readUInt32LE(offset + 38),
    });
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

function entryContent(entry: ZipEntry) {
  if (entry.method === 0) return Buffer.from(entry.compressed);
  if (entry.method === 8) return inflateRawSync(entry.compressed);
  throw new Error(`Unsupported DOCX compression method ${entry.method}.`);
}

let crcTable: Uint32Array | undefined;
function crc32(buffer: Buffer) {
  if (!crcTable) {
    crcTable = new Uint32Array(256);
    for (let index = 0; index < 256; index += 1) {
      let value = index;
      for (let bit = 0; bit < 8; bit += 1)
        value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
      crcTable[index] = value >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (const value of buffer) crc = crcTable[(crc ^ value) & 0xff]! ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function replaceEntry(entry: ZipEntry, content: Buffer): ZipEntry {
  return {
    ...entry,
    flags: entry.flags & ~0x08,
    crc: crc32(content),
    compressed: entry.method === 0 ? content : deflateRawSync(content, { level: 9 }),
    uncompressedSize: content.length,
  };
}

function writeEntries(entries: ZipEntry[]) {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let localOffset = 0;
  for (const entry of entries) {
    const name = Buffer.from(entry.name, "utf8");
    const local = Buffer.alloc(30);
    local.writeUInt32LE(localSignature, 0);
    local.writeUInt16LE(entry.versionNeeded, 4);
    local.writeUInt16LE(entry.flags & ~0x08, 6);
    local.writeUInt16LE(entry.method, 8);
    local.writeUInt16LE(entry.time, 10);
    local.writeUInt16LE(entry.date, 12);
    local.writeUInt32LE(entry.crc, 14);
    local.writeUInt32LE(entry.compressed.length, 18);
    local.writeUInt32LE(entry.uncompressedSize, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(entry.localExtra.length, 28);
    localParts.push(local, name, entry.localExtra, entry.compressed);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(centralSignature, 0);
    central.writeUInt16LE(entry.versionMadeBy, 4);
    central.writeUInt16LE(entry.versionNeeded, 6);
    central.writeUInt16LE(entry.flags & ~0x08, 8);
    central.writeUInt16LE(entry.method, 10);
    central.writeUInt16LE(entry.time, 12);
    central.writeUInt16LE(entry.date, 14);
    central.writeUInt32LE(entry.crc, 16);
    central.writeUInt32LE(entry.compressed.length, 20);
    central.writeUInt32LE(entry.uncompressedSize, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt16LE(entry.centralExtra.length, 30);
    central.writeUInt16LE(entry.comment.length, 32);
    central.writeUInt16LE(entry.internalAttributes, 36);
    central.writeUInt32LE(entry.externalAttributes, 38);
    central.writeUInt32LE(localOffset, 42);
    centralParts.push(central, name, entry.centralExtra, entry.comment);
    localOffset += local.length + name.length + entry.localExtra.length + entry.compressed.length;
  }
  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(endSignature, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(localOffset, 16);
  return Buffer.concat([...localParts, ...centralParts, end]);
}

export function readDocxPart(input: Uint8Array, name: string) {
  const entry = readEntries(input).find((item) => item.name === name);
  if (!entry) throw new Error(`DOCX package part ${name} was not found.`);
  return entryContent(entry);
}

export function replaceDocxPart(input: Uint8Array, name: string, content: Uint8Array) {
  let found = false;
  const entries = readEntries(input).map((entry) => {
    if (entry.name !== name) return entry;
    found = true;
    return replaceEntry(entry, Buffer.from(content));
  });
  if (!found) throw new Error(`DOCX package part ${name} was not found.`);
  return writeEntries(entries);
}

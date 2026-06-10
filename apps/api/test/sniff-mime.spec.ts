import {
  isAllowedImageMime,
  isOutputImageFormat,
  sniffMimeType,
} from '@smartresidence/shared-types';
import { describe, expect, it } from 'vitest';

function bytes(...vals: number[]): Uint8Array {
  // Pad to 16 bytes so the length guard passes.
  const arr = new Uint8Array(16);
  arr.set(vals);
  return arr;
}

describe('sniffMimeType', () => {
  it('detects JPEG', () => {
    expect(sniffMimeType(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe('image/jpeg');
  });
  it('detects PNG', () => {
    expect(sniffMimeType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))).toBe('image/png');
  });
  it('detects GIF', () => {
    expect(sniffMimeType(bytes(0x47, 0x49, 0x46, 0x38, 0x39, 0x61))).toBe('image/gif');
  });
  it('detects PDF', () => {
    expect(sniffMimeType(bytes(0x25, 0x50, 0x44, 0x46, 0x2d))).toBe('application/pdf');
  });
  it('detects WebP (RIFF....WEBP)', () => {
    expect(sniffMimeType(bytes(0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50))).toBe(
      'image/webp',
    );
  });
  it('detects HEIC by ftyp brand', () => {
    // bytes 4..8 = "ftyp", 8..12 = "heic"
    const heic = bytes(0, 0, 0, 0, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63);
    expect(sniffMimeType(heic)).toBe('image/heic');
  });
  it('returns null for unrecognized / too-short input', () => {
    expect(sniffMimeType(bytes(0x00, 0x01, 0x02))).toBeNull();
    expect(sniffMimeType(new Uint8Array(4))).toBeNull();
  });
  it('all detected image types are in the upload allowlist', () => {
    for (const sig of [
      bytes(0xff, 0xd8, 0xff, 0xe0),
      bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a),
      bytes(0x47, 0x49, 0x46, 0x38, 0x39, 0x61),
    ]) {
      expect(isAllowedImageMime(sniffMimeType(sig))).toBe(true);
    }
  });
});

describe('isOutputImageFormat', () => {
  it('accepts avif/webp and rejects others', () => {
    expect(isOutputImageFormat('avif')).toBe(true);
    expect(isOutputImageFormat('webp')).toBe(true);
    expect(isOutputImageFormat('png')).toBe(false);
    expect(isOutputImageFormat(undefined)).toBe(false);
  });
});

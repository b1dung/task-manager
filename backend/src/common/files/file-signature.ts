import { BadRequestException } from '@nestjs/common';
import { open, unlink } from 'fs/promises';

function detectedMime(bytes: Buffer): string | null {
  const hex = bytes.toString('hex');
  if (hex.startsWith('89504e470d0a1a0a')) return 'image/png';
  if (hex.startsWith('ffd8ff')) return 'image/jpeg';
  if (bytes.subarray(0, 6).toString('ascii').startsWith('GIF8'))
    return 'image/gif';
  if (
    bytes.subarray(0, 4).toString('ascii') === 'RIFF' &&
    bytes.subarray(8, 12).toString('ascii') === 'WEBP'
  )
    return 'image/webp';
  if (bytes.subarray(0, 5).toString('ascii') === '%PDF-')
    return 'application/pdf';
  if (
    hex.startsWith('504b0304') ||
    hex.startsWith('504b0506') ||
    hex.startsWith('504b0708')
  )
    return 'application/zip';
  return null;
}

export async function assertFileSignature(
  file: Express.Multer.File,
): Promise<void> {
  if (file.mimetype.startsWith('text/')) return;
  const handle = await open(file.path, 'r');
  const bytes = Buffer.alloc(16);
  try {
    await handle.read(bytes, 0, bytes.length, 0);
  } finally {
    await handle.close();
  }
  const detected = detectedMime(bytes);
  const valid =
    detected === file.mimetype ||
    (detected === 'application/zip' &&
      file.mimetype.includes('openxmlformats'));
  if (!valid) {
    await unlink(file.path).catch(() => undefined);
    throw new BadRequestException(
      'File content does not match its declared type',
    );
  }
}

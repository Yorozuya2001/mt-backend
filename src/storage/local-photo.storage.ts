import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { mkdir, writeFile } from 'fs/promises';
import { extname, join } from 'path';
import type { PhotoStorage, UploadedPhotoFile } from './photo-storage.interface';

const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

@Injectable()
export class LocalPhotoStorage implements PhotoStorage {
  private readonly uploadDir = join(process.cwd(), 'uploads');

  async upload(file: UploadedPhotoFile): Promise<string> {
    await mkdir(this.uploadDir, { recursive: true });

    const ext =
      MIME_TO_EXT[file.mimetype] ?? (extname(file.originalname) || '.jpg');
    const filename = `${randomUUID()}${ext}`;
    await writeFile(join(this.uploadDir, filename), file.buffer);

    return `/uploads/${filename}`;
  }
}

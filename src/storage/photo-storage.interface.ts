export const PHOTO_STORAGE = Symbol('PHOTO_STORAGE');

export type UploadedPhotoFile = {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
};

export interface PhotoStorage {
  upload(file: UploadedPhotoFile): Promise<string>;
}

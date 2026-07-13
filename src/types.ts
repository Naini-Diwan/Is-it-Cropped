export interface UploadedScan {
  id: string;
  name: string;
  dataUrl: string; // Object URL or base64 representation
  width: number;
  height: number;
  file: File;
}

export interface CropZone {
  id: string;
  scanId: string;
  x: number; // Pixels in original image coordinate space
  y: number; // Pixels in original image coordinate space
  width: number; // Pixels
  height: number; // Pixels
  rotation: number; // Angle in degrees (-180 to 180)
  name: string;
}

export type ImageQuality = 'max' | 'high' | 'medium' | 'standard';

export interface EXIFMetadata {
  title: string;
  description: string;
  tags: string;
  creationDate: string;
  author: string;
}

export interface ExportSettings {
  aspectRatio: 'original' | '3:4' | '5:7' | '4:5' | '1:1' | string; // e.g. "16:9"
  bgFillType: 'color' | 'transparent';
  bgColor: string; // Hex color
  format: 'jpeg' | 'png';
  quality: ImageQuality;
  captureMargin: number; // Positive or negative integer pixels
  feathering: number; // uniform crop size scaling % (e.g. -10 to +10)
  filenameTemplate: string; // e.g., "{file}_crop_{crop}"
  exif: EXIFMetadata;
}

export interface BorderSettings {
  color: string; // hex
  width: number; // px
}

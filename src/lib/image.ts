// Shrink a photo before sending it for analysis: phone photos are several MB,
// but ~1024 px is plenty for recognising food and keeps uploads fast.

export interface PreparedImage {
  base64: string; // no "data:" prefix
  mimeType: 'image/jpeg';
  previewUrl: string; // data URL for showing a thumbnail
}

export async function prepareImage(file: File, maxDim = 1024, quality = 0.82): Promise<PreparedImage> {
  // createImageBitmap applies the photo's EXIF rotation, so portraits stay upright.
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not supported');
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  const dataUrl = canvas.toDataURL('image/jpeg', quality);
  return { base64: dataUrl.slice(dataUrl.indexOf(',') + 1), mimeType: 'image/jpeg', previewUrl: dataUrl };
}

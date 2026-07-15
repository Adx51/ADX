// Reads an image File, downscales it (longest side ≤ maxDim) and returns a JPEG
// data URL. Keeps the vision payload small — faster, cheaper, and well under the
// API body limit — while staying legible for label OCR.
export async function fileToResizedDataUrl(
  file: File,
  maxDim = 1280,
  quality = 0.72,
): Promise<string> {
  const original = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('read failed'));
    reader.readAsDataURL(file);
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('decode failed'));
    image.src = original;
  });

  let { width, height } = img;
  if (Math.max(width, height) > maxDim) {
    if (width >= height) {
      height = Math.round((height * maxDim) / width);
      width = maxDim;
    } else {
      width = Math.round((width * maxDim) / height);
      height = maxDim;
    }
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return original;
  ctx.drawImage(img, 0, 0, width, height);
  return canvas.toDataURL('image/jpeg', quality);
}

const sharp = require('sharp');

async function processImage(imageData) {
  let base64 = typeof imageData === 'string' ? imageData : imageData.toString();

  if (base64.startsWith('data:')) {
    base64 = base64.split(',')[1];
  }

  base64 = base64.replace(/\s/g, '');

  const buffer = Buffer.from(base64, 'base64');

  if (buffer.length < 100) throw new Error('Image too small or corrupted.');

  const sizeMB = (buffer.length / (1024 * 1024)).toFixed(2);
  console.log(`[Image] Input: ${sizeMB} MB`);

  const metadata = await sharp(buffer).metadata();
  console.log(`[Image] Format: ${metadata.format}, ${metadata.width}x${metadata.height}`);

  const maxDim = Math.max(metadata.width || 0, metadata.height || 0);

  let pipeline = sharp(buffer)
    .rotate()
    .flatten({ background: { r: 255, g: 255, b: 255 } });

  if (maxDim > 2048) {
    pipeline = pipeline.resize(2048, 2048, { fit: 'inside' });
  } else if (maxDim > 0 && maxDim < 100) {
    pipeline = pipeline.resize(200, 200, { fit: 'inside', withoutEnlargement: false });
  }

  const processed = await pipeline.jpeg({ quality: 90 }).toBuffer();

  console.log('[Image] ✓ Processed');
  return processed.toString('base64');
}

module.exports = { processImage };

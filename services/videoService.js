const ffmpeg       = require('fluent-ffmpeg');
const ffmpegPath   = require('ffmpeg-static');
const sharp        = require('sharp');
const fs           = require('fs');
const path         = require('path');
const os           = require('os');

ffmpeg.setFfmpegPath(ffmpegPath);

function getVideoDuration(filePath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) return reject(err);
      resolve(metadata.format?.duration || 0);
    });
  });
}

function extractFrameAt(inputPath, outputPath, timestamp) {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .seekInput(Math.max(0, timestamp))
      .frames(1)
      .output(outputPath)
      .on('end', resolve)
      .on('error', reject)
      .run();
  });
}

async function extractVideoFrames(videoData, numFrames = 5) {
  let base64 = typeof videoData === 'string' ? videoData : videoData.toString();

  if (base64.startsWith('data:')) {
    base64 = base64.split(',')[1];
  }

  base64 = base64.replace(/\s/g, '');

  const videoBuffer = Buffer.from(base64, 'base64');

  if (videoBuffer.length < 1000) throw new Error('Video too small or corrupted.');

  const sizeMB = videoBuffer.length / (1024 * 1024);
  if (sizeMB > 100) throw new Error(`Video too large (${sizeMB.toFixed(1)} MB). Max 100 MB.`);

  const id       = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const tmpDir   = os.tmpdir();
  const inputPath = path.join(tmpDir, `illia_vid_${id}.mp4`);

  fs.writeFileSync(inputPath, videoBuffer);

  let duration = 0;
  try {
    duration = await getVideoDuration(inputPath);
  } catch (err) {
    throw new Error('Could not read video. Supported formats: MP4, AVI, MOV, WebM, MKV.');
  }

  if (duration <= 0) throw new Error('Video has no readable duration.');

  const frameCount  = Math.min(numFrames, 10);
  const framesPaths = [];
  const framesB64   = [];

  for (let i = 0; i < frameCount; i++) {
    const timestamp = frameCount === 1
      ? duration / 2
      : (i / (frameCount - 1)) * Math.max(0, duration - 0.5);

    const framePath = path.join(tmpDir, `illia_frame_${id}_${i}.jpg`);
    framesPaths.push(framePath);

    try {
      await extractFrameAt(inputPath, framePath, timestamp);
    } catch {
      continue;
    }

    if (fs.existsSync(framePath)) {
      try {
        const resized = await sharp(framePath)
          .resize(1024, 1024, { fit: 'inside', withoutEnlargement: true })
          .jpeg({ quality: 85 })
          .toBuffer();
        framesB64.push(resized.toString('base64'));
      } catch {
        // skip unreadable frame
      }
    }
  }

  try { fs.unlinkSync(inputPath); } catch {}
  for (const fp of framesPaths) {
    try { fs.unlinkSync(fp); } catch {}
  }

  if (framesB64.length === 0) throw new Error('Could not extract any frames from the video.');

  console.log(`[Video] ✓ Extracted ${framesB64.length} frames — duration: ${duration.toFixed(1)}s`);
  return { frames: framesB64, duration };
}

module.exports = { extractVideoFrames };

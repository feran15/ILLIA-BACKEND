const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { Timestamp } = require('firebase-admin/firestore');
const { storage, db } = require('../config/firebase');
const cloudinary = require('../config/cloudinary')
const streamifier = require('streamifier');
const multer = require('multer');
const router = express.Router();


const upload = multer({
  storage: multer.memoryStorage(),
})
function mediaRef(uid) {
  return db.collection('users')
    .doc(uid)
    .collection('media');
}

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const snapshot = await mediaRef(req.user.uid)
      .orderBy('created_at', 'desc')
      .get();

    const items = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      created_at:
        doc.data().created_at?.toDate?.()?.toISOString(),
    }));

    res.json({
      status: 'success',
      items,
    });

  } catch (err) {
    next(err);
  }
});



router.post('/', requireAuth, async (req, res, next) => {
  try {
    const {
      title = 'Untitled',
      file_url,
      media_type,
      source = 'uploaded',
      prompt = '',
    } = req.body;

    if (!file_url || !media_type) {
      return res.status(400).json({
        error: 'file_url and media_type are required',
      });
    }

    const item = {
      title,
      file_url,
      media_type,
      source,
      prompt,
      created_at: Timestamp.now(),
    };

    const ref = await mediaRef(req.user.uid).add(item);

    res.status(201).json({
      status: 'success',
      item: {
        id: ref.id,
        ...item,
      },
    });

  } catch (err) {
    next(err);
  }
});

router.post( '/upload', requireAuth, upload.single('file'),
  async (req, res, next) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          error: 'No file uploaded',
        });
      }

      const result = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            folder: `illia/${req.user.uid}`,
            resource_type: 'auto', // images + videos
          },
          (error, result) => {
            if (error) return reject(error);
            resolve(result);
          }
        );

        streamifier.createReadStream(req.file.buffer).pipe(stream);
      });

      res.json({
        status: 'success',
        file_url: result.secure_url,
      });

    } catch (err) {
      next(err);
    }
  }
);

router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const ref = mediaRef(req.user.uid)
      .doc(req.params.id);

    const doc = await ref.get();

    if (!doc.exists) {
      return res
        .status(404)
        .json({
          error: 'Media not found',
        });
    }

    await ref.delete();

    res.json({
      status: 'success',
      message: 'Deleted',
    });

  } catch (err) {
    next(err);
  }
});

module.exports = router;
const express = require('express');
const { db } = require('../config/firebase');
const { requireAuth } = require('../middleware/auth');
const { Timestamp } = require('firebase-admin/firestore');

const router = express.Router();

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
      title,
      file_url,
      media_type,
      source,
      prompt,
    } = req.body;

    const item = {
      title,
      file_url,
      media_type,
      source: source || 'uploaded',
      prompt: prompt || '',
      created_at: Timestamp.now(),
    };

    const ref = await mediaRef(req.user.uid)
      .add(item);

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
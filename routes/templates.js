const express = require('express');
const { db } = require('../config/firebase');
const { requireAuth } = require('../middleware/auth');
const { Timestamp } = require('firebase-admin/firestore');

const router = express.Router();

function templatesRef(uid) {
  return db
    .collection('users')
    .doc(uid)
    .collection('templates');
}

/*
GET ALL TEMPLATES
*/
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const snapshot = await templatesRef(req.user.uid)
      .orderBy('is_favorite', 'desc')
      .get();

    const templates = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    res.json({
      status: 'success',
      templates,
    });
  } catch (err) {
    next(err);
  }
});

/*
CREATE TEMPLATE
*/
router.post('/', requireAuth, async (req, res, next) => {
  try {
    const {
      name,
      content,
      type,
      platforms,
    } = req.body;

    if (!name || !content) {
      return res.status(400).json({
        error: 'Name and content are required.',
      });
    }

    const template = {
      name,
      content,
      type: type || 'caption',
      platforms: Array.isArray(platforms)
        ? platforms
        : [],
      is_favorite: false,
      use_count: 0,
      created_at: Timestamp.now(),
      uid: req.user.uid,
    };

    const ref = await templatesRef(
      req.user.uid
    ).add(template);

    res.status(201).json({
      status: 'success',
      template: {
        id: ref.id,
        ...template,
      },
    });
  } catch (err) {
    next(err);
  }
});

/*
UPDATE TEMPLATE
*/
router.put('/:id', requireAuth, async (req, res, next) => {
  try {
    const ref = templatesRef(
      req.user.uid
    ).doc(req.params.id);

    const doc = await ref.get();

    if (!doc.exists) {
      return res.status(404).json({
        error: 'Template not found',
      });
    }

    await ref.update({
      ...req.body,
      updated_at: Timestamp.now(),
    });

    res.json({
      status: 'success',
      message: 'Template updated',
    });
  } catch (err) {
    next(err);
  }
});

/*
DELETE TEMPLATE
*/
router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const ref = templatesRef(
      req.user.uid
    ).doc(req.params.id);

    const doc = await ref.get();

    if (!doc.exists) {
      return res.status(404).json({
        error: 'Template not found',
      });
    }

    await ref.delete();

    res.json({
      status: 'success',
      message: 'Template deleted',
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
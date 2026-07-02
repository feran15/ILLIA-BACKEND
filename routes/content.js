const express = require('express');
const { db } = require('../config/firebase');

const router = express.Router();

router.post('/save', async (req, res) => {
  try {
    const uid = req.user.uid;

    const ref = await db
      .collection('users')
      .doc(uid)
      .collection('savedContent')
      .add({
        ...req.body,
        createdAt: new Date().toISOString(),
      });

    res.json({
      id: ref.id,
      success: true,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: 'Failed to save content',
    });
  }
});

router.get('/saved', async (req, res) => {
  try {
    const uid = req.user.uid;

    const snapshot = await db
      .collection('users')
      .doc(uid)
      .collection('savedContent')
      .orderBy('createdAt', 'desc')
      .get();

    const items = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    res.json(items);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to fetch saved content',
    });
  }
});

module.exports = router;
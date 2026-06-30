  const express         = require('express');
  const { db }          = require('../config/firebase');
  const { requireAuth } = require('../middleware/auth');
  const { Timestamp }   = require('firebase-admin/firestore');

  const router = express.Router();

  function postsRef(uid) {
    return db.collection('users').doc(uid).collection('posts');
  }

  // Get all posts for the authenticated user
  router.get('/posts', requireAuth, async (req, res, next) => {
  try {
    const snapshot = await postsRef(req.user.uid)
      .orderBy('scheduled_at', 'asc')
      .get();

    const posts = snapshot.docs.map((doc) => {
      const data = doc.data();

      const scheduledAt = data.scheduled_at?.toDate();

      return {
        id: doc.id,
        ...data,

        // Keep the original field
        scheduled_at: scheduledAt?.toISOString(),

        // Frontend compatibility
        scheduled_date: scheduledAt
          ? scheduledAt.toISOString().split('T')[0]
          : null,

        scheduled_time: scheduledAt
          ? scheduledAt.toTimeString().slice(0, 5)
          : null,
      };
    });

    res.json({
      status: 'success',
      posts,
      count: posts.length,
    });
  } catch (err) {
    next(err);
  }
});

  // Get a single post
  router.get('/posts/:id', requireAuth, async (req, res, next) => {
  try {
    const doc = await postsRef(req.user.uid)
      .doc(req.params.id)
      .get();

    if (!doc.exists) {
      return res.status(404).json({
        error: 'Post not found.',
      });
    }

    const data = doc.data();
    const scheduledAt = data.scheduled_at?.toDate();

    res.json({
      status: 'success',
      post: {
        id: doc.id,
        ...data,

        scheduled_at: scheduledAt?.toISOString(),

        scheduled_date: scheduledAt
          ? scheduledAt.toISOString().split('T')[0]
          : null,

        scheduled_time: scheduledAt
          ? scheduledAt.toTimeString().slice(0, 5)
          : null,
      },
    });
  } catch (err) {
    next(err);
  }
});

  // Schedule a new post
  router.post('/posts', requireAuth, async (req, res, next) => {
    try {
      const { title, content, platforms, scheduled_at, publish_mode, fcm_token } = req.body;

      if (!content) return res.status(400).json({ error: 'Post content is required.' });
      if (!scheduled_at) return res.status(400).json({ error: 'scheduled_at is required.' });

      const scheduledDate = new Date(scheduled_at);
      if (isNaN(scheduledDate.getTime())) return res.status(400).json({ error: 'Invalid scheduled_at date.' });

      const post = {
        title:          title || '',
        content,
        platforms:      Array.isArray(platforms) ? platforms : [],
        scheduled_at:   Timestamp.fromDate(scheduledDate),
        publish_mode:   publish_mode || 'reminder_only',
        status:         'pending',
        fcm_token:      fcm_token || null,
        reminders_sent: {},
        uid:            req.user.uid,
        created_at:     Timestamp.now(),
      };

      const ref = await postsRef(req.user.uid).add(post);
      console.log(`[Calendar] Post scheduled: ${ref.id} for ${scheduledDate.toISOString()}`);
      res.status(201).json({
  status: 'success',
  post: {
    id: ref.id,
    ...post,

    scheduled_at: scheduledDate.toISOString(),
    scheduled_date: scheduledDate.toISOString().split('T')[0],
    scheduled_time: scheduledDate.toTimeString().slice(0, 5),
  },
});
    } catch (err) {
      next(err);
    }
  });

  // Update a post
  router.put('/posts/:id', requireAuth, async (req, res, next) => {
    try {
      const ref = postsRef(req.user.uid).doc(req.params.id);
      const doc = await ref.get();
      if (!doc.exists) return res.status(404).json({ error: 'Post not found.' });

      const allowed   = ['title', 'content', 'platforms', 'scheduled_at', 'publish_mode', 'status', 'fcm_token'];
      const updates   = {};

      for (const key of allowed) {
        if (req.body[key] !== undefined) {
          updates[key] = key === 'scheduled_at' ? Timestamp.fromDate(new Date(req.body[key])) : req.body[key];
        }
      }

      if (updates.scheduled_at) updates.reminders_sent = {};

      await ref.update({ ...updates, updated_at: Timestamp.now() });
      res.json({ status: 'success', message: 'Post updated.' });
    } catch (err) {
      next(err);
    }
  });

  // Delete a post
  router.delete('/posts/:id', requireAuth, async (req, res, next) => {
    try {
      const ref = postsRef(req.user.uid).doc(req.params.id);
      const doc = await ref.get();
      if (!doc.exists) return res.status(404).json({ error: 'Post not found.' });
      await ref.delete();
      console.log(`[Calendar] Post deleted: ${req.params.id}`);
      res.json({ status: 'success', message: 'Post deleted.' });
    } catch (err) {
      next(err);
    }
  });

  module.exports = router;

const cron      = require('node-cron');
const { db, messaging } = require('../config/firebase');
const { Timestamp } = require('firebase-admin/firestore');

const REMINDERS = [
  { key: 'r4h', targetMins: 240, title: '⏰ 4 hours until your post!' },
  { key: 'r2h', targetMins: 120, title: '⏰ 2 hours until your post!' },
  { key: 'r5m', targetMins:   5, title: '🚨 Post in 5 minutes — go post!' },
];

async function sendReminders() {
  try {
    const now       = new Date();
    const lookahead = new Date(now.getTime() + 245 * 60 * 1000);

    console.log(`[Reminders] Checking posts due before ${lookahead.toISOString().slice(11, 16)} UTC`);

    const snapshot = await db
      .collectionGroup('posts')
      .where('status', '==', 'pending')
      .where('scheduled_at', '>=', Timestamp.fromDate(now))
      .where('scheduled_at', '<=', Timestamp.fromDate(lookahead))
      .get();

    console.log(`[Reminders] Posts found: ${snapshot.size}`);

    for (const doc of snapshot.docs) {
      const data      = doc.data();
      const token     = data.fcm_token;
      const postTime  = data.scheduled_at?.toDate?.();

      if (!token || !postTime) continue;

      const minsUntil = (postTime - now) / 60000;
      const sent      = data.reminders_sent || {};
      const updates   = {};

      for (const { key, targetMins, title } of REMINDERS) {
        if (sent[key]) continue;
        if (minsUntil < targetMins - 5 || minsUntil > targetMins + 5) continue;

        const platforms = (data.platforms || []).map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(', ');
        const preview   = (data.content || '').slice(0, 80);

        try {
          await messaging.send({
            token,
            notification: { title, body: `${platforms}: "${preview}"` },
            android: { priority: 'high' },
            webpush: { fcmOptions: { link: '/calendar/' } },
          });
          updates[`reminders_sent.${key}`] = true;
          console.log(`[Reminders] Sent ${key} for post ${doc.id} → ${platforms}`);
        } catch (err) {
          console.error(`[Reminders] FCM send failed for ${doc.id}:`, err.message);
        }
      }

      if (Object.keys(updates).length) {
        await doc.ref.update(updates);
      }
    }
  } catch (err) {
    console.error('[Reminders] Error:', err.message);
  }
}

function start() {
  cron.schedule('*/5 * * * *', sendReminders, { timezone: 'UTC' });
  console.log('[Reminders] Scheduler started — every 5 minutes');
  sendReminders();
}

module.exports = { start };

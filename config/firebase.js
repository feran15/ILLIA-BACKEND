const admin = require('firebase-admin');

function init() {
  if (admin.apps.length) return;

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;

  if (!raw) {
    console.error('[Firebase] Missing FIREBASE_SERVICE_ACCOUNT');
    process.exit(1);
  }

  let serviceAccount;

  try {
    serviceAccount = JSON.parse(raw);
  } catch (err) {
    console.error('[Firebase] JSON parse failed');
    console.error(err.message);
    process.exit(1); // IMPORTANT FIX
  }

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });

  console.log('[Firebase] Initialised OK');
}

init();

const db = admin.firestore();
const messaging = admin.messaging();

/**
 * REAL FIRESTORE CONNECTIVITY TEST
 */
async function testFirestore() {
  try {
    const ref = db.collection('_health').doc('ping');

    await ref.set({
      status: 'ok',
      timestamp: new Date()
    });

    console.log('[Firestore] Connection VERIFIED ✅');
  } catch (err) {
    console.error('[Firestore] Connection FAILED ❌');
    console.error(err.message);
  }
}

testFirestore();

module.exports = { admin, db, messaging };
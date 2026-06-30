const express       = require('express');
const { v4: uuidv4 } = require('uuid');
const { requireAuth } = require('../middleware/auth');
const { processImage } = require('../services/imageService');
const { extractVideoFrames } = require('../services/videoService');
const { buildMessages, callGroq } = require('../services/groqService');

const router = express.Router();

const conversationSessions = new Map();
const MAX_HISTORY = 40;

function resolveSessionId(headers, body) {
  return headers['x-session-id']
    || body?.session_id
    || (body?.userId ? `user_${body.userId}` : null)
    || uuidv4();
}

function getHistory(sessionId) {
  if (!conversationSessions.has(sessionId)) conversationSessions.set(sessionId, []);
  return conversationSessions.get(sessionId);
}

function appendHistory(sessionId, role, content) {
  const history = getHistory(sessionId);
  history.push({ role, content });
  if (history.length > MAX_HISTORY) {
    conversationSessions.set(sessionId, history.slice(-MAX_HISTORY));
  }
}

router.post('/', requireAuth, async (req, res, next) => {
  try {
    const sessionId = resolveSessionId(req.headers, req.body);

    const userMessage   = (req.body.message || '').trim();
    const images        = req.body.images || [];
    const video         = req.body.video || null;
    const clientHistory = req.body.history || [];

    if (!userMessage && !images.length && !video) {
      return res.status(400).json({ error: 'Provide a message, image, or video.' });
    }

    console.log(`[Chat] Session: ${sessionId.slice(0, 12)} | Text: ${!!userMessage} | Images: ${images.length} | Video: ${!!video} | History: ${clientHistory.length}`);

    const processedImages = [];
    let videoFrames       = null;

    for (let i = 0; i < images.length; i++) {
      try {
        processedImages.push(await processImage(images[i]));
      } catch (err) {
        return res.status(400).json({ error: `Image ${i + 1} processing failed: ${err.message}` });
      }
    }

    if (video) {
      try {
        const result = await extractVideoFrames(video);
        videoFrames  = result.frames;
      } catch (err) {
        return res.status(400).json({ error: `Video processing failed: ${err.message}` });
      }
    }

    const hasVisual  = processedImages.length > 0 || !!videoFrames;
    const serverHistory = getHistory(sessionId).map(({ role, content }) => ({ role, content }));
    const messages   = buildMessages(serverHistory, clientHistory, userMessage, processedImages, videoFrames);

    console.log(`[Chat] Messages to API: ${messages.length} | Model: ${hasVisual ? 'vision' : 'text'}`);

    const { text: botResponse, model } = await callGroq(messages, hasVisual);

    if (!botResponse) return res.status(500).json({ error: 'Empty response from model.' });

    const userEntry = [
      userMessage,
      processedImages.length ? ` [+${processedImages.length} image(s)]` : '',
      videoFrames            ? ' [+video]'                               : '',
    ].join('');

    appendHistory(sessionId, 'user',      userEntry);
    appendHistory(sessionId, 'assistant', botResponse);

    res.set('X-Session-ID', sessionId).json({
      response:   botResponse,
      session_id: sessionId,
      model_used: model,
      status:     'success',
      timestamp:  new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
});

router.post('/clear-session', requireAuth, (req, res) => {
  const sessionId = resolveSessionId(req.headers, req.body);
  conversationSessions.delete(sessionId);
  console.log(`[Chat] Session cleared: ${sessionId.slice(0, 12)}`);
  res.json({ success: true, message: 'Session cleared.' });
});

function getSessionCount() {
  return conversationSessions.size;
}

module.exports = router;
module.exports.getSessionCount = getSessionCount;

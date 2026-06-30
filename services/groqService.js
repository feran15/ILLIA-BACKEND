const axios        = require('axios');
const SYSTEM_PROMPT = require('../config/systemPrompt');

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

function buildMessages(sessionHistory, clientHistory, userMessage, images, videoFrames) {
  const messages = [{ role: 'system', content: SYSTEM_PROMPT }];

  const history = clientHistory?.length ? clientHistory : sessionHistory;

  for (const msg of history) {
    const role    = msg.role;
    const content = msg.content;
    if (!['user', 'assistant'].includes(role)) continue;
    if (typeof content === 'string' && content.trim()) {
      messages.push({ role, content });
    }
  }

  const currentContent = [];

  if (userMessage) {
    currentContent.push({ type: 'text', text: userMessage });
  }

  if (images?.length) {
    for (const img of images) {
      currentContent.push({
        type: 'image_url',
        image_url: { url: `data:image/jpeg;base64,${img}` },
      });
    }
  }

  if (videoFrames?.length) {
    currentContent.push({
      type: 'text',
      text: `\n[Video Analysis: ${videoFrames.length} key frames extracted]`,
    });
    for (const frame of videoFrames) {
      currentContent.push({
        type: 'image_url',
        image_url: { url: `data:image/jpeg;base64,${frame}` },
      });
    }
  }

  messages.push({ role: 'user', content: currentContent });
  return messages;
}

async function callGroq(messages, hasVisual = false) {
  const model = hasVisual
    ? 'meta-llama/llama-4-scout-17b-16e-instruct'
    : 'llama-3.3-70b-versatile';

  const payload = {
    model,
    messages,
    max_tokens: 1200,
    temperature: 0.8,
    top_p: 0.9,
    stream: true,
  };

  const response = await axios({
    method: 'post',
    url: GROQ_API_URL,
    headers: {
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      'Content-Type': 'application/json',
    },
    data: payload,
    responseType: 'stream',
    timeout: 60000,
  });

  let fullResponse = '';

  await new Promise((resolve, reject) => {
    response.data.on('data', (chunk) => {
      const lines = chunk.toString().split('\n').filter((l) => l.trim());
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const raw = line.slice(6).trim();
        if (raw === '[DONE]') continue;
        try {
          const parsed  = JSON.parse(raw);
          const content = parsed.choices?.[0]?.delta?.content || '';
          fullResponse += content;
        } catch {
          // ignore malformed chunk
        }
      }
    });
    response.data.on('end', resolve);
    response.data.on('error', reject);
  });

  return { text: fullResponse.trim(), model };
}

module.exports = { buildMessages, callGroq };

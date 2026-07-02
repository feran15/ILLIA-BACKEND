// routes/ai.js
const express = require('express');
const Groq = require('groq-sdk');

const router = express.Router();

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

router.post('/generate', async (req, res) => {
  try {
    const {
      prompt,
      model = 'llama-3.3-70b-versatile',
      temperature = 0.8,
      json = false,
    } = req.body;

    const completion = await groq.chat.completions.create({
      model,
      temperature,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
      ...(json && {
        response_format: {
          type: 'json_object',
        },
      }),
    });

    const output = completion.choices[0].message.content;

    res.json({
      success: true,
      output,
    });
  } catch (error) {
    console.error('AI Error:', error);

    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

module.exports = router;
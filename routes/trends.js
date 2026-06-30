const express = require('express');
const {
  getAllTrends,
  searchTrends,
  liveYoutube,
  liveGoogleTrends,
  liveTwitter,
  liveTikTok,
  liveInstagram,
  isLive,
} = require('../services/trendsService');

const router = express.Router();

router.get('/health', (req, res) => {
  const liveCount = Object.values(isLive).filter(Boolean).length;
  res.json({
    status: 'healthy',
    geo_focus: 'Nigeria 🇳🇬',
    timestamp: new Date().toISOString(),
    message: `Naija Trends API — ${liveCount}/5 platforms live`,
    platforms: {
      youtube:       { live: isLive.youtube,   status: isLive.youtube   ? '✅ LIVE' : '⚡ Fallback' },
      google_trends: { live: isLive.google,    status: '✅ LIVE' },
      twitter:       { live: isLive.twitter,   status: isLive.twitter   ? '✅ LIVE' : '⚡ Fallback' },
      tiktok:        { live: isLive.tiktok,    status: isLive.tiktok    ? '✅ LIVE' : '⚡ Fallback' },
      instagram:     { live: isLive.instagram, status: isLive.instagram ? '✅ LIVE' : '⚡ Fallback' },
    },
    live_platforms: liveCount,
    total_platforms: 5,
  });
});

router.get('/all', async (req, res, next) => {
  try {
    console.log(`[Trends] Fetching all platforms...`);
    const { platforms, topTrending, total } = await getAllTrends();
    res.json({
      geo_focus:    'Nigeria 🇳🇬',
      status:       'success',
      timestamp:    new Date().toISOString(),
      topTrending,
      platforms,
      live_data_status: isLive,
      total_trends: total,
    });
  } catch (err) {
    next(err);
  }
});

router.get('/search', async (req, res, next) => {
  const query = (req.query.q || '').trim();

  if (!query) {
    return res.status(400).json({
      error: 'Provide a search query.',
      example: '/api/trends/search?q=afrobeats',
      popular_topics: ['afrobeats', 'super eagles', 'japa', 'bbnaija', 'nollywood', 'fintech', 'jollof', 'owambe'],
    });
  }

  try {
    console.log(`[Trends] Search: "${query}"`);
    const result = await searchTrends(query);
    res.json({
      query,
      geo_focus: 'Nigeria 🇳🇬',
      status:    'success',
      timestamp: new Date().toISOString(),
      ...result,
    });
  } catch (err) {
    next(err);
  }
});

router.get('/youtube', async (req, res, next) => {
  try {
    res.json({ platform: 'youtube', geo_focus: 'Nigeria 🇳🇬', trends: await liveYoutube(), timestamp: new Date().toISOString() });
  } catch (err) { next(err); }
});

router.get('/google', async (req, res, next) => {
  try {
    res.json({ platform: 'google', geo_focus: 'Nigeria 🇳🇬', trends: await liveGoogleTrends(), timestamp: new Date().toISOString() });
  } catch (err) { next(err); }
});

router.get('/twitter', async (req, res, next) => {
  try {
    res.json({ platform: 'twitter', geo_focus: 'Nigeria 🇳🇬', trends: await liveTwitter(), timestamp: new Date().toISOString() });
  } catch (err) { next(err); }
});

router.get('/tiktok', async (req, res, next) => {
  try {
    res.json({ platform: 'tiktok', geo_focus: 'Nigeria 🇳🇬', trends: await liveTikTok(), timestamp: new Date().toISOString() });
  } catch (err) { next(err); }
});

router.get('/instagram', async (req, res, next) => {
  try {
    res.json({ platform: 'instagram', geo_focus: 'Nigeria 🇳🇬', trends: await liveInstagram(), timestamp: new Date().toISOString() });
  } catch (err) { next(err); }
});

module.exports = router;

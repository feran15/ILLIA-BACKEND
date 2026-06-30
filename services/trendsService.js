const axios        = require('axios');
const googleTrends = require('google-trends-api');
const {
  TIKTOK_BANK,
  INSTAGRAM_BANK,
  TWITTER_BANK,
  YOUTUBE_BANK,
  GOOGLE_BANK,
  TOPIC_CATEGORY_MAP,
  TREND_TEMPLATES,
} = require('../data/naijaTrends');

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const RAPIDAPI_KEY    = process.env.RAPIDAPI_KEY;

const RAPIDAPI_HOST_TIKTOK    = 'tiktok-scraper7.p.rapidapi.com';
const RAPIDAPI_HOST_INSTAGRAM = 'instagram-scraper-api2.p.rapidapi.com';
const RAPIDAPI_HOST_TWITTER   = 'twitter-api45.p.rapidapi.com';

function timeMultiplier() {
  const now  = new Date();
  const hour = now.getUTCHours();
  const day  = now.getUTCDay();

  let mult;
  if (hour >= 20)           mult = 2.0;
  else if (hour >= 8  && hour < 10) mult = 1.5;
  else if (hour >= 12 && hour < 14) mult = 1.3;
  else if (hour >= 15 && hour < 20) mult = 1.4;
  else if (hour >= 0  && hour < 2)  mult = 1.1;
  else                      mult = 0.75;

  if (day === 0 || day === 6) mult *= 1.35;
  return mult;
}

function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateMetrics(platform, base) {
  const m = timeMultiplier();

  if (platform === 'tiktok') {
    const v = Math.floor((base || rand(200_000, 18_000_000)) * m);
    return { views: v, likes: Math.floor(v * (0.07 + Math.random() * 0.07)), comments: Math.floor(v * (0.008 + Math.random() * 0.014)), shares: Math.floor(v * (0.015 + Math.random() * 0.03)) };
  }
  if (platform === 'instagram') {
    const v = Math.floor((base || rand(30_000, 1_500_000)) * m);
    return { views: v * rand(8, 18), likes: v, comments: Math.floor(v * (0.012 + Math.random() * 0.028)), saves: Math.floor(v * (0.018 + Math.random() * 0.037)) };
  }
  if (platform === 'twitter') {
    const v = Math.floor((base || rand(10_000, 1_000_000)) * m);
    return { views: v * rand(15, 40), likes: v, comments: Math.floor(v * (0.025 + Math.random() * 0.075)), retweets: Math.floor(v * (0.04 + Math.random() * 0.09)) };
  }
  if (platform === 'youtube') {
    const v = Math.floor((base || rand(50_000, 20_000_000)) * m);
    return { views: v, likes: Math.floor(v * (0.018 + Math.random() * 0.052)), comments: Math.floor(v * (0.002 + Math.random() * 0.008)), subscribers_gained: Math.floor(v * (0.0008 + Math.random() * 0.0032)) };
  }
  if (platform === 'google') {
    const interest = Math.min(100, Math.floor((base || rand(55, 100)) * m * 0.75));
    return { views: interest * rand(12_000, 22_000), likes: interest * rand(1_000, 2_000), comments: interest * rand(100, 200) };
  }
  return { views: 0, likes: 0, comments: 0 };
}

function bulkFromBank(platform, bank, count = 10) {
  const shuffled = [...bank].sort(() => Math.random() - 0.5).slice(0, count);
  return shuffled
    .map((title) => ({ title, ...generateMetrics(platform) }))
    .sort((a, b) => b.views - a.views);
}

function findBestCategory(query) {
  const q = query.toLowerCase().trim();
  let bestCat = null, bestScore = 0;

  for (const [cat, keywords] of Object.entries(TOPIC_CATEGORY_MAP)) {
    let score = 0;
    if (q === cat) score += 10;
    else if (q.includes(cat) || cat.includes(q)) score += 5;
    for (const kw of keywords) {
      if (kw === q) score += 4;
      else if (kw.includes(q) || q.includes(kw)) score += 2;
      else if (q.split(' ').some((w) => kw.includes(w))) score += 1;
    }
    if (score > bestScore) { bestScore = score; bestCat = cat; }
  }
  return { cat: bestCat, score: bestScore };
}

function generateTopicTrends(query, platform, count = 15) {
  const { cat, score } = findBestCategory(query);
  const label    = cat && score >= 2 ? cat.charAt(0).toUpperCase() + cat.slice(1) : query.trim().replace(/\b\w/g, (c) => c.toUpperCase());
  const templates = [...(TREND_TEMPLATES[platform] || TREND_TEMPLATES.tiktok)].sort(() => Math.random() - 0.5);

  return templates.slice(0, count)
    .map((tmpl) => ({ title: tmpl.replace(/\{topic\}/g, label), platform, ...generateMetrics(platform) }))
    .sort((a, b) => b.views - a.views);
}

function relatedTopicsAndHashtags(query) {
  const { cat } = findBestCategory(query);
  let relatedTopics = [];

  if (cat && TOPIC_CATEGORY_MAP[cat]) {
    const candidates = TOPIC_CATEGORY_MAP[cat].filter((k) => k !== query.toLowerCase() && k.length > 3);
    relatedTopics = candidates.sort(() => Math.random() - 0.5).slice(0, 6)
      .map((k) => k.replace(/\b\w/g, (c) => c.toUpperCase()));
  } else {
    const title = query.replace(/\b\w/g, (c) => c.toUpperCase());
    relatedTopics = [`${title} Nigeria`, `Nigerian ${title}`, `${title} Naija`, `${title} Lagos`, `${title} 2026`, `Best ${title} Nigeria`];
  }

  const clean    = query.replace(/\s+/g, '').replace(/\b\w/g, (c) => c.toUpperCase());
  const hashtags = [`#${clean}`, `#Naija${clean}`, `#${clean}Nigeria`, `#Nigerian${clean}`, `#${clean}2026`, `#Naija${clean}Vibes`, `#Lagos${clean}`];

  return { relatedTopics: relatedTopics.slice(0, 6), hashtags: hashtags.slice(0, 7) };
}

async function liveGoogleTrends() {
  try {
    const result = await googleTrends.dailyTrends({ trendDate: new Date(), geo: 'NG' });
    const data   = JSON.parse(result);
    const items  = data.default?.trendingSearchesDays?.[0]?.trendingSearches || [];
    const trends = items.slice(0, 15).map((item) => ({
      title: item.title?.query || 'Trending',
      ...generateMetrics('google'),
    }));
    if (trends.length) { console.log(`[Google Trends] ✓ ${trends.length} live results`); return trends; }
  } catch (err) {
    console.log(`[Google Trends] Live failed: ${err.message}`);
  }
  return bulkFromBank('google', GOOGLE_BANK, 10);
}

async function liveGoogleSearch(query) {
  const results = [];
  try {
    const result = await googleTrends.relatedQueries({
      keyword: query,
      geo: 'NG',
      startTime: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    });
    const data = JSON.parse(result);
    const all  = data?.default?.rankedList || [];
    for (const list of all) {
      for (const item of (list.rankedKeyword || []).slice(0, 5)) {
        results.push({ title: item.query, platform: 'google', source: 'live', ...generateMetrics('google') });
      }
    }
    console.log(`[Google Search] ✓ ${results.length} results for "${query}"`);
  } catch (err) {
    console.log(`[Google Search] Failed for "${query}": ${err.message}`);
  }
  return results;
}

async function liveYoutube() {
  if (!YOUTUBE_API_KEY || YOUTUBE_API_KEY === 'your_youtube_api_key_here') {
    return bulkFromBank('youtube', YOUTUBE_BANK, 10);
  }
  try {
    const res = await axios.get('https://www.googleapis.com/youtube/v3/videos', {
      params: { part: 'snippet,statistics', chart: 'mostPopular', regionCode: 'NG', maxResults: 15, key: YOUTUBE_API_KEY },
      timeout: 15000,
    });
    const trends = (res.data.items || []).map((v) => ({
      title: v.snippet?.title || 'YouTube Video',
      views: parseInt(v.statistics?.viewCount || 0, 10),
      likes: parseInt(v.statistics?.likeCount || 0, 10),
      comments: parseInt(v.statistics?.commentCount || 0, 10),
      channel: v.snippet?.channelTitle || 'Unknown',
      thumbnail: v.snippet?.thumbnails?.high?.url || '',
    }));
    console.log(`[YouTube] ✓ ${trends.length} live results`);
    return trends;
  } catch (err) {
    console.log(`[YouTube] Live failed: ${err.message}`);
    return bulkFromBank('youtube', YOUTUBE_BANK, 10);
  }
}

async function liveTikTok() {
  if (!RAPIDAPI_KEY || RAPIDAPI_KEY === 'your_rapidapi_key_here') {
    return bulkFromBank('tiktok', TIKTOK_BANK, 10);
  }
  try {
    const res = await axios.get(`https://${RAPIDAPI_HOST_TIKTOK}/challenge/search`, {
      headers: { 'X-RapidAPI-Key': RAPIDAPI_KEY, 'X-RapidAPI-Host': RAPIDAPI_HOST_TIKTOK },
      params: { keywords: 'naija trending nigeria', count: '10' },
      timeout: 10000,
    });
    const challenges = res.data?.data?.challenge_list || [];
    const trends = challenges.slice(0, 10).map((ch) => {
      const title = ch?.challenge_info?.title || 'TikTok Challenge';
      return { title: `#${title} 🇳🇬`, ...generateMetrics('tiktok', ch?.view_count) };
    });
    if (trends.length) { console.log(`[TikTok] ✓ ${trends.length} live results`); return trends; }
  } catch (err) {
    console.log(`[TikTok] Live failed: ${err.message}`);
  }
  return bulkFromBank('tiktok', TIKTOK_BANK, 10);
}

async function liveInstagram() {
  if (!RAPIDAPI_KEY || RAPIDAPI_KEY === 'your_rapidapi_key_here') {
    return bulkFromBank('instagram', INSTAGRAM_BANK, 10);
  }
  const hashtags = ['naija', 'lagos', 'afrobeats', 'nigerianfashion', 'nollywood', 'naijafood', 'naijabeauty', 'abuja', 'naijavibes', 'africaisfashion'];
  const trends   = [];
  try {
    for (const tag of hashtags) {
      try {
        const res = await axios.get(`https://${RAPIDAPI_HOST_INSTAGRAM}/v1/hashtag`, {
          headers: { 'X-RapidAPI-Key': RAPIDAPI_KEY, 'X-RapidAPI-Host': RAPIDAPI_HOST_INSTAGRAM },
          params: { hashtag: tag },
          timeout: 5000,
        });
        const count = res.data?.data?.edge_hashtag_to_media?.count || 0;
        trends.push({ title: `#${tag} trending 🇳🇬`, ...generateMetrics('instagram', count) });
        if (trends.length >= 10) break;
      } catch { continue; }
    }
    if (trends.length) { console.log(`[Instagram] ✓ ${trends.length} live results`); return trends; }
  } catch (err) {
    console.log(`[Instagram] Live failed: ${err.message}`);
  }
  return bulkFromBank('instagram', INSTAGRAM_BANK, 10);
}

async function liveTwitter() {
  if (!RAPIDAPI_KEY || RAPIDAPI_KEY === 'your_rapidapi_key_here') {
    return bulkFromBank('twitter', TWITTER_BANK, 10);
  }
  try {
    const res = await axios.get(`https://${RAPIDAPI_HOST_TWITTER}/trends.php`, {
      headers: { 'X-RapidAPI-Key': RAPIDAPI_KEY, 'X-RapidAPI-Host': RAPIDAPI_HOST_TWITTER },
      params: { woeid: '2347283' },
      timeout: 10000,
    });
    const items = Array.isArray(res.data) ? res.data : res.data?.trends || [];
    const trends = items.slice(0, 10)
      .filter((i) => typeof i === 'object')
      .map((i) => ({ title: i.name || 'Trending', ...generateMetrics('twitter', i.tweet_volume) }));
    if (trends.length) { console.log(`[Twitter] ✓ ${trends.length} live results`); return trends; }
  } catch (err) {
    console.log(`[Twitter] Live failed: ${err.message}`);
  }
  return bulkFromBank('twitter', TWITTER_BANK, 10);
}

async function getAllTrends() {
  const [youtube, google, twitter, tiktok, instagram] = await Promise.all([
    liveYoutube(), liveGoogleTrends(), liveTwitter(), liveTikTok(), liveInstagram(),
  ]);

  const flat = [
    ...youtube.map((t) => ({ ...t, platform: 'youtube' })),
    ...google.map((t)  => ({ ...t, platform: 'google' })),
    ...twitter.map((t) => ({ ...t, platform: 'twitter' })),
    ...tiktok.map((t)  => ({ ...t, platform: 'tiktok' })),
    ...instagram.map((t) => ({ ...t, platform: 'instagram' })),
  ];

  const topTrending = [...flat].sort((a, b) => b.views - a.views).slice(0, 10);
  return { platforms: { youtube, google, twitter, tiktok, instagram }, topTrending, total: flat.length };
}

async function searchTrends(query) {
  const liveGoogle = await liveGoogleSearch(query);

  const platforms = {};
  for (const platform of ['tiktok', 'instagram', 'youtube', 'twitter', 'google']) {
    const generated = generateTopicTrends(query, platform, 15);
    platforms[platform] = platform === 'google' && liveGoogle.length
      ? [...liveGoogle, ...generated].slice(0, 15)
      : generated;
  }

  const flat = Object.entries(platforms).flatMap(([pf, trends]) => trends.map((t) => ({ ...t, platform: pf })));
  const topTrending = [...flat].sort((a, b) => b.views - a.views).slice(0, 10);
  const latest = Object.entries(platforms).map(([pf, trends]) => ({ ...(trends.at(-1) || {}), platform: pf }));

  return {
    platforms,
    topTrending,
    latest,
    hasLiveData: liveGoogle.length > 0,
    ...relatedTopicsAndHashtags(query),
    totalResults: flat.length,
  };
}

const isLive = {
  youtube:   !!(YOUTUBE_API_KEY && YOUTUBE_API_KEY !== 'your_youtube_api_key_here'),
  google:    true,
  twitter:   !!(RAPIDAPI_KEY && RAPIDAPI_KEY !== 'your_rapidapi_key_here'),
  tiktok:    !!(RAPIDAPI_KEY && RAPIDAPI_KEY !== 'your_rapidapi_key_here'),
  instagram: !!(RAPIDAPI_KEY && RAPIDAPI_KEY !== 'your_rapidapi_key_here'),
};

module.exports = {
  getAllTrends,
  searchTrends,
  liveYoutube,
  liveGoogleTrends,
  liveTwitter,
  liveTikTok,
  liveInstagram,
  isLive,
};

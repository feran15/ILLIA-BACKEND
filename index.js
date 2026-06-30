require('dotenv').config();
require('./config/firebase');

const express      = require('express');
const cors         = require('cors');
const { requireAuth } = require('./middleware/auth');
const errorHandler = require('./middleware/errorHandler');
const chatRoutes   = require('./routes/chat');
const trendsRoutes = require('./routes/trends');
const calendarRoutes = require('./routes/calendar');
const reminderService = require('./services/reminderService');
const templatesRoutes = require('./routes/templates');
const mediaRoutes = require('./routes/media');
const app  = express();
const PORT = process.env.PORT || 5000;

app.use(cors({
  origin:         'http://localhost:5173',
  credentials: true,
  methods:        ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Session-ID'],
  exposedHeaders: ['X-Session-ID'],
  maxAge:         3600,
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

app.get('/', (req, res) => {
  res.json({
    status:       'online',
    service:      'ILLIA Backend — Express Edition',
    version:      '3.0.0',
    capabilities: ['chat', 'image analysis', 'video analysis', 'trends', 'calendar', 'fcm reminders'],
    timestamp:    new Date().toISOString(),
  });
});

app.get('/health', (req, res) => {
  res.json({
    status:          'healthy',
    service:         'ILLIA Backend',
    models:          { text: 'llama-3.3-70b-versatile', vision: 'meta-llama/llama-4-scout-17b-16e-instruct' },
    active_sessions: chatRoutes.getSessionCount(),
    timestamp:       new Date().toISOString(),
  });
});

app.use('/api/chat', requireAuth,  chatRoutes);
app.use('/api/trends',  trendsRoutes);
app.use('/api/calendar', requireAuth, calendarRoutes);
app.use('/api/templates', requireAuth, templatesRoutes);
app.use('/api/media', requireAuth, mediaRoutes);
app.use(errorHandler);

reminderService.start();

app.listen(PORT, '0.0.0.0', () => {
  console.log('');
  console.log('==========================================');
  console.log(' ILLIA Backend — Express Edition v3.0.0 ');
  console.log('==========================================');
  console.log(` Port:      ${PORT}`);
  console.log(` Groq:      ${process.env.GROQ_API_KEY && process.env.GROQ_API_KEY !== 'your_groq_api_key_here' ? '✓ Configured' : '✗ Missing'}`);
  console.log(` YouTube:   ${process.env.YOUTUBE_API_KEY && process.env.YOUTUBE_API_KEY !== 'your_youtube_api_key_here' ? '✓ Live' : '⚡ Fallback'}`);
  console.log(` RapidAPI:  ${process.env.RAPIDAPI_KEY && process.env.RAPIDAPI_KEY !== 'your_rapidapi_key_here' ? '✓ Live' : '⚡ Fallback'}`);
  console.log(' Firebase:  ✓ Admin SDK');
  console.log('==========================================');
  console.log(' Routes:');
  console.log('   POST   /chat                    Chat (auth required)');
  console.log('   POST   /chat/clear-session      Clear session (auth required)');
  console.log('   GET    /api/trends/all          All platform trends');
  console.log('   GET    /api/trends/search?q=    Topic search');
  console.log('   GET    /api/trends/:platform    Per-platform trends');
  console.log('   GET    /api/calendar/posts      Get posts (auth required)');
  console.log('   POST   /api/calendar/posts      Schedule post (auth required)');
  console.log('   PUT    /api/calendar/posts/:id  Update post (auth required)');
  console.log('   DELETE /api/calendar/posts/:id  Delete post (auth required)');
  console.log('   GET    /health                  Health check');
  console.log('==========================================');
  console.log('');
});

module.exports = app;

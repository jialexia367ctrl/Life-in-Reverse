// Global error handlers (prevent crash)
process.on('uncaughtException', (err) => {
  console.error('[FATAL] Uncaught Exception:', err.message);
});
process.on('unhandledRejection', (err) => {
  console.error('[FATAL] Unhandled Rejection:', err);
});
// ============================================================
// 反向人生交易所 - Local Development Server
// Express.js + SQLite (Supabase-compatible API)
// ============================================================

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const { getDb } = require('./db');
const { authMiddleware } = require('./middleware/auth');

// Route imports
const { registerGetStories } = require('./routes/get-stories');
const { registerPublishStory } = require('./routes/publish-story');
const { registerCreatePayment } = require('./routes/create-payment');
const { registerSendComfort } = require('./routes/send-comfort');
const { registerUserCenter } = require('./routes/user-center');
const { registerTragedyRank } = require('./routes/tragedy-rank');
const { registerAuth } = require('./routes/auth');
const { registerUserProfile } = require('./routes/user-profile');

const PORT = process.env.PORT || 3001;

async function main() {
  // Initialize database
  const db = await getDb();
  console.log('[DB] SQLite database ready');

  const app = express();

  // Middleware
  app.use(cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    credentials: true,
  }));
  app.use(express.json());

  // Request logging
  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - start;
      if (!req.url.includes('/health')) {
        console.log(`[${req.method}] ${req.url} ${res.statusCode} ${duration}ms`);
      }
    });
    next();
  });

  // Health check
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'reverse-life-exchange', timestamp: new Date().toISOString() });
  });

  // ============================================
  // API Routes
  // ============================================

  // Auth
  registerAuth(app);

  // Stories
  registerGetStories(app);
  registerPublishStory(app);

  // Payments (mock Stripe for local dev)
  registerCreatePayment(app);

  // Comforts
  registerSendComfort(app);

  // User
  registerUserCenter(app);
  registerUserProfile(app);

  // Rankings
  registerTragedyRank(app);

  // ============================================
  // Supabase-compatible REST endpoints
  // (For frontend API wrappers that use supabase.from())
  // ============================================

  // Generic table query endpoint (mimics Supabase PostgREST)
  app.get('/api/rest/:table', authMiddleware, (req, res) => {
    try {
      const { table } = req.params;
      const allowedTables = ['stories', 'transactions', 'comforts', 'user_profiles'];
      if (!allowedTables.includes(table)) {
        return res.status(404).json({ message: 'Table not found' });
      }

      // Build WHERE from query params (excluding special params)
      const { select, order, limit, offset, ...filters } = req.query;

      let sql = `SELECT * FROM ${table}`;
      const params = [];

      const conditions = Object.entries(filters).map(([key, value]) => {
        params.push(value);
        return `${key} = ?`;
      });

      if (conditions.length > 0) {
        sql += ' WHERE ' + conditions.join(' AND ');
      }

      if (order) {
        const [col, dir] = order.split('.');
        sql += ` ORDER BY ${col} ${dir === 'asc' ? 'ASC' : 'DESC'}`;
      }

      if (limit) {
        sql += ` LIMIT ${parseInt(limit)}`;
      }
      if (offset) {
        sql += ` OFFSET ${parseInt(offset)}`;
      }

      const data = require('./db').all(sql, params);

      // Convert is_published from integer to boolean
      const cleaned = data.map(row => {
        const copy = { ...row };
        if ('is_published' in copy) copy.is_published = !!copy.is_published;
        return copy;
      });

      res.json(cleaned);
    } catch (err) {
      console.error('[rest:GET]', err);
      res.status(500).json({ message: err.message });
    }
  });

  // ============================================
  // Seed data for development
  // ============================================
  const { all: dbAll, run: dbRun } = require('./db');
  const existingStories = dbAll('SELECT COUNT(*) as count FROM stories');
  if (existingStories[0].count === 0) {
    console.log('[SEED] Seeding sample data...');
    seedSampleData();
  }

  // Start server
  app.listen(PORT, () => {
    console.log('');
    console.log('  ╔══════════════════════════════════════════════╗');
    console.log('  ║     反向人生交易所 - Backend Server          ║');
    console.log('  ╠══════════════════════════════════════════════╣');
    console.log(`  ║  Server:    http://localhost:${PORT}             ║`);
    console.log(`  ║  Health:    http://localhost:${PORT}/health       ║`);
    console.log(`  ║  Auth:      http://localhost:${PORT}/api/auth     ║`);
    console.log(`  ║  Stories:   http://localhost:${PORT}/api/stories   ║`);
    console.log(`  ║  Ranks:     http://localhost:${PORT}/api/tragedy-rank ║`);
    console.log('  ╚══════════════════════════════════════════════╝');
    console.log('');
    console.log('  Dev mode: payments are auto-completed (no Stripe)');
    console.log('  Sample data loaded for testing');
    console.log('');
  });
}

// ============================================
// Seed Sample Data
// ============================================
function seedSampleData() {
  const { v4: uuidv4 } = require('uuid');
  const { run: dbRun } = require('./db');

  const nicknames = [
    '孤独的星星', '迷路的旅人', '沉默的影子', '流浪的风',
    '倔强的雨', '柔软的月光', '疲惫的海浪', '执着的尘埃',
  ];

  const userIds = [];
  nicknames.forEach((nickname, i) => {
    const id = uuidv4();
    userIds.push(id);
    dbRun(
      'INSERT INTO user_profiles (id, nickname, avatar_url, balance) VALUES (?, ?, ?, ?)',
      [id, nickname, `https://api.dicebear.com/7.x/bottts-neutral/svg?seed=${i}`, Math.random() * 50]
    );
  });

  const sampleStories = [
    { title: '今天被裁员了', content: '工作了三年的公司突然通知裁员，HR给了我30分钟收拾东西。看着桌上那盆养了两年的绿萝，不知道该带走还是留下。走出大楼的时候，保安还在跟我打招呼说"明天见"。', category: 'work', pain_level: 7, price: 3.99 },
    { title: '相亲又失败了', content: '第三次相亲被拒绝，对方说我"太老实了"。回到家妈妈问我怎么样，我笑着说"挺好的，没看上我"。她假装去厨房切菜，但我听到了她叹气的声音。', category: 'love', pain_level: 5, price: 2.99 },
    { title: '父亲住院了', content: '接到妈妈电话的时候正在开会，她说"你爸住院了，不严重"。我知道她说不严重就是很严重。请了假赶到医院，看到她一个人坐在走廊的塑料椅上，手里还攥着医保卡。', category: 'family', pain_level: 8, price: 4.99 },
    { title: '一个人过生日', content: '今天生日，手机从早到晚没有一条祝福。晚上给自己煮了一碗面，点了根蜡烛，吹灭的时候许了个愿：希望明年能有人一起吃蛋糕。', category: 'social', pain_level: 6, price: 1.99 },
    { title: '被确诊了', content: '拿到体检报告的那一刻，世界突然变得很安静。医生说了很多话，我只听清了"需要进一步检查"。走出医院，阳光很好，但我只觉得冷。', category: 'health', pain_level: 9, price: 5.99 },
    { title: '房租又涨了', content: '房东通知下个月涨租500，我算了算银行卡余额，如果交了房租这个月只能吃泡面了。在深圳待了五年，好像越来越看不到希望。', category: 'other', pain_level: 4, price: 1.99 },
    { title: '孩子不愿跟我说话了', content: '儿子上初中后就不再跟我聊天了。今天想跟他谈谈心，他戴上耳机说"爸，你不懂"。关上门的那一刻，我突然意识到他真的长大了，而我已经被推到了他的世界之外。', category: 'family', pain_level: 6, price: 3.49 },
    { title: '项目失败了', content: '熬了三个月的项目今天被告知砍掉，老板说"方向不对"。三年的加班记录、无数个通宵、那些因为工作错过的朋友聚会，好像突然都没有了意义。', category: 'work', pain_level: 7, price: 4.49 },
  ];

  sampleStories.forEach((story, i) => {
    const storyId = uuidv4();
    const authorId = userIds[i % userIds.length];
    const daysAgo = Math.floor(Math.random() * 14);
    const createdAt = new Date(Date.now() - daysAgo * 86400000).toISOString();

    dbRun(
      `INSERT INTO stories (id, title, content, category, pain_level, price, author_id, created_at, buy_count, comfort_count, is_published)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [storyId, story.title, story.content, story.category, story.pain_level, story.price, authorId, createdAt,
       Math.floor(Math.random() * 20), Math.floor(Math.random() * 15)]
    );
  });

  console.log(`[SEED] Created ${nicknames.length} users and ${sampleStories.length} stories`);
}

main().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});


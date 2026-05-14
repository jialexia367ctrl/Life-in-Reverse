// ============================================================
// Auth Middleware - Anonymous Token System
// Mimics Supabase anonymous auth for local development
// ============================================================

const { v4: uuidv4 } = require('uuid');
const { get, run, all } = require('../db');

// In-memory token store: token -> { userId, createdAt }
const tokenStore = new Map();

// Nickname generation (mirrors DB trigger)
const ADJECTIVES = [
  '安静的','迷路的','勇敢的','沉默的','流浪的','倔强的','柔软的','疲惫的',
  '孤独的','温柔的','迷茫的','执着的','失落的','透明的','模糊的','忧伤的',
];
const NOUNS = [
  '星星','旅人','影子','风','雨','月光','海浪','尘埃',
  '落叶','萤火','浪花','石头','云','雪','雾','梦',
];

function generateNickname() {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  return adj + noun;
}

function generateAvatarUrl(seed) {
  return `https://api.dicebear.com/7.x/bottts-neutral/svg?seed=${seed}`;
}

/**
 * Create a new anonymous user. Returns { userId, token }.
 */
function createAnonymousUser() {
  const userId = uuidv4();
  const token = 'anon_' + uuidv4().replace(/-/g, '');
  const nickname = generateNickname();
  const avatarUrl = generateAvatarUrl(userId.slice(0, 8));

  run(
    'INSERT INTO user_profiles (id, nickname, avatar_url, balance) VALUES (?, ?, ?, 0)',
    [userId, nickname, avatarUrl]
  );

  tokenStore.set(token, { userId, createdAt: Date.now() });

  return { userId, token, nickname, avatarUrl };
}

/**
 * Authenticate from token. Returns userId or null.
 */
function authenticate(token) {
  if (!token) return null;

  // Strip "Bearer " prefix
  const cleanToken = token.replace(/^Bearer\s+/i, '');

  const session = tokenStore.get(cleanToken);
  if (!session) return null;

  // Check if user still exists in DB
  const user = get('SELECT id FROM user_profiles WHERE id = ?', [session.userId]);
  return user ? session.userId : null;
}

/**
 * Restore or create session (mimics Supabase session persistence).
 * For local dev, generates a new user each server restart.
 */
function restoreOrCreateSession() {
  // Check if any users exist
  const existingUsers = all('SELECT id FROM user_profiles LIMIT 1');
  if (existingUsers.length > 0) {
    // For demo: create a fresh anonymous user each time
    // In production, this would check localStorage/sessionStorage
  }
  return createAnonymousUser();
}

/**
 * Auth middleware - extracts and validates auth token.
 * Attaches userId to req.auth.userId.
 */
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    req.auth = { userId: null };
    return next();
  }

  const userId = authenticate(authHeader);
  req.auth = { userId };
  next();
}

/**
 * Required auth middleware - rejects if not authenticated.
 */
function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ message: '未登录', code: 'UNAUTHORIZED' });
  }

  const userId = authenticate(authHeader);
  if (!userId) {
    return res.status(401).json({ message: '未登录', code: 'UNAUTHORIZED' });
  }

  req.auth = { userId };
  next();
}

module.exports = {
  createAnonymousUser,
  authenticate,
  restoreOrCreateSession,
  authMiddleware,
  requireAuth,
  tokenStore,
};

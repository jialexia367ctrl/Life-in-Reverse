// ============================================================
// Route: Auth - Anonymous sign-in/sign-out
// ============================================================

const { createAnonymousUser, tokenStore } = require('../middleware/auth');

function registerAuth(app) {
  // Anonymous sign-in (mimics Supabase signInAnonymously)
  app.post('/api/auth/sign-in', (req, res) => {
    try {
      const { userId, token, nickname, avatarUrl } = createAnonymousUser();

      res.json({
        user: {
          id: userId,
          anonymous: true,
          nickname,
          avatar_url: avatarUrl,
        },
        session: {
          access_token: token,
          token_type: 'bearer',
          expires_in: 86400,
        },
      });
    } catch (err) {
      console.error('[auth:sign-in]', err);
      res.status(500).json({ message: '登录失败', code: 'AUTH_ERROR' });
    }
  });

  // Get current session (mimics Supabase getSession)
  app.get('/api/auth/session', (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.json({ session: null, user: null });
    }

    const token = authHeader.replace(/^Bearer\s+/i, '');
    const session = tokenStore.get(token);

    if (!session) {
      return res.json({ session: null, user: null });
    }

    const { get } = require('../db');
    const user = get('SELECT id, nickname, avatar_url FROM user_profiles WHERE id = ?', [session.userId]);

    if (!user) {
      tokenStore.delete(token);
      return res.json({ session: null, user: null });
    }

    res.json({
      session: {
        access_token: token,
        token_type: 'bearer',
        user: { id: user.id, anonymous: true },
      },
      user: { id: user.id, anonymous: true, nickname: user.nickname, avatar_url: user.avatar_url },
    });
  });

  // Sign out
  app.post('/api/auth/sign-out', (req, res) => {
    const authHeader = req.headers.authorization;
    if (authHeader) {
      const token = authHeader.replace(/^Bearer\s+/i, '');
      tokenStore.delete(token);
    }
    res.json({ message: 'ok' });
  });
}

module.exports = { registerAuth };

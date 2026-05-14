// ============================================================
// Route: User Profile
// ============================================================

const { get, run } = require('../db');
const { requireAuth } = require('../middleware/auth');

function registerUserProfile(app) {
  // Get own profile
  app.get('/api/user-profile', requireAuth, (req, res) => {
    try {
      const profile = get('SELECT * FROM user_profiles WHERE id = ?', [req.auth.userId]);
      if (!profile) {
        return res.status(404).json({ message: '用户档案不存在', code: 'PROFILE_NOT_FOUND' });
      }
      res.json({ data: profile });
    } catch (err) {
      console.error('[user-profile:GET]', err);
      res.status(500).json({ message: err.message, code: 'PROFILE_ERROR' });
    }
  });

  // Update own profile
  app.patch('/api/user-profile', requireAuth, (req, res) => {
    try {
      const { nickname, avatar_url } = req.body;
      const userId = req.auth.userId;

      if (nickname) {
        run('UPDATE user_profiles SET nickname = ? WHERE id = ?', [nickname, userId]);
      }
      if (avatar_url) {
        run('UPDATE user_profiles SET avatar_url = ? WHERE id = ?', [avatar_url, userId]);
      }

      const profile = get('SELECT * FROM user_profiles WHERE id = ?', [userId]);
      res.json({ data: profile });
    } catch (err) {
      console.error('[user-profile:PATCH]', err);
      res.status(500).json({ message: err.message, code: 'PROFILE_UPDATE_ERROR' });
    }
  });

  // Get balance
  app.get('/api/balance', requireAuth, (req, res) => {
    try {
      const profile = get('SELECT balance FROM user_profiles WHERE id = ?', [req.auth.userId]);
      res.json({ balance: profile?.balance || 0 });
    } catch (err) {
      console.error('[balance]', err);
      res.status(500).json({ message: err.message, code: 'BALANCE_ERROR' });
    }
  });
}

module.exports = { registerUserProfile };

// ============================================================
// Route: get-user-center
// ============================================================

const { all, get } = require('../db');
const { requireAuth } = require('../middleware/auth');

function registerUserCenter(app) {
  app.get('/api/user-center', requireAuth, (req, res) => {
    try {
      const userId = req.auth.userId;

      // Profile
      const profile = get('SELECT * FROM user_profiles WHERE id = ?', [userId]);
      if (!profile) {
        return res.status(404).json({ message: '用户档案不存在', code: 'PROFILE_NOT_FOUND' });
      }

      // Published stories
      const publishedStories = all(
        'SELECT * FROM stories WHERE author_id = ? ORDER BY created_at DESC',
        [userId]
      ).map(s => ({ ...s, is_published: !!s.is_published }));

      // Purchase transactions
      const purchaseTx = all(
        'SELECT story_id, price, created_at FROM transactions WHERE buyer_id = ? ORDER BY created_at DESC',
        [userId]
      );

      // Purchased stories (with content)
      let purchasedStories = [];
      if (purchaseTx.length > 0) {
        const storyIds = purchaseTx.map(tx => tx.story_id);
        const placeholders = storyIds.map(() => '?').join(',');
        purchasedStories = all(
          `SELECT s.*, p.nickname as author_nickname, p.avatar_url as author_avatar_url
           FROM stories s
           LEFT JOIN user_profiles p ON s.author_id = p.id
           WHERE s.id IN (${placeholders})`,
          storyIds
        ).map(s => ({
          id: s.id, title: s.title, content: s.content, category: s.category,
          pain_level: s.pain_level, price: s.price, author_id: s.author_id,
          created_at: s.created_at, buy_count: s.buy_count, comfort_count: s.comfort_count,
          is_published: !!s.is_published,
          author: { nickname: s.author_nickname, avatar_url: s.author_avatar_url },
        }));
      }

      // Sales earnings
      const salesTx = all(
        'SELECT price, created_at FROM transactions WHERE seller_id = ? ORDER BY created_at DESC',
        [userId]
      );
      const totalEarned = salesTx.reduce((sum, tx) => sum + Number(tx.price), 0);

      // Recent transactions (both roles)
      const recentAsBuyer = all(
        `SELECT t.*, s.title as story_title FROM transactions t
         LEFT JOIN stories s ON t.story_id = s.id
         WHERE t.buyer_id = ? ORDER BY t.created_at DESC LIMIT 5`,
        [userId]
      );
      const recentAsSeller = all(
        `SELECT t.*, s.title as story_title FROM transactions t
         LEFT JOIN stories s ON t.story_id = s.id
         WHERE t.seller_id = ? ORDER BY t.created_at DESC LIMIT 5`,
        [userId]
      );

      const allRecent = [...recentAsBuyer, ...recentAsSeller];
      const uniqueRecent = allRecent
        .reduce((acc, tx) => {
          if (!acc.find(t => t.id === tx.id)) acc.push(tx);
          return acc;
        }, [])
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        .slice(0, 10)
        .map(tx => ({
          ...tx,
          story: tx.story_title ? { title: tx.story_title } : null,
        }));

      res.json({
        profile,
        published_stories: publishedStories,
        purchased_stories: purchasedStories,
        earnings: {
          total_earned: totalEarned,
          total_sales: salesTx.length,
          recent_transactions: uniqueRecent,
        },
      });
    } catch (err) {
      console.error('[user-center]', err);
      res.status(500).json({ message: err.message, code: 'USER_CENTER_ERROR' });
    }
  });
}

module.exports = { registerUserCenter };

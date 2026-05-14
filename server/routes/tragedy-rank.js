// ============================================================
// Route: get-tragedy-rank
// ============================================================

const { all } = require('../db');
const { authMiddleware } = require('../middleware/auth');

function registerTragedyRank(app) {
  app.get('/api/tragedy-rank', authMiddleware, (req, res) => {
    try {
      // Top stories by pain_level desc, then buy_count as tiebreaker
      const topStories = all(
        `SELECT s.*, p.nickname as author_nickname, p.avatar_url as author_avatar_url
         FROM stories s
         LEFT JOIN user_profiles p ON s.author_id = p.id
         WHERE s.is_published = 1
         ORDER BY s.pain_level DESC, s.buy_count DESC
         LIMIT 20`
      ).map(s => ({
        id: s.id, title: s.title, content: s.content, category: s.category,
        pain_level: s.pain_level, price: s.price, author_id: s.author_id,
        created_at: s.created_at, buy_count: s.buy_count, comfort_count: s.comfort_count,
        is_published: !!s.is_published,
        author: { nickname: s.author_nickname, avatar_url: s.author_avatar_url },
      }));

      // Today's stats
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayISO = today.toISOString();

      const todayStories = all(
        'SELECT pain_level, buy_count, comfort_count, category FROM stories WHERE is_published = 1 AND created_at >= ?',
        [todayISO]
      );

      const totalStories = todayStories.length;
      const totalBuys = todayStories.reduce((sum, s) => sum + (s.buy_count || 0), 0);
      const totalComforts = todayStories.reduce((sum, s) => sum + (s.comfort_count || 0), 0);
      const avgPain = totalStories > 0
        ? todayStories.reduce((sum, s) => sum + s.pain_level, 0) / totalStories
        : 0;

      // Category distribution
      const categoryDistribution = {};
      todayStories.forEach(s => {
        categoryDistribution[s.category] = (categoryDistribution[s.category] || 0) + 1;
      });

      res.json({
        top_stories: topStories,
        today_stats: {
          total_stories: totalStories,
          total_buys: totalBuys,
          total_comforts: totalComforts,
          avg_pain: Math.round(avgPain * 10) / 10,
          category_distribution: categoryDistribution,
        },
      });
    } catch (err) {
      console.error('[tragedy-rank]', err);
      res.status(500).json({ message: err.message, code: 'RANK_ERROR' });
    }
  });
}

module.exports = { registerTragedyRank };

// ============================================================
// Route: get-stories
// ============================================================

const { all } = require('../db');
const { authMiddleware } = require('../middleware/auth');

const VALID_CATEGORIES = ['work', 'love', 'family', 'health', 'social', 'other'];

function registerGetStories(app) {
  app.get('/api/stories', authMiddleware, (req, res) => {
    try {
      const category = req.query.category || null;
      const sort = req.query.sort || 'newest';
      const page = parseInt(req.query.page || '1', 10);
      const pageSize = Math.min(parseInt(req.query.page_size || '20', 10), 50);
      const offset = (page - 1) * pageSize;

      let where = 'WHERE s.is_published = 1';
      const params = [];

      if (category && category !== 'all' && VALID_CATEGORIES.includes(category)) {
        where += ' AND s.category = ?';
        params.push(category);
      }

      let orderBy;
      switch (sort) {
        case 'pain_high':
          orderBy = 'ORDER BY s.pain_level DESC, s.buy_count DESC';
          break;
        case 'most_bought':
          orderBy = 'ORDER BY s.buy_count DESC, s.pain_level DESC';
          break;
        case 'most_comforted':
          orderBy = 'ORDER BY s.comfort_count DESC, s.pain_level DESC';
          break;
        case 'newest':
        default:
          orderBy = 'ORDER BY s.created_at DESC';
          break;
      }

      // Count total
      const countRow = all(`SELECT COUNT(*) as total FROM stories s ${where}`, params);
      const total = countRow[0]?.total || 0;

      // Fetch page
      const stories = all(
        `SELECT s.*, p.nickname as author_nickname, p.avatar_url as author_avatar_url
         FROM stories s
         LEFT JOIN user_profiles p ON s.author_id = p.id
         ${where}
         ${orderBy}
         LIMIT ? OFFSET ?`,
        [...params, pageSize, offset]
      );

      // Map to include nested author object
      const data = stories.map(s => ({
        id: s.id,
        title: s.title,
        content: s.content,
        category: s.category,
        pain_level: s.pain_level,
        price: s.price,
        author_id: s.author_id,
        created_at: s.created_at,
        buy_count: s.buy_count,
        comfort_count: s.comfort_count,
        is_published: !!s.is_published,
        author: {
          nickname: s.author_nickname,
          avatar_url: s.author_avatar_url,
        },
      }));

      res.json({
        data,
        total,
        page,
        page_size: pageSize,
        has_more: offset + pageSize < total,
      });
    } catch (err) {
      console.error('[get-stories]', err);
      res.status(500).json({ message: err.message, code: 'STORIES_FETCH_ERROR' });
    }
  });
}

module.exports = { registerGetStories };

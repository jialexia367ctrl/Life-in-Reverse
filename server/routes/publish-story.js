// ============================================================
// Route: publish-story
// ============================================================

const { v4: uuidv4 } = require('uuid');
const { run, get } = require('../db');
const { requireAuth } = require('../middleware/auth');

const VALID_CATEGORIES = ['work', 'love', 'family', 'health', 'social', 'other'];
const MAX_TITLE = 20;
const MIN_CONTENT = 20;
const MAX_CONTENT = 2000;

function registerPublishStory(app) {
  app.post('/api/stories', requireAuth, (req, res) => {
    try {
      const { title, content, category, pain_level, price } = req.body;
      const userId = req.auth.userId;

      // Validation
      const errors = [];
      if (!title || title.length > MAX_TITLE) errors.push(`标题不能为空且不超过${MAX_TITLE}字`);
      if (!content || content.length < MIN_CONTENT || content.length > MAX_CONTENT)
        errors.push(`内容长度需在${MIN_CONTENT}-${MAX_CONTENT}字之间`);
      if (!VALID_CATEGORIES.includes(category)) errors.push('无效的分类');
      if (typeof pain_level !== 'number' || pain_level < 1 || pain_level > 10)
        errors.push('痛苦等级需在1-10之间');
      if (typeof price !== 'number' || price < 0.99 || price > 9.99)
        errors.push('价格需在0.99-9.99之间');

      if (errors.length > 0) {
        return res.status(400).json({ message: errors.join('; '), code: 'VALIDATION_ERROR' });
      }

      const storyId = uuidv4();
      const now = new Date().toISOString();

      run(
        `INSERT INTO stories (id, title, content, category, pain_level, price, author_id, created_at, buy_count, comfort_count, is_published)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 1)`,
        [storyId, title, content, category, pain_level, price, userId, now]
      );

      const story = get('SELECT * FROM stories WHERE id = ?', [storyId]);
      story.is_published = !!story.is_published;

      res.status(201).json({ data: story, message: '发布成功' });
    } catch (err) {
      console.error('[publish-story]', err);
      res.status(500).json({ message: err.message, code: 'STORY_PUBLISH_ERROR' });
    }
  });
}

module.exports = { registerPublishStory };

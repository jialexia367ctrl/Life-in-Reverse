// ============================================================
// Route: send-comfort
// ============================================================

const { v4: uuidv4 } = require('uuid');
const { run, get } = require('../db');
const { requireAuth } = require('../middleware/auth');

const VALID_TYPES = ['tea', 'flower', 'bandage'];

function registerSendComfort(app) {
  app.post('/api/comforts', requireAuth, (req, res) => {
    try {
      const { story_id, type } = req.body;
      const senderId = req.auth.userId;

      if (!story_id) {
        return res.status(400).json({ message: '缺少 story_id', code: 'VALIDATION_ERROR' });
      }
      if (!VALID_TYPES.includes(type)) {
        return res.status(400).json({ message: '无效的安慰类型', code: 'VALIDATION_ERROR' });
      }

      // Check story exists
      const story = get('SELECT id FROM stories WHERE id = ? AND is_published = 1', [story_id]);
      if (!story) {
        return res.status(404).json({ message: '故事不存在', code: 'STORY_NOT_FOUND' });
      }

      // Check duplicate (per user, per type, per story)
      const existing = get(
        'SELECT id FROM comforts WHERE story_id = ? AND sender_id = ? AND type = ?',
        [story_id, senderId, type]
      );
      if (existing) {
        return res.status(400).json({ message: '已经送过这种安慰了', code: 'ALREADY_SENT' });
      }

      // Insert comfort
      const comfortId = uuidv4();
      const now = new Date().toISOString();
      run(
        `INSERT INTO comforts (id, story_id, sender_id, type, created_at)
         VALUES (?, ?, ?, ?, ?)`,
        [comfortId, story_id, senderId, type, now]
      );

      // Update comfort_count
      run('UPDATE stories SET comfort_count = comfort_count + 1 WHERE id = ?', [story_id]);

      const comfort = get('SELECT * FROM comforts WHERE id = ?', [comfortId]);

      res.status(201).json({ data: comfort, message: '安慰已送达' });
    } catch (err) {
      console.error('[send-comfort]', err);
      res.status(500).json({ message: err.message, code: 'COMFORT_ERROR' });
    }
  });
}

module.exports = { registerSendComfort };

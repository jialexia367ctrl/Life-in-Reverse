// ============================================================
// Route: create-payment-intent (local mock for dev)
// ============================================================

const { v4: uuidv4 } = require('uuid');
const { run, get } = require('../db');
const { requireAuth } = require('../middleware/auth');

function registerCreatePayment(app) {
  app.post('/api/payments/checkout', requireAuth, (req, res) => {
    try {
      const { story_id } = req.body;
      const buyerId = req.auth.userId;

      if (!story_id) {
        return res.status(400).json({ message: '缺少 story_id', code: 'VALIDATION_ERROR' });
      }

      // Fetch story
      const story = get('SELECT * FROM stories WHERE id = ? AND is_published = 1', [story_id]);
      if (!story) {
        return res.status(404).json({ message: '故事不存在', code: 'STORY_NOT_FOUND' });
      }

      // Self-purchase check
      if (story.author_id === buyerId) {
        return res.status(400).json({ message: '不能购买自己的故事', code: 'SELF_PURCHASE' });
      }

      // Already purchased check
      const existing = get(
        'SELECT id FROM transactions WHERE story_id = ? AND buyer_id = ?',
        [story_id, buyerId]
      );
      if (existing) {
        return res.status(400).json({ message: '已购买过此故事', code: 'ALREADY_PURCHASED' });
      }

      // Create transaction
      const txId = uuidv4();
      const now = new Date().toISOString();
      run(
        `INSERT INTO transactions (id, story_id, buyer_id, seller_id, price, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [txId, story_id, buyerId, story.author_id, story.price, now]
      );

      // Update buy_count
      run('UPDATE stories SET buy_count = buy_count + 1 WHERE id = ?', [story_id]);

      // ===== MOCK PAYMENT =====
      // In production: create Stripe Checkout Session here
      // For local dev: auto-complete the payment

      // Credit the seller
      run(
        'UPDATE user_profiles SET balance = balance + ? WHERE id = ?',
        [story.price, story.author_id]
      );

      // In local dev, redirect URL just returns the transaction info
      const successUrl = `${req.headers.origin || 'http://localhost:3000'}/payment/success?transaction_id=${txId}`;

      res.json({
        checkout_url: successUrl,
        transaction_id: txId,
        _dev_note: 'Local dev mode: payment auto-completed (no Stripe)',
      });
    } catch (err) {
      console.error('[create-payment]', err);
      res.status(500).json({ message: err.message, code: 'PAYMENT_ERROR' });
    }
  });
}

module.exports = { registerCreatePayment };

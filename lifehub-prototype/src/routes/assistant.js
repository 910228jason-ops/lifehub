const { Router } = require('../mini-http');
const assistant = require('../services/assistant');
const { requireAuth } = require('../middleware/auth');
const logger = require('../services/logger');

const router = Router();

router.post('/chat', requireAuth, async (req, res) => {
  const { history } = req.body || {};
  if (!Array.isArray(history) || !history.length) {
    return res.status(400).json({ error: '請提供 history (訊息陣列)' });
  }
  try {
    const result = await assistant.chat(history);
    res.json(result);
  } catch (e) {
    logger.error('AI 助理對話失敗', { error: e.message });
    res.status(502).json({ error: 'AI 助理暫時無法回應，請稍後再試', detail: e.message });
  }
});

module.exports = router;

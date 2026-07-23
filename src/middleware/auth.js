function requireAuth(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: '請先登入' });
  }
  next();
}

module.exports = { requireAuth };

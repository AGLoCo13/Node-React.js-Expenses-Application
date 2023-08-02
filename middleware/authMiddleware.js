const jwt = require('jsonwebtoken');

const extractUserId = (req, res, next) => {
  const token = req.headers.authorization;

  try {
    const decodedToken = jwt.verify(token, 'your-secret-key');
    const userId = decodedToken.userId;

    req.user = { id: userId };
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
};

const authenticateUser = (req, res, next) => {
  const token = req.headers.authorization;

  try {
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decodedToken = jwt.verify(token, 'your-secret-key');
    req.user = {
    userId: decodedToken.userId,
    isAdmin: decodedToken.isAdmin,
  };
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
};

const authorizeAdmin = (req, res, next) => {
  const isAdmin = req.user.isAdmin;

  if (!isAdmin) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  next();
};

module.exports = { extractUserId, authenticateUser, authorizeAdmin };
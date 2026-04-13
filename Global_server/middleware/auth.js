const jwt = require('jsonwebtoken');

const auth = (req, res, next) => {
  try {
    // Extract Bearer token from Authorization header
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({ message: 'No token, authorization denied' });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Attach user to request
    req.user = {
      userId: decoded.userId,
      localServerURL: decoded.localServerURL
    };

    next();
  } catch (err) {
    res.status(401).json({ message: 'Token is not valid' });
  }
};

module.exports = auth;

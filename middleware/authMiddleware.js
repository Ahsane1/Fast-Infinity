const jwt = require('jsonwebtoken');

const verifyToken = (req, res, next) => {

    // 1. Check if the authentication header exists
    const authHeader = req.headers['authorization'];
    if (!authHeader) {
        return res.status(403).json({ error: 'Access denied. No token provided.' });
    }

    // 2. Extract the token
    const token = authHeader.split(' ')[1];
    if (!token) {
        return res.status(403).json({ error: 'Access denied. Malformed token.' });
    }

    // 3. Verify the token signature
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        req.user = decoded;

        next();
    }
    catch (error) {
        return res.status(401).json({ error: 'Invalid or expired token.' });
    }
};

module.exports = { verifyToken };

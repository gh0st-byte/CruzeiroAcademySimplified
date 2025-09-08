```javascript
// src/controllers/authController.js

const jwt = require('jsonwebtoken');
const { getTenantFromRequest } = require('../utils/tenant');
const User = require('../models/User');

exports.login = async (req, res) => {
  const { email, password } = req.body;
  const tenant = getTenantFromRequest(req);

  try {
    // Check if user exists with the given email and tenant
    const user = await User.findOne({ where: { email, tenant } });
    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // Check password validity
    const isPasswordValid = await user.validatePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // Issue JWT with tenant info
    const token = jwt.sign({ userId: user.id, tenant }, process.env.JWT_SECRET, { expiresIn: '1d' });
    res.json({ token });
  } catch (error) {
    console.error('Error during login:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// ...existing code...
```
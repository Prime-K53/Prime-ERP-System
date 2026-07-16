const express = require('express');
const router = express.Router();
const authService = require('../services/authService.cjs');
const { generateToken, verifyToken } = require('../middleware/auth.cjs');
const { validateBody, userSchemas } = require('../middleware/validation.cjs');

router.post('/register', validateBody(userSchemas.createUser), async (req, res) => {
  try {
    const { username, email, password, role, permissions } = req.body;
    // Do NOT accept companyId from request body — it must be set by an admin
    // after registration. This prevents attackers from joining arbitrary companies.
    const user = await authService.registerUser({ username, email, password, role, permissions, companyId: '' });
    const token = generateToken({ ...user, company_id: '' });
    res.status(201).json({ message: 'User registered successfully', user: { ...user, company_id: '' }, token });
  } catch (err) {
    if (err.message === 'Username already exists') {
      return res.status(409).json({ error: err.message });
    }
    console.error('[Auth] Registration error:', err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

router.post('/login', validateBody(userSchemas.login), async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await authService.authenticateUser(username, password);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials', message: 'Username or password is incorrect' });
    }
    const { db } = require('../db.cjs');
    const userCompanies = await new Promise((resolve, reject) => {
      db.all('SELECT company_id, role, is_default FROM user_companies WHERE user_id = ?', [user.id], (err, rows) => {
        if (err) return reject(err);
        resolve(rows || []);
      });
    });
    const token = generateToken({ ...user, companies: userCompanies.map(c => c.company_id) });
    res.json({
      message: 'Login successful',
      user: {
        id: user.id, username: user.username, email: user.email,
        role: user.role, permissions: user.permissions,
        company_id: user.company_id || '',
        companies: userCompanies
      },
      token
    });
  } catch (err) {
    console.error('[Auth] Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

router.post('/request-verification', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });
    const result = await (require('../services/emailVerificationService.cjs')).requestVerification({ email });
    res.json({ success: true, message: 'Verification code sent to email', expiresAt: result.expiresAt });
  } catch (err) {
    console.error('[Auth] request-verification error:', err);
    res.status(500).json({ error: 'Failed to send verification code' });
  }
});

router.post('/verify-code', async (req, res) => {
  try {
    const { email, code } = req.body;
    if (!email || !code) return res.status(400).json({ error: 'Email and code are required' });
    const result = await (require('../services/emailVerificationService.cjs')).verifyCode({ email, code });
    if (result.success) {
      res.json({ success: true, message: 'Email verified successfully' });
    } else {
      res.status(400).json({ success: false, error: result.error || 'Invalid or expired code' });
    }
  } catch (err) {
    console.error('[Auth] verify-code error:', err);
    res.status(500).json({ error: 'Verification failed' });
  }
});

router.get('/me', verifyToken, async (req, res) => {
  try {
    const user = await authService.getUserById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    const { db } = require('../db.cjs');
    const companies = await new Promise((resolve, reject) => {
      db.all('SELECT company_id, role, is_default FROM user_companies WHERE user_id = ?', [user.id], (err, rows) => {
        if (err) return reject(err);
        resolve(rows || []);
      });
    });
    res.json({ ...user, companies });
  } catch (err) {
    console.error('[Auth] Get user error:', err);
    res.status(500).json({ error: 'Failed to get user' });
  }
});

module.exports = router;

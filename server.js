import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import path from 'path';
import { fileURLToPath } from 'url';
import { initializeDatabase } from './db.js';
import {
  registerUser,
  loginUser,
  getUserProfile,
  updateUserProfile,
  createPasswordResetToken,
  resetPassword,
  authenticateToken
} from './auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3011;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Initialize database
await initializeDatabase();

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'data-dashboard-auth' });
});

// ==================== Authentication Routes ====================

// Register
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, email, password, confirmPassword } = req.body;

    if (!username || !email || !password || !confirmPassword) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ error: 'Passwords do not match' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const user = await registerUser(username, email, password);
    res.status(201).json({ message: 'User registered successfully', user });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const user = await loginUser(username, password);
    res.json({ message: 'Login successful', user });
  } catch (error) {
    res.status(401).json({ error: error.message });
  }
});

// Logout (client-side, just return success)
app.post('/api/auth/logout', (req, res) => {
  res.json({ message: 'Logout successful' });
});

// ==================== User Profile Routes ====================

// Get user profile
app.get('/api/users/profile', authenticateToken, async (req, res) => {
  try {
    const profile = await getUserProfile(req.user.id);
    res.json(profile);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Update user profile
app.put('/api/users/profile', authenticateToken, async (req, res) => {
  try {
    const { full_name, bio, avatar_url } = req.body;
    const profile = await updateUserProfile(req.user.id, { full_name, bio, avatar_url });
    res.json({ message: 'Profile updated successfully', profile });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// ==================== Password Recovery Routes ====================

// Request password reset
app.post('/api/auth/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // In production, you would send this token via email
    // For now, we'll return it in the response for testing
    const token = await createPasswordResetToken(1); // Mock user ID
    
    res.json({
      message: 'Password reset token created (check email in production)',
      token: token // Remove in production
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Reset password
app.post('/api/auth/reset-password', async (req, res) => {
  try {
    const { token, newPassword, confirmPassword } = req.body;

    if (!token || !newPassword || !confirmPassword) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ error: 'Passwords do not match' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const result = await resetPassword(token, newPassword);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// ==================== Dashboard Routes ====================

// Get dashboard data (protected)
app.get('/api/dashboard', authenticateToken, (req, res) => {
  res.json({
    message: 'Welcome to the dashboard',
    user: req.user,
    data: {
      stats: {
        users: 150,
        dataPoints: 1250,
        queries: 89
      }
    }
  });
});

// Serve main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`\n🚀 Data Dashboard with Authentication`);
  console.log(`📍 Running on http://localhost:${PORT}`);
  console.log(`\nEndpoints:`);
  console.log(`  POST /api/auth/register           - Register new user`);
  console.log(`  POST /api/auth/login              - Login user`);
  console.log(`  POST /api/auth/logout             - Logout user`);
  console.log(`  GET  /api/users/profile           - Get user profile (protected)`);
  console.log(`  PUT  /api/users/profile           - Update user profile (protected)`);
  console.log(`  POST /api/auth/forgot-password    - Request password reset`);
  console.log(`  POST /api/auth/reset-password     - Reset password`);
  console.log(`  GET  /api/dashboard               - Get dashboard data (protected)\n`);
});

import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { getQuery, runQuery } from './db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRY = '7d';

export async function hashPassword(password) {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

export async function comparePassword(password, hashedPassword) {
  return bcrypt.compare(password, hashedPassword);
}

export function generateToken(userId, username, role) {
  return jwt.sign(
    { id: userId, username, role },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRY }
  );
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
}

export function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }

  req.user = decoded;
  next();
}

export async function registerUser(username, email, password) {
  try {
    const existingUser = await getQuery(
      'SELECT id FROM users WHERE username = ? OR email = ?',
      [username, email]
    );

    if (existingUser) {
      throw new Error('Username or email already exists');
    }

    const hashedPassword = await hashPassword(password);
    const result = await runQuery(
      'INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)',
      [username, email, hashedPassword, 'user']
    );

    // Create user profile
    await runQuery(
      'INSERT INTO profiles (user_id, full_name) VALUES (?, ?)',
      [result.id, username]
    );

    return { id: result.id, username, email };
  } catch (error) {
    throw error;
  }
}

export async function loginUser(username, password) {
  try {
    const user = await getQuery(
      'SELECT id, username, email, password, role FROM users WHERE username = ?',
      [username]
    );

    if (!user) {
      throw new Error('User not found');
    }

    const isPasswordValid = await comparePassword(password, user.password);
    if (!isPasswordValid) {
      throw new Error('Invalid password');
    }

    const token = generateToken(user.id, user.username, user.role);
    return { id: user.id, username: user.username, email: user.email, role: user.role, token };
  } catch (error) {
    throw error;
  }
}

export async function getUserProfile(userId) {
  try {
    const user = await getQuery(
      'SELECT id, username, email, role FROM users WHERE id = ?',
      [userId]
    );

    if (!user) {
      throw new Error('User not found');
    }

    const profile = await getQuery(
      'SELECT * FROM profiles WHERE user_id = ?',
      [userId]
    );

    return { ...user, profile };
  } catch (error) {
    throw error;
  }
}

export async function updateUserProfile(userId, updates) {
  try {
    const { full_name, bio, avatar_url } = updates;

    await runQuery(
      'UPDATE profiles SET full_name = ?, bio = ?, avatar_url = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?',
      [full_name, bio, avatar_url, userId]
    );

    return await getUserProfile(userId);
  } catch (error) {
    throw error;
  }
}

export async function createPasswordResetToken(userId) {
  try {
    const token = jwt.sign({ userId }, JWT_SECRET, { expiresIn: '1h' });
    const expiresAt = new Date(Date.now() + 3600000).toISOString();

    await runQuery(
      'INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES (?, ?, ?)',
      [userId, token, expiresAt]
    );

    return token;
  } catch (error) {
    throw error;
  }
}

export async function resetPassword(token, newPassword) {
  try {
    const decoded = verifyToken(token);
    if (!decoded) {
      throw new Error('Invalid or expired token');
    }

    const resetToken = await getQuery(
      'SELECT user_id FROM password_reset_tokens WHERE token = ? AND expires_at > CURRENT_TIMESTAMP',
      [token]
    );

    if (!resetToken) {
      throw new Error('Invalid or expired reset token');
    }

    const hashedPassword = await hashPassword(newPassword);
    await runQuery(
      'UPDATE users SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [hashedPassword, resetToken.user_id]
    );

    await runQuery(
      'DELETE FROM password_reset_tokens WHERE token = ?',
      [token]
    );

    return { message: 'Password reset successfully' };
  } catch (error) {
    throw error;
  }
}

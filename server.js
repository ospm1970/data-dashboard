import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import path from 'path';
import { fileURLToPath } from 'url';
import { initializeDatabase, getAllTables, getTableSchema, queryDatabase } from './db.js';
import {
  registerUser,
  loginUser,
  getUserProfile,
  updateUserProfile,
  createPasswordResetToken,
  resetPassword,
  authenticateToken
} from './auth.js';
import { generateSQLQuery, validateSQL } from './sql-generator.js';
import { fixSQL } from './sql-fixer.js';

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

// ==================== Dashboard Query Routes ====================

// Get all tables
app.get('/api/tables', async (req, res) => {
  try {
    const tables = await getAllTables();
    res.json({ tables });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Execute SQL query
app.post('/api/query', async (req, res) => {
  try {
    const { sql } = req.body;
    
    if (!sql) {
      return res.status(400).json({ error: 'SQL query is required' });
    }

    const result = await queryDatabase(sql);
    res.json({ 
      query: sql,
      data: result,
      rowCount: result.length,
      timestamp: new Date()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Generate dashboard query using AI (Natural Language to SQL)
app.post('/api/dashboard/generate', async (req, res) => {
  try {
    const { requirement } = req.body;
    
    if (!requirement) {
      return res.status(400).json({ error: 'Requirement is required' });
    }

    // Get available tables and schemas
    const tables = await getAllTables();
    const tableSchemas = {};
    
    for (const table of tables) {
      tableSchemas[table] = await getTableSchema(table);
    }

    // Generate SQL query from natural language
    let sqlQuery = await generateSQLQuery(requirement, tableSchemas);
    
    // Fix common SQL issues
    sqlQuery = fixSQL(sqlQuery);
    
    // Validate SQL syntax
    validateSQL(sqlQuery);
    
    console.log('✅ Final SQL:', sqlQuery);
    
    // Execute the query
    const data = await queryDatabase(sqlQuery);
    
    res.json({
      requirement,
      query: sqlQuery,
      data,
      rowCount: data.length,
      generatedAt: new Date()
    });
  } catch (error) {
    console.error('❌ Error generating dashboard query:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// ==================== Dashboard Routes ====================

// Get dashboard data (protected)
app.get('/api/dashboard', authenticateToken, async (req, res) => {
  try {
    const tables = await getAllTables();
    const products = await queryDatabase('select count(*) as count from products');
    const orders = await queryDatabase('select count(*) as count from orders');
    
    res.json({
      message: 'Welcome to the dashboard',
      user: req.user,
      data: {
        stats: {
          tables: tables.length,
          products: products[0]?.count || 0,
          orders: orders[0]?.count || 0
        },
        tables
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Serve main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`\n🚀 Data Dashboard with Authentication & Natural Language Queries`);
  console.log(`📍 Running on http://localhost:${PORT}`);
  console.log(`\nAuthentication Endpoints:`);
  console.log(`  POST /api/auth/register           - Register new user`);
  console.log(`  POST /api/auth/login              - Login user`);
  console.log(`  POST /api/auth/logout             - Logout user`);
  console.log(`  GET  /api/users/profile           - Get user profile (protected)`);
  console.log(`  PUT  /api/users/profile           - Update user profile (protected)`);
  console.log(`  POST /api/auth/forgot-password    - Request password reset`);
  console.log(`  POST /api/auth/reset-password     - Reset password`);
  console.log(`\nDashboard Query Endpoints:`);
  console.log(`  GET  /api/tables                  - Get all available tables`);
  console.log(`  POST /api/query                   - Execute SQL query`);
  console.log(`  POST /api/dashboard/generate      - Generate SQL from natural language`);
  console.log(`  GET  /api/dashboard               - Get dashboard data (protected)\n`);
});

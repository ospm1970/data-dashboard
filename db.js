import initSqlJs from 'sql.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, 'auth.db');

let db = null;
let SQL = null;

export async function initializeDatabase() {
  try {
    SQL = await initSqlJs();
    
    // Carregar banco de dados existente ou criar novo
    let data = null;
    if (fs.existsSync(DB_PATH)) {
      data = fs.readFileSync(DB_PATH);
    }
    
    db = new SQL.Database(data);
    console.log('✅ Database initialized');
    
    await createTables();
    saveDatabase();
    return db;
  } catch (err) {
    console.error('❌ Database connection error:', err);
    throw err;
  }
}

async function createTables() {
  try {
    // Users table (Authentication)
    db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT DEFAULT 'user',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Profiles table
    db.run(`
      CREATE TABLE IF NOT EXISTS profiles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER UNIQUE NOT NULL,
        full_name TEXT,
        avatar_url TEXT,
        bio TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // Password reset tokens table
    db.run(`
      CREATE TABLE IF NOT EXISTS password_reset_tokens (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        token TEXT UNIQUE NOT NULL,
        expires_at DATETIME NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // Dashboard data tables
    // Products table
    db.run(`
      CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        price REAL NOT NULL,
        stock INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Orders table
    db.run(`
      CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        product_id INTEGER NOT NULL,
        quantity INTEGER NOT NULL,
        total REAL NOT NULL,
        status TEXT DEFAULT 'pending',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (product_id) REFERENCES products(id)
      )
    `);

    // Insert sample data for dashboard
    db.run(`
      INSERT OR IGNORE INTO products (id, name, price, stock) VALUES 
      (1, 'Notebook', 3500.00, 10),
      (2, 'Mouse', 50.00, 100),
      (3, 'Teclado', 150.00, 50),
      (4, 'Monitor', 800.00, 15)
    `);

    db.run(`
      INSERT OR IGNORE INTO orders (id, user_id, product_id, quantity, total, status) VALUES 
      (1, 1, 1, 1, 3500.00, 'completed'),
      (2, 1, 2, 2, 100.00, 'pending'),
      (3, 1, 3, 1, 150.00, 'completed'),
      (4, 1, 4, 1, 800.00, 'pending')
    `);
  } catch (err) {
    console.error('❌ Error creating tables:', err);
  }
}

function saveDatabase() {
  try {
    if (db) {
      const data = db.export();
      const buffer = Buffer.from(data);
      fs.writeFileSync(DB_PATH, buffer);
    }
  } catch (err) {
    console.error('❌ Error saving database:', err);
  }
}

export function getDatabase() {
  return db;
}

export function runQuery(sql, params = []) {
  try {
    const stmt = db.prepare(sql);
    if (params.length > 0) {
      stmt.bind(params);
    }
    stmt.step();
    stmt.free();
    saveDatabase();
    return { id: null, changes: 1 };
  } catch (err) {
    console.error('❌ Query error:', err);
    throw err;
  }
}

export function getQuery(sql, params = []) {
  try {
    const stmt = db.prepare(sql);
    if (params.length > 0) {
      stmt.bind(params);
    }
    
    let row = null;
    if (stmt.step()) {
      row = stmt.getAsObject();
    }
    stmt.free();
    return row;
  } catch (err) {
    console.error('❌ Query error:', err);
    throw err;
  }
}

export function allQuery(sql, params = []) {
  try {
    const stmt = db.prepare(sql);
    if (params.length > 0) {
      stmt.bind(params);
    }
    
    const rows = [];
    while (stmt.step()) {
      rows.push(stmt.getAsObject());
    }
    stmt.free();
    return rows || [];
  } catch (err) {
    console.error('❌ Query error:', err);
    throw err;
  }
}

// Dashboard query functions
export async function getAllTables() {
  try {
    const result = allQuery(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name NOT LIKE 'sqlite_%'
    `);
    return result.map(r => r.name);
  } catch (error) {
    console.error('❌ Error getting tables:', error);
    throw error;
  }
}

export async function getTableSchema(tableName) {
  try {
    const result = allQuery(`PRAGMA table_info(${tableName})`);
    return result;
  } catch (error) {
    console.error('❌ Error getting table schema:', error);
    throw error;
  }
}

export async function queryDatabase(sql) {
  try {
    const result = allQuery(sql);
    return result;
  } catch (error) {
    console.error('❌ Database query error:', error);
    throw error;
  }
}

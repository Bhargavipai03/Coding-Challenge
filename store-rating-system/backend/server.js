const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;


const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'store_rating_db',
  password: process.env.DB_PASSWORD || 'password',
  port: process.env.DB_PORT || 5432,
});


app.use(cors());
app.use(express.json());


const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Access token required' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    req.user = user;
    next();
  });
};

const requireRole = (roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }
  next();
};

// --- Validation Functions ---
const validateEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const validatePassword = (password) => /^(?=.*[A-Z])(?=.*[!@#$%^&*]).{8,16}$/.test(password);
const validateName = (name) => name && name.length >= 20 && name.length <= 60;
const validateAddress = (address) => address && address.length <= 400;

// --- Database Initialization ---
const initializeDatabase = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(60) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        address VARCHAR(400) NOT NULL,
        role VARCHAR(50) NOT NULL DEFAULT 'normal_user',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        claim_status VARCHAR(50) DEFAULT 'none'
      )`);
      
    await pool.query(`
      CREATE TABLE IF NOT EXISTS stores (
        id SERIAL PRIMARY KEY,
        name VARCHAR(60) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        address VARCHAR(400) NOT NULL,
        role VARCHAR(50) NOT NULL DEFAULT 'store_owner',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`);
      
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ratings (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        store_id INTEGER REFERENCES stores(id) ON DELETE CASCADE,
        rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, store_id)
      )`);
    
    const adminExists = await pool.query("SELECT * FROM users WHERE role = 'admin' LIMIT 1");
    if (adminExists.rows.length === 0) {
      const hashedPassword = await bcrypt.hash('Admin123!', 10);
      await pool.query(`INSERT INTO users (name, email, password, address, role) VALUES ($1, $2, $3, $4, $5)`, 
        ['Default System Administrator', 'admin@storerating.com', hashedPassword, '123 Admin Street', 'admin']);
    }
    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Error initializing database:', error);
  }
};
initializeDatabase();


// --- Auth & User Routes ---
app.post('/api/auth/register', async (req, res) => {
    try {
        const { name, email, password, address } = req.body;
        if (!validateName(name) || !validateEmail(email) || !validatePassword(password) || !validateAddress(address)) {
            return res.status(400).json({ error: 'Invalid input data. Check all fields meet requirements.' });
        }
        const existingUser = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        if (existingUser.rows.length > 0) return res.status(400).json({ error: 'Email already registered' });
        const hashedPassword = await bcrypt.hash(password, 10);
        const result = await pool.query('INSERT INTO users (name, email, password, address, role) VALUES ($1, $2, $3, $4, $5) RETURNING id, name, email, address, role', [name, email, hashedPassword, address, 'normal_user']);
        const user = result.rows[0];
        const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
        res.status(201).json({ token, user });
    } catch (error) { 
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Internal server error' }); 
    }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!validateEmail(email)) return res.status(400).json({ error: 'Invalid email format' });
    let userResult = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (userResult.rows.length === 0) {
        userResult = await pool.query('SELECT * FROM stores WHERE email = $1', [email]);
    }
    if (userResult.rows.length === 0) return res.status(401).json({ error: 'Invalid credentials' });
    const user = userResult.rows[0];
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) return res.status(401).json({ error: 'Invalid credentials' });
    const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
    const { password: _, ...userWithoutPassword } = user;
    res.json({ token, user: userWithoutPassword });
  } catch (error) { 
      console.error('Login error:', error);
      res.status(500).json({ error: 'Internal server error' }); 
    }
});

app.get('/api/users/profile', authenticateToken, async (req, res) => {
    try {
        const table = req.user.role === 'store_owner' ? 'stores' : 'users';
      
        const columns = table === 'users' ? 'id, name, email, address, role, claim_status' : 'id, name, email, address, role';
        const result = await pool.query(`SELECT ${columns} FROM ${table} WHERE id = $1`, [req.user.userId]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
        res.json(result.rows[0]);
    } catch (error) { 
        console.error('Profile fetch error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});


app.post('/api/users/claim-store-owner', authenticateToken, requireRole(['normal_user']), async (req, res) => {
    try {
        await pool.query("UPDATE users SET claim_status = 'pending_verification' WHERE id = $1", [req.user.userId]);
        res.status(200).json({ message: 'Your request to become a store owner has been submitted for admin review.' });
    } catch (error) {
        console.error("Claim role error:", error);
        res.status(500).json({ error: 'Internal server error' });
    }
});


// --- Store & Rating Routes for Normal Users ---
app.get('/api/stores', authenticateToken, async (req, res) => {
  try {
    const { search = '', sortBy = 'name', sortOrder = 'asc' } = req.query;
    const allowedSortBy = ['name', 'address', 'average_rating'];
    const safeSortBy = allowedSortBy.includes(sortBy) ? sortBy : 'name';
    const safeSortOrder = sortOrder.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
    const result = await pool.query(`
      SELECT s.id, s.name, s.address, COALESCE(AVG(r.rating), 0) as average_rating, ur.rating as user_rating
      FROM stores s
      LEFT JOIN ratings r ON s.id = r.store_id
      LEFT JOIN ratings ur ON s.id = ur.store_id AND ur.user_id = $1
      WHERE s.name ILIKE $2 OR s.address ILIKE $2
      GROUP BY s.id, ur.rating
      ORDER BY ${safeSortBy} ${safeSortOrder}`,
      [req.user.userId, `%${search}%`]
    );
    res.json(result.rows);
  } catch (error) { console.error('Stores fetch error:', error); res.status(500).json({ error: 'Internal server error' }); }
});

app.post('/api/ratings', authenticateToken, requireRole(['normal_user']), async (req, res) => {
  try {
    const { storeId, rating } = req.body;
    if (!rating || rating < 1 || rating > 5) return res.status(400).json({ error: 'Rating must be between 1 and 5' });
    await pool.query(`
      INSERT INTO ratings (user_id, store_id, rating) VALUES ($1, $2, $3)
      ON CONFLICT (user_id, store_id) DO UPDATE SET rating = $3, updated_at = CURRENT_TIMESTAMP`,
      [req.user.userId, storeId, rating]
    );
    res.status(201).json({ message: 'Rating submitted successfully' });
  } catch (error) { 
      console.error('Rating submission error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
});

// --- Admin Routes ---
app.get('/api/admin/dashboard', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        const totalUsers = await pool.query("SELECT COUNT(*) FROM users");
        const totalStores = await pool.query('SELECT COUNT(*) FROM stores');
        const totalRatings = await pool.query('SELECT COUNT(*) FROM ratings');
        res.json({
            totalUsers: parseInt(totalUsers.rows[0].count),
            totalStores: parseInt(totalStores.rows[0].count),
            totalRatings: parseInt(totalRatings.rows[0].count),
        });
    } catch (error) { 
        console.error('Admin dashboard error:', error);
        res.status(500).json({ error: 'Internal server error' }); 
    }
});

app.get('/api/admin/users', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        const { sortBy = 'name', sortOrder = 'asc' } = req.query;
        const allowedSortBy = ['name', 'email', 'role', 'claim_status', 'created_at'];
        const safeSortBy = allowedSortBy.includes(sortBy) ? `u.${sortBy}` : 'u.name';
        const safeSortOrder = sortOrder.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
        
        const result = await pool.query(`SELECT id, name, email, role, claim_status FROM users u ORDER BY ${safeSortBy} ${safeSortOrder}`);
        res.json(result.rows);
    } catch (error) {
        console.error('Admin users fetch error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.post('/api/admin/users/:id/verify', authenticateToken, requireRole(['admin']), async (req, res) => {
    const client = await pool.connect();
    try {
        const { id } = req.params;
        await client.query('BEGIN');
        const userResult = await client.query('SELECT * FROM users WHERE id = $1 AND role = $2', [id, 'normal_user']);
        if (userResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Normal user not found or is not eligible for verification.' });
        }
        const user = userResult.rows[0];
        await client.query(
            'INSERT INTO stores (name, email, password, address, role) VALUES ($1, $2, $3, $4, $5)',
            [user.name, user.email, user.password, user.address, 'store_owner']
        );
        await client.query('DELETE FROM users WHERE id = $1', [id]);
        await client.query('COMMIT');
        res.status(200).json({ message: 'User verified and converted to Store Owner.' });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Verification error:', error);
        res.status(500).json({ error: 'Internal server error during verification.' });
    } finally {
        client.release();
    }
});


app.get('/api/admin/stores', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        const { sortBy = 'name', sortOrder = 'asc' } = req.query;
        const allowedSortBy = ['name', 'email', 'average_rating', 'total_ratings'];
        const safeSortBy = allowedSortBy.includes(sortBy) ? sortBy : 'name';
        const safeSortOrder = sortOrder.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
        const result = await pool.query(`
            SELECT s.id, s.name, s.email, s.address, s.created_at, COALESCE(AVG(r.rating), 0) as average_rating, COUNT(r.id) as total_ratings
            FROM stores s LEFT JOIN ratings r ON s.id = r.store_id
            GROUP BY s.id ORDER BY ${safeSortBy} ${safeSortOrder}`);
        res.json(result.rows);
    } catch (error) { 
        console.error('Admin stores fetch error:', error);
        res.status(500).json({ error: 'Internal server error' }); 
    }
});

app.delete('/api/admin/users/:id', authenticateToken, requireRole(['admin']), async (req, res) => {
    try { 
        await pool.query('DELETE FROM users WHERE id = $1', [req.params.id]); 
        res.sendStatus(204); 
    }
    catch (error) { 
        console.error('Admin delete user error:', error);
        res.status(500).json({ error: 'Internal server error' }); 
    }
});

app.delete('/api/admin/stores/:id', authenticateToken, requireRole(['admin']), async (req, res) => {
    try { 
        await pool.query('DELETE FROM stores WHERE id = $1', [req.params.id]); 
        res.sendStatus(204); 
    }
    catch (error) { 
        console.error('Admin delete store error:', error);
        res.status(500).json({ error: 'Internal server error' }); 
    }
});

// --- Store Owner Routes ---
app.get('/api/store-owner/dashboard', authenticateToken, requireRole(['store_owner']), async (req, res) => {
  try {
    const storeId = req.user.userId;
    const ratingsResult = await pool.query(`
      SELECT r.id, r.rating, r.created_at, u.name as user_name, u.email as user_email
      FROM ratings r JOIN users u ON r.user_id = u.id
      WHERE r.store_id = $1 ORDER BY r.created_at DESC`, [storeId]);
    const avgResult = await pool.query(
      'SELECT AVG(rating) as average_rating, COUNT(*) as total_ratings FROM ratings WHERE store_id = $1', [storeId]);
    res.json({
      ratings: ratingsResult.rows,
      averageRating: parseFloat(avgResult.rows[0].average_rating || 0).toFixed(1),
      totalRatings: parseInt(avgResult.rows[0].total_ratings),
    });
  } catch (error) { 
      console.error('Store owner dashboard error:', error);
      res.status(500).json({ error: 'Internal server error' }); 
    }
});

// --- Server Listen ---
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
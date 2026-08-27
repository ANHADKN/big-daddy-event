const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const Razorpay = require('razorpay');
const crypto = require('crypto');
const path = require('path');
const dotenv = require('dotenv');
const { v4: uuidv4 } = require('uuid');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const multer = require('multer');
const fs = require('fs');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    console.error("WARNING: JWT_SECRET environment variable is missing.");
}

// Multer config for image upload
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const dir = path.join(__dirname, 'public', 'assets', 'uploads');
        if (!fs.existsSync(dir)){
            fs.mkdirSync(dir, { recursive: true });
        }
        cb(null, dir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, 'pkg-' + uniqueSuffix + ext);
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only JPEG, PNG and WEBP are allowed.'));
        }
    }
});

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Health Check Endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

// Initialize Razorpay
console.log("Razorpay Key ID configured:", !!process.env.RAZORPAY_KEY_ID);
console.log("Razorpay Secret configured:", !!process.env.RAZORPAY_KEY_SECRET);

let razorpay = null;
if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
    razorpay = new Razorpay({
        key_id: process.env.RAZORPAY_KEY_ID,
        key_secret: process.env.RAZORPAY_KEY_SECRET,
    });
} else {
    console.log("Razorpay credentials are not configured");
}

const db = require('./db.js');

// Initialize DB schema
db.serialize(() => {
            // Bookings Table
            db.run(`
                CREATE TABLE IF NOT EXISTS bookings (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    booking_id TEXT UNIQUE,
                    customer_name TEXT,
                    email TEXT,
                    phone TEXT,
                    whatsapp TEXT,
                    event_type TEXT,
                    guest_count INTEGER,
                    event_date TEXT,
                    start_time TEXT,
                    end_time TEXT,
                    venue_name TEXT,
                    venue_address TEXT,
                    location TEXT,
                    district TEXT,
                    state TEXT,
                    package_id TEXT,
                    package_name TEXT,
                    package_amount REAL,
                    advance_amount REAL,
                    amount_paid REAL DEFAULT 0,
                    balance_amount REAL,
                    additional_requirements TEXT,
                    notes TEXT,
                    status TEXT DEFAULT 'PENDING PAYMENT',
                    payment_status TEXT DEFAULT 'UNPAID',
                    razorpay_order_id TEXT,
                    razorpay_payment_id TEXT,
                    razorpay_signature TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `);

            // Admins Table
            db.run(`
                CREATE TABLE IF NOT EXISTS admins (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    username TEXT UNIQUE,
                    password_hash TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `);
            
            // Seed default admin if none exists
            db.get(`SELECT COUNT(*) as count FROM admins`, [], (err, row) => {
                if (!err && row.count === 0) {
                    const salt = bcrypt.genSaltSync(10);
                    const hash = bcrypt.hashSync('admin123', salt);
                    db.run(`INSERT INTO admins (username, password_hash) VALUES ('admin', ?)`, [hash]);
                    console.log('Seeded default admin (admin / admin123)');
                }
            });

            // Enquiries & Admin Notes
            db.run(`CREATE TABLE IF NOT EXISTS enquiries ( id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, phone TEXT, email TEXT, message TEXT, status TEXT DEFAULT 'NEW', created_at DATETIME DEFAULT CURRENT_TIMESTAMP )`);
            db.run(`CREATE TABLE IF NOT EXISTS admin_notes ( id INTEGER PRIMARY KEY AUTOINCREMENT, entity_type TEXT, entity_id TEXT, note TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP )`);

            // NEW SCHEMA TABLES
            db.run(`
                CREATE TABLE IF NOT EXISTS categories (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT,
                    status TEXT DEFAULT 'ACTIVE',
                    display_order INTEGER DEFAULT 0,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `);

            db.run(`
                CREATE TABLE IF NOT EXISTS packages_new (
                    id TEXT PRIMARY KEY,
                    name TEXT,
                    category_id INTEGER,
                    short_description TEXT,
                    description TEXT,
                    price_from REAL,
                    price_to REAL,
                    image_url TEXT,
                    theme TEXT DEFAULT 'theme-bronze',
                    status TEXT DEFAULT 'ACTIVE',
                    display_order INTEGER DEFAULT 0,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (category_id) REFERENCES categories(id)
                )
            `);

            db.run(`
                CREATE TABLE IF NOT EXISTS package_services (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    package_id TEXT,
                    category_group TEXT,
                    service_name TEXT,
                    display_order INTEGER DEFAULT 0,
                    FOREIGN KEY (package_id) REFERENCES packages_new(id)
                )
            `);

            // MIGRATION LOGIC
            // Check if packages_new is empty, if so, seed defaults. 
            // Since we previously had `packages`, we will just seed the new structure if it's completely empty.
            db.get(`SELECT COUNT(*) as count FROM packages_new`, [], (err, row) => {
                if (!err && row.count === 0) {
                    console.log("Migrating/Seeding initial package data into new schema...");
                    
                    // 1. Seed Categories
                    db.run(`INSERT INTO categories (id, name, display_order) VALUES (1, 'Destination Wedding', 1)`);
                    db.run(`INSERT INTO categories (id, name, display_order) VALUES (2, 'Intimate Wedding', 2)`);
                    
                    // 2. Seed Packages
                    const seedPackages = [
                        ['bronze', 'STAGE BRONZE', 2, 'The Essential Celebration', 'Complete Bronze services', 15000, 30000, 'assets/images/event-private-celebration.jpg', 'theme-bronze', 1],
                        ['silver', 'STAGE SILVER', 2, 'More atmosphere. More celebration.', 'Complete Silver services', 30000, 60000, 'assets/images/munnar-intimate-wedding.jpg', 'theme-silver', 2],
                        ['gold', 'STAGE GOLD', 1, 'A richer celebration with entertainment.', 'Complete Gold services', 60000, 100000, 'assets/images/hindu-destination-wedding.jpg', 'theme-gold', 3],
                        ['premium', 'PREMIUM STAGE', 1, 'A complete destination experience.', 'Complete Premium Stage services', 100000, 160000, 'assets/images/event-destination-outdoor.jpg', 'theme-premium', 4],
                        ['premium-plus', 'PREMIUM PLUS', 1, 'The ultimate Big Daddy Events experience.', 'Complete Premium Plus package services', 160000, 160000, 'assets/images/event-corporate-gala.jpg', 'theme-plus', 5]
                    ];
                    
                    const stmtPkg = db.prepare(`INSERT INTO packages_new (id, name, category_id, short_description, description, price_from, price_to, image_url, theme, display_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
                    seedPackages.forEach(p => stmtPkg.run(p));
                    stmtPkg.finalize();
                    
                    // 3. Seed Services (Mock)
                    const stmtSrv = db.prepare(`INSERT INTO package_services (package_id, category_group, service_name, display_order) VALUES (?, ?, ?, ?)`);
                    stmtSrv.run('bronze', 'DECORATION', 'Pathway decoration', 1);
                    stmtSrv.run('bronze', 'PRODUCTION', 'Sound system', 1);
                    stmtSrv.run('silver', 'DECORATION', '15-foot ramp', 1);
                    stmtSrv.run('gold', 'ENTERTAINMENT', 'MC', 1);
                    stmtSrv.run('premium', 'DECORATION', 'Altar decoration', 1);
                    stmtSrv.run('premium-plus', 'LIGHTING', 'Custom lighting', 1);
                    stmtSrv.finalize();
                    
                    console.log("Migration complete.");
                }
            });
});

const ADVANCE_PERCENTAGE = 0.25;

// ==========================================
// PUBLIC API ROUTES
// ==========================================

// Get All Packages in structured JSON for public frontend
app.get('/api/public/packages', (req, res) => {
    db.all(`
        SELECT p.*, c.name as category_name 
        FROM packages_new p 
        LEFT JOIN categories c ON p.category_id = c.id
        WHERE p.status = 'ACTIVE' 
        ORDER BY p.display_order ASC
    `, [], (err, packages) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        
        db.all(`SELECT * FROM package_services ORDER BY display_order ASC`, [], (err, services) => {
            if (err) return res.status(500).json({ error: 'Database error' });
            
            const result = packages.map(pkg => {
                const pkgServices = services.filter(s => s.package_id === pkg.id);
                const categoriesObj = {};
                const featuresArr = [];
                
                pkgServices.forEach(ps => {
                    if (!categoriesObj[ps.category_group]) {
                        categoriesObj[ps.category_group] = [];
                    }
                    categoriesObj[ps.category_group].push(ps.service_name);
                    if (featuresArr.length < 4) featuresArr.push(ps.service_name); // First 4 for short features list
                });
                
                return {
                    id: pkg.id,
                    name: pkg.name,
                    theme: pkg.theme || 'theme-bronze',
                    desc: pkg.short_description || pkg.description,
                    price: pkg.price_from === pkg.price_to ? `₹${pkg.price_from.toLocaleString('en-IN')}` : `₹${pkg.price_from.toLocaleString('en-IN')} - ₹${pkg.price_to.toLocaleString('en-IN')}`,
                    basePrice: pkg.price_from,
                    image: pkg.image_url,
                    features: featuresArr,
                    categories: categoriesObj
                };
            });
            
            res.json(result);
        });
    });
});

app.post('/api/enquiries', (req, res) => {
    const { name, email, phone, message } = req.body;
    db.run(
        `INSERT INTO enquiries (name, email, phone, message) VALUES (?, ?, ?, ?)`,
        [name, email, phone, message],
        function(err) {
            if (err) return res.status(500).json({ error: 'Database error' });
            res.json({ success: true });
        }
    );
});

// Create Razorpay Order
app.post('/api/create-order', async (req, res) => {
    try {
        const data = req.body;
        
        db.get(`SELECT * FROM packages_new WHERE id = ? AND status = 'ACTIVE'`, [data.package_id], async (err, pkg) => {
            if (err) return res.status(500).json({ error: 'Database error' });
            if (!pkg) return res.status(400).json({ error: 'Invalid package selected' });

            const package_amount = pkg.price_from; // Booking uses base price for calculation
            const advance_amount = package_amount * ADVANCE_PERCENTAGE;
            const balance_amount = package_amount - advance_amount;

            const options = {
                amount: Math.round(advance_amount * 100), 
                currency: 'INR',
                receipt: `rcpt_${uuidv4().substring(0, 8)}`,
            };

            let order;
            try {
                if (!razorpay) {
                    return res.status(503).json({ error: 'Payment service is temporarily unavailable' });
                }
                order = await razorpay.orders.create(options);
            } catch (rzpErr) {
                return res.status(500).json({ error: 'Failed to create payment order with Razorpay.' });
            }

            const booking_id = `BDE-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`;

            const stmt = db.prepare(`
                INSERT INTO bookings (
                    booking_id, customer_name, email, phone, whatsapp, event_type, guest_count,
                    event_date, start_time, end_time, venue_name, venue_address, location, district, state,
                    package_id, package_name, package_amount, advance_amount, balance_amount,
                    additional_requirements, notes, razorpay_order_id
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);
            
            stmt.run(
                booking_id, data.customer_name, data.email, data.phone, data.whatsapp, data.event_type, data.guest_count,
                data.event_date, data.start_time, data.end_time, data.venue_name, data.venue_address, data.location, data.district, data.state,
                data.package_id, pkg.name, package_amount, advance_amount, balance_amount,
                data.additional_requirements, data.notes, order.id,
                function(err) {
                    if (err) return res.status(500).json({ error: 'Database error while saving booking.' });
                    res.json({ success: true, order_id: order.id, amount: options.amount, key_id: process.env.RAZORPAY_KEY_ID, booking_id: booking_id, customer: { name: data.customer_name, email: data.email, contact: data.phone } });
                }
            );
            stmt.finalize();
        });
    } catch (error) {
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.post('/api/verify-payment', (req, res) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature, booking_id } = req.body;
        const secret = process.env.RAZORPAY_KEY_SECRET;
        
        if (!secret) {
            return res.status(503).json({ error: 'Payment service is temporarily unavailable' });
        }
        
        const hmac = crypto.createHmac('sha256', secret);
        hmac.update(razorpay_order_id + "|" + razorpay_payment_id);
        const generated_signature = hmac.digest('hex');

        if (generated_signature === razorpay_signature) {
            db.run(`UPDATE bookings SET status = 'CONFIRMED', payment_status = 'PAID', razorpay_payment_id = ?, razorpay_signature = ?, amount_paid = advance_amount WHERE razorpay_order_id = ? AND booking_id = ?`, 
                [razorpay_payment_id, razorpay_signature, razorpay_order_id, booking_id], function(err) {
                if (err) return res.status(500).json({ success: false, message: 'DB Error' });
                res.json({ success: true, message: 'Payment verified and booking confirmed.' });
            });
        } else {
            db.run(`UPDATE bookings SET status = 'PAYMENT FAILED', payment_status = 'FAILED' WHERE razorpay_order_id = ?`, [razorpay_order_id]);
            res.status(400).json({ success: false, message: 'Invalid payment signature.' });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
});

app.get('/api/booking/:booking_id', (req, res) => {
    db.get(`SELECT * FROM bookings WHERE booking_id = ?`, [req.params.booking_id], (err, row) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        if (!row) return res.status(404).json({ error: 'Booking not found' });
        res.json(row);
    });
});


// ==========================================
// ADMIN API ROUTES
// ==========================================

app.post('/api/admin/login', (req, res) => {
    const { username, password } = req.body;
    db.get(`SELECT * FROM admins WHERE username = ?`, [username], (err, user) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        if (!user) return res.status(401).json({ error: 'Invalid credentials' });
        if (bcrypt.compareSync(password, user.password_hash)) {
            const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '1d' });
            res.json({ success: true, token });
        } else {
            res.status(401).json({ error: 'Invalid credentials' });
        }
    });
});

const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token == null) return res.sendStatus(401);
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
};

// Image Upload
app.post('/api/admin/upload-image', authenticateToken, upload.single('image'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'Please upload an image file' });
    }
    const relativePath = 'assets/uploads/' + req.file.filename;
    res.json({ success: true, imageUrl: relativePath });
});

// Categories CRUD
app.get('/api/admin/categories', authenticateToken, (req, res) => {
    db.all(`SELECT * FROM categories ORDER BY display_order ASC`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json(rows);
    });
});

app.post('/api/admin/categories', authenticateToken, (req, res) => {
    const { name, display_order, status } = req.body;
    db.run(`INSERT INTO categories (name, display_order, status) VALUES (?, ?, ?)`, [name, display_order || 0, status || 'ACTIVE'], function(err) {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json({ success: true, id: this.lastID });
    });
});

app.put('/api/admin/categories/:id', authenticateToken, (req, res) => {
    const { name, display_order, status } = req.body;
    db.run(`UPDATE categories SET name = ?, display_order = ?, status = ? WHERE id = ?`, [name, display_order, status, req.params.id], function(err) {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json({ success: true });
    });
});

// Packages CRUD (Admin)
app.get('/api/admin/packages', authenticateToken, (req, res) => {
    db.all(`SELECT p.*, c.name as category_name FROM packages_new p LEFT JOIN categories c ON p.category_id = c.id ORDER BY p.display_order ASC`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json(rows);
    });
});

app.get('/api/admin/packages/:id', authenticateToken, (req, res) => {
    db.get(`SELECT * FROM packages_new WHERE id = ?`, [req.params.id], (err, row) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        if (!row) return res.status(404).json({ error: 'Not found' });
        res.json(row);
    });
});

app.post('/api/admin/packages', authenticateToken, (req, res) => {
    const { id, name, category_id, theme, short_description, description, price_from, price_to, image_url, status, display_order, services } = req.body;
    
    // Generate UUID if no ID provided
    const pkgId = id || uuidv4();
    
    db.run(`INSERT INTO packages_new (id, name, category_id, theme, short_description, description, price_from, price_to, image_url, status, display_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [pkgId, name, category_id, theme || 'theme-bronze', short_description, description, price_from, price_to, image_url, status || 'ACTIVE', display_order || 0], function(err) {
        if (err) return res.status(500).json({ error: 'Database error' });
        
        if (services && Array.isArray(services) && services.length > 0) {
            const stmt = db.prepare(`INSERT INTO package_services (package_id, category_group, service_name, display_order) VALUES (?, ?, ?, ?)`);
            services.forEach(s => {
                stmt.run(pkgId, s.category_group, s.service_name, s.display_order);
            });
            stmt.finalize();
        }

        res.json({ success: true, id: pkgId });
    });
});

app.put('/api/admin/packages/:id', authenticateToken, (req, res) => {
    const { name, category_id, theme, short_description, description, price_from, price_to, image_url, status, display_order, services } = req.body;
    db.run(`UPDATE packages_new SET name = ?, category_id = ?, theme = ?, short_description = ?, description = ?, price_from = ?, price_to = ?, image_url = ?, status = ?, display_order = ? WHERE id = ?`,
        [name, category_id, theme || 'theme-bronze', short_description, description, price_from, price_to, image_url, status, display_order, req.params.id], function(err) {
        if (err) return res.status(500).json({ error: 'Database error' });

        if (services && Array.isArray(services)) {
            db.run(`DELETE FROM package_services WHERE package_id = ?`, [req.params.id], (err2) => {
                if (err2) return res.status(500).json({ error: 'Database error deleting services' });
                if (services.length > 0) {
                    const stmt = db.prepare(`INSERT INTO package_services (package_id, category_group, service_name, display_order) VALUES (?, ?, ?, ?)`);
                    services.forEach(s => {
                        stmt.run(req.params.id, s.category_group, s.service_name, s.display_order);
                    });
                    stmt.finalize();
                }
                res.json({ success: true });
            });
        } else {
            res.json({ success: true });
        }
    });
});

app.patch('/api/admin/packages/:id/status', authenticateToken, (req, res) => {
    const { status } = req.body;
    if (!status) return res.status(400).json({ error: 'Status is required' });
    db.run(`UPDATE packages_new SET status = ? WHERE id = ?`, [status, req.params.id], function(err) {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json({ success: true });
    });
});

app.delete('/api/admin/packages/:id', authenticateToken, (req, res) => {
    // Check for bookings first
    db.get(`SELECT COUNT(*) as count FROM bookings WHERE package_id = ?`, [req.params.id], (err, row) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        if (row.count > 0) {
            return res.status(400).json({ error: 'Cannot delete package with existing bookings. Please set status to INACTIVE.' });
        }
        
        // No bookings, safe to delete
        db.run(`DELETE FROM package_services WHERE package_id = ?`, [req.params.id], (err2) => {
            db.run(`DELETE FROM packages_new WHERE id = ?`, [req.params.id], (err3) => {
                if (err3) return res.status(500).json({ error: 'Database error' });
                res.json({ success: true });
            });
        });
    });
});

app.post('/api/admin/packages/:id/duplicate', authenticateToken, (req, res) => {
    db.get(`SELECT * FROM packages_new WHERE id = ?`, [req.params.id], (err, pkg) => {
        if (err || !pkg) return res.status(500).json({ error: 'Package not found' });
        
        const newId = uuidv4();
        const newName = pkg.name + ' (Copy)';
        
        db.run(`INSERT INTO packages_new (id, name, category_id, short_description, description, price_from, price_to, image_url, theme, status, display_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [newId, newName, pkg.category_id, pkg.short_description, pkg.description, pkg.price_from, pkg.price_to, pkg.image_url, pkg.theme, 'INACTIVE', pkg.display_order + 1], function(err) {
            
            if (err) return res.status(500).json({ error: 'Failed to duplicate' });
            
            // Duplicate services too
            db.all(`SELECT * FROM package_services WHERE package_id = ?`, [req.params.id], (errS, services) => {
                if (services && services.length > 0) {
                    const stmt = db.prepare(`INSERT INTO package_services (package_id, category_group, service_name, display_order) VALUES (?, ?, ?, ?)`);
                    services.forEach(s => {
                        stmt.run(newId, s.category_group, s.service_name, s.display_order);
                    });
                    stmt.finalize();
                }
                res.json({ success: true, newId });
            });
        });
    });
});

// Package Services CRUD
app.get('/api/admin/packages/:id/services', authenticateToken, (req, res) => {
    db.all(`SELECT * FROM package_services WHERE package_id = ? ORDER BY category_group ASC, display_order ASC`, [req.params.id], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json(rows);
    });
});

app.post('/api/admin/packages/:id/services', authenticateToken, (req, res) => {
    const { category_group, service_name, display_order } = req.body;
    db.run(`INSERT INTO package_services (package_id, category_group, service_name, display_order) VALUES (?, ?, ?, ?)`, 
        [req.params.id, category_group, service_name, display_order || 0], function(err) {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json({ success: true, id: this.lastID });
    });
});

app.delete('/api/admin/services/:id', authenticateToken, (req, res) => {
    db.run(`DELETE FROM package_services WHERE id = ?`, [req.params.id], function(err) {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json({ success: true });
    });
});

// Other APIs (Dashboard, Bookings, Enquiries, Notes, Payments, Events) ...
app.get('/api/admin/dashboard', authenticateToken, (req, res) => {
    const stats = {};
    db.serialize(() => {
        db.get(`SELECT COUNT(*) as total FROM bookings`, [], (err, row) => stats.totalBookings = row.total);
        db.get(`SELECT COUNT(*) as pending FROM bookings WHERE status = 'PENDING PAYMENT'`, [], (err, row) => stats.pendingBookings = row.pending);
        db.get(`SELECT COUNT(*) as confirmed FROM bookings WHERE status = 'CONFIRMED'`, [], (err, row) => stats.confirmedBookings = row.confirmed);
        db.get(`SELECT SUM(package_amount) as val FROM bookings WHERE status != 'CANCELLED' AND status != 'PAYMENT FAILED'`, [], (err, row) => stats.totalValue = row.val || 0);
        db.get(`SELECT SUM(amount_paid) as val FROM bookings`, [], (err, row) => stats.totalAdvance = row.val || 0);
        db.get(`SELECT SUM(balance_amount) as val FROM bookings WHERE status != 'CANCELLED' AND status != 'PAYMENT FAILED'`, [], (err, row) => stats.balanceDue = row.val || 0);
        db.get(`SELECT COUNT(*) as total FROM enquiries`, [], (err, row) => {
            stats.totalEnquiries = row.total;
            res.json(stats);
        });
    });
});

app.get('/api/admin/bookings', authenticateToken, (req, res) => {
    db.all(`SELECT * FROM bookings ORDER BY created_at DESC`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json(rows);
    });
});

app.put('/api/admin/bookings/:id', authenticateToken, (req, res) => {
    const { status, payment_status } = req.body;
    db.run(`UPDATE bookings SET status = ?, payment_status = ? WHERE booking_id = ?`, 
        [status, payment_status, req.params.id], function(err) {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json({ success: true });
    });
});

app.get('/api/admin/enquiries', authenticateToken, (req, res) => {
    db.all(`SELECT * FROM enquiries ORDER BY created_at DESC`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json(rows);
    });
});

app.put('/api/admin/enquiries/:id', authenticateToken, (req, res) => {
    const { status } = req.body;
    db.run(`UPDATE enquiries SET status = ? WHERE id = ?`, [status, req.params.id], function(err) {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json({ success: true });
    });
});

app.post('/api/admin/notes', authenticateToken, (req, res) => {
    const { entity_type, entity_id, note } = req.body;
    db.run(`INSERT INTO admin_notes (entity_type, entity_id, note) VALUES (?, ?, ?)`,
        [entity_type, entity_id, note], function(err) {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json({ success: true });
    });
});

app.get('/api/admin/notes/:type/:id', authenticateToken, (req, res) => {
    db.all(`SELECT * FROM admin_notes WHERE entity_type = ? AND entity_id = ? ORDER BY created_at DESC`,
        [req.params.type, req.params.id], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json(rows);
    });
});

app.get('/api/admin/payments', authenticateToken, (req, res) => {
    db.all(`SELECT booking_id, customer_name, package_name, package_amount, advance_amount, amount_paid, balance_amount, payment_status, razorpay_order_id, razorpay_payment_id, created_at FROM bookings WHERE razorpay_order_id IS NOT NULL ORDER BY created_at DESC`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json(rows);
    });
});

app.get('/api/admin/events', authenticateToken, (req, res) => {
    db.all(`SELECT booking_id, customer_name, event_type, event_date, venue_name, guest_count, status, payment_status FROM bookings WHERE status = 'CONFIRMED' ORDER BY event_date ASC`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json(rows);
    });
});

app.get('/api/admin/reports', authenticateToken, async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        let dateFilter = "";
        let params = [];
        
        if (startDate && endDate) {
            dateFilter = "WHERE date(created_at) >= ? AND date(created_at) <= ?";
            params = [startDate, endDate];
        } else if (startDate) {
            dateFilter = "WHERE date(created_at) >= ?";
            params = [startDate];
        } else if (endDate) {
            dateFilter = "WHERE date(created_at) <= ?";
            params = [endDate];
        }

        const queryAsync = (sql, p = []) => new Promise((resolve, reject) => {
            db.all(sql, p, (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });

        const [
            summary,
            enquiries,
            byType,
            byPackage,
            byDistrict,
            byStatus,
            byPaymentStatus,
            tableData
        ] = await Promise.all([
            // summary
            queryAsync(`
                SELECT 
                    COUNT(*) as totalBookings,
                    SUM(CASE WHEN status = 'CONFIRMED' THEN 1 ELSE 0 END) as confirmedBookings,
                    SUM(CASE WHEN status = 'PENDING' THEN 1 ELSE 0 END) as pendingBookings,
                    SUM(CASE WHEN status = 'CANCELLED' THEN 1 ELSE 0 END) as cancelledBookings,
                    SUM(package_amount) as totalRevenue,
                    SUM(amount_paid) as amountPaid,
                    SUM(balance_amount) as balanceAmount
                FROM bookings ${dateFilter}
            `, params),
            
            // enquiries
            queryAsync(`SELECT COUNT(*) as total FROM enquiries ${dateFilter}`, params),
            
            // byType
            queryAsync(`SELECT event_type, COUNT(*) as count FROM bookings ${dateFilter} GROUP BY event_type ORDER BY count DESC`, params),
            
            // byPackage
            queryAsync(`SELECT package_name, COUNT(*) as count FROM bookings ${dateFilter} GROUP BY package_name ORDER BY count DESC`, params),
            
            // byDistrict
            queryAsync(`SELECT district, COUNT(*) as count FROM bookings ${dateFilter} GROUP BY district ORDER BY count DESC`, params),
            
            // byStatus
            queryAsync(`SELECT status, COUNT(*) as count FROM bookings ${dateFilter} GROUP BY status ORDER BY count DESC`, params),
            
            // byPaymentStatus
            queryAsync(`SELECT payment_status, COUNT(*) as count FROM bookings ${dateFilter} GROUP BY payment_status ORDER BY count DESC`, params),
            
            // tableData
            queryAsync(`
                SELECT booking_id, customer_name, event_date, event_type, package_name, package_amount, amount_paid, balance_amount, payment_status, status 
                FROM bookings ${dateFilter} ORDER BY created_at DESC
            `, params)
        ]);

        res.json({
            summary: {
                totalBookings: summary[0].totalBookings || 0,
                confirmedBookings: summary[0].confirmedBookings || 0,
                pendingBookings: summary[0].pendingBookings || 0,
                cancelledBookings: summary[0].cancelledBookings || 0,
                totalRevenue: summary[0].totalRevenue || 0,
                amountPaid: summary[0].amountPaid || 0,
                balanceAmount: summary[0].balanceAmount || 0,
                totalEnquiries: enquiries[0].total || 0
            },
            byType,
            byPackage,
            byDistrict,
            byStatus,
            byPaymentStatus,
            tableData
        });

    } catch (err) {
        console.error("Reports API error:", err);
        res.status(500).json({ error: 'Failed to generate report' });
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});

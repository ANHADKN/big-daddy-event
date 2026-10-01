const express = require('express');
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
    if (process.env.NODE_ENV === 'production') {
        throw new Error("FATAL CONFIGURATION ERROR: JWT_SECRET environment variable is missing in production.");
    } else {
        console.warn("WARNING: JWT_SECRET environment variable is missing.");
    }
}

// Security: Disable X-Powered-By header
app.disable('x-powered-by');

// Security: Basic Security Headers Middleware
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
});

// Multer config for secure image upload (dual MIME & extension validation)
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];

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
        const ext = path.extname(file.originalname || '').toLowerCase();
        const safeExt = ALLOWED_EXTENSIONS.includes(ext) ? ext : '.jpg';
        cb(null, 'pkg-' + uniqueSuffix + safeExt);
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit per image
    fileFilter: (req, file, cb) => {
        const ext = path.extname(file.originalname || '').toLowerCase();
        const mime = (file.mimetype || '').toLowerCase();
        if (ALLOWED_MIME_TYPES.includes(mime) && ALLOWED_EXTENSIONS.includes(ext)) {
            cb(null, true);
        } else {
            const err = new Error('Invalid file type. Only JPEG, PNG and WEBP images are allowed.');
            err.statusCode = 400;
            cb(err);
        }
    }
});

// Environment-aware CORS configuration
const corsConfig = process.env.CORS_ORIGIN || process.env.ALLOWED_ORIGINS;
const allowedOrigins = corsConfig 
    ? corsConfig.split(',').map(o => o.trim()) 
    : null;

app.use(cors({
    origin: function(origin, callback) {
        if (!origin) return callback(null, true);
        if (!allowedOrigins || allowedOrigins.includes(origin) || origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) {
            return callback(null, true);
        }
        return callback(new Error('CORS policy: Not allowed by CORS'), false);
    },
    credentials: true
}));

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));
// Differentiated caching strategy for static assets
app.use(express.static(path.join(__dirname, 'public'), {
    maxAge: '1d',
    etag: true,
    setHeaders: (res, filePath) => {
        if (filePath.endsWith('.html')) {
            res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
        } else if (filePath.includes(path.join('assets', 'uploads'))) {
            res.setHeader('Cache-Control', 'public, max-age=600, must-revalidate');
        } else if (/\.(webp|jpg|jpeg|png|gif|svg|woff2?|ttf|eot|css|js)$/i.test(filePath)) {
            res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
        }
    }
}));

// API Cache Control: Ensure all dynamic API responses are never cached by browsers/proxies
app.use('/api', (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    next();
});

// Health Check Endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

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
            
            // Seed initial admin if none exists
            db.get(`SELECT COUNT(*) as count FROM admins`, [], (err, row) => {
                if (!err && row.count === 0) {
                    const isProd = process.env.NODE_ENV === 'production';
                    const adminUsername = process.env.ADMIN_USERNAME || 'admin';
                    const adminPassword = process.env.ADMIN_PASSWORD || (isProd ? null : 'admin123');

                    if (!adminPassword) {
                        console.warn('[SECURITY WARNING] No admin account exists and ADMIN_PASSWORD is not set. Admin account seeding skipped for production security.');
                        return;
                    }

                    const salt = bcrypt.genSaltSync(10);
                    const hash = bcrypt.hashSync(adminPassword, salt);
                    db.run(`INSERT INTO admins (username, password_hash) VALUES (?, ?)`, [adminUsername, hash]);
                    if (isProd) {
                        console.log(`[SECURITY] Initial admin account '${adminUsername}' created from environment configuration.`);
                    } else {
                        console.log(`[SECURITY] Initial admin account '${adminUsername}' seeded for local development.`);
                    }
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
                        ['silver', 'STAGE SILVER', 2, 'More atmosphere. More celebration.', 'Complete Silver services', 30000, 60000, 'assets/images/sound-lighting.jpg', 'theme-silver', 2],
                        ['gold', 'STAGE GOLD', 1, 'A richer celebration with entertainment.', 'Complete Gold services', 60000, 100000, 'assets/images/stage-decoration.jpg', 'theme-gold', 3],
                        ['premium', 'PREMIUM STAGE', 1, 'A complete destination experience.', 'Complete Premium Stage services', 100000, 160000, 'assets/images/event-destination-outdoor.jpg', 'theme-premium', 4],
                        ['premium-plus', 'PREMIUM PLUS', 1, 'The ultimate Big Daddy Events experience.', 'Complete Premium Plus package services', 160000, 160000, 'assets/images/stage-production.jpg', 'theme-plus', 5]
                    ];
                    
                    const stmtPkg = db.prepare(`INSERT INTO packages_new (id, name, category_id, short_description, description, price_from, price_to, image_url, theme, display_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
                    seedPackages.forEach(p => stmtPkg.run(p));
                    stmtPkg.finalize();
                    
                    // 3. Seed Services (Complete Original Package Services)
                    const seedServices = [
                        // STAGE BRONZE (8 services)
                        ['bronze', 'DECORATION', 'Pathway decoration', 1],
                        ['bronze', 'DECORATION', 'Entrance arch', 2],
                        ['bronze', 'DECORATION', 'Welcome board', 3],
                        ['bronze', 'PRODUCTION', 'Generator (genset) with fuel', 4],
                        ['bronze', 'PRODUCTION', 'Sound system', 5],
                        ['bronze', 'PRODUCTION', 'Top, sub & feedback', 6],
                        ['bronze', 'HOSPITALITY', 'Cake', 7],
                        ['bronze', 'HOSPITALITY', 'Wine', 8],

                        // STAGE SILVER (10 services)
                        ['silver', 'DECORATION', '15-foot ramp', 1],
                        ['silver', 'DECORATION', 'Pathway decoration', 2],
                        ['silver', 'DECORATION', 'Entrance arch', 3],
                        ['silver', 'DECORATION', 'Welcome board', 4],
                        ['silver', 'PRODUCTION', 'Generator (genset) with fuel', 5],
                        ['silver', 'PRODUCTION', 'Sound system', 6],
                        ['silver', 'PRODUCTION', 'Top, sub & feedback', 7],
                        ['silver', 'HOSPITALITY', 'Cake', 8],
                        ['silver', 'HOSPITALITY', 'Wine', 9],
                        ['silver', 'EFFECTS', 'Cold fire', 10],

                        // STAGE GOLD (14 services)
                        ['gold', 'DECORATION', '15-foot ramp', 1],
                        ['gold', 'DECORATION', 'Pathway decoration', 2],
                        ['gold', 'DECORATION', 'Entrance arch', 3],
                        ['gold', 'DECORATION', 'Welcome board', 4],
                        ['gold', 'PRODUCTION', 'Generator (genset) with fuel', 5],
                        ['gold', 'PRODUCTION', 'Sound system', 6],
                        ['gold', 'PRODUCTION', 'Top, sub & feedback', 7],
                        ['gold', 'ENTERTAINMENT', 'MC', 8],
                        ['gold', 'ENTERTAINMENT', 'Hosting girls', 9],
                        ['gold', 'ENTERTAINMENT', 'SFS', 10],
                        ['gold', 'HOSPITALITY', 'Cake', 11],
                        ['gold', 'HOSPITALITY', 'Wine', 12],
                        ['gold', 'EFFECTS', 'Cold fire', 13],
                        ['gold', 'EFFECTS', 'Dry ice fog', 14],

                        // PREMIUM STAGE (23 services)
                        ['premium', 'DECORATION', '15-foot ramp', 1],
                        ['premium', 'DECORATION', 'Pathway decoration', 2],
                        ['premium', 'DECORATION', 'Entrance arch', 3],
                        ['premium', 'DECORATION', 'Welcome board', 4],
                        ['premium', 'DECORATION', 'Mala', 5],
                        ['premium', 'DECORATION', 'Altar decoration', 6],
                        ['premium', 'DECORATION', 'Church arch', 7],
                        ['premium', 'DECORATION', 'Family table', 8],
                        ['premium', 'DECORATION', 'Premium chairs', 9],
                        ['premium', 'PRODUCTION', 'Generator (genset) with fuel', 10],
                        ['premium', 'PRODUCTION', 'Sound system', 11],
                        ['premium', 'PRODUCTION', 'Top, sub & feedback', 12],
                        ['premium', 'ENTERTAINMENT', 'MC', 13],
                        ['premium', 'ENTERTAINMENT', 'Hosting girls', 14],
                        ['premium', 'ENTERTAINMENT', 'SFS', 15],
                        ['premium', 'ENTERTAINMENT', 'Live fusion', 16],
                        ['premium', 'ENTERTAINMENT', 'Welcome dance', 17],
                        ['premium', 'HOSPITALITY', 'Cake', 18],
                        ['premium', 'HOSPITALITY', 'Wine', 19],
                        ['premium', 'EFFECTS', 'Cold fire', 20],
                        ['premium', 'EFFECTS', 'Dry ice fog', 21],
                        ['premium', 'EFFECTS', 'Confetti', 22],
                        ['premium', 'EFFECTS', 'Bubble machine', 23],

                        // PREMIUM PLUS (32 services)
                        ['premium-plus', 'DECORATION', '15-foot ramp', 1],
                        ['premium-plus', 'DECORATION', 'Pathway decoration', 2],
                        ['premium-plus', 'DECORATION', 'Entrance arch', 3],
                        ['premium-plus', 'DECORATION', 'Welcome board', 4],
                        ['premium-plus', 'DECORATION', 'Mala', 5],
                        ['premium-plus', 'DECORATION', 'Altar decoration', 6],
                        ['premium-plus', 'DECORATION', 'Church arch', 7],
                        ['premium-plus', 'DECORATION', 'Hall dome / ceiling cloth', 8],
                        ['premium-plus', 'DECORATION', 'VIP sofa', 9],
                        ['premium-plus', 'DECORATION', 'Premium chairs', 10],
                        ['premium-plus', 'DECORATION', 'Dining table', 11],
                        ['premium-plus', 'DECORATION', 'Family table', 12],
                        ['premium-plus', 'DECORATION', 'Dining arrangements', 13],
                        ['premium-plus', 'LIGHTING', 'Custom lighting', 14],
                        ['premium-plus', 'LIGHTING', 'Ambiance lighting', 15],
                        ['premium-plus', 'LIGHTING', 'Sharpie lights', 16],
                        ['premium-plus', 'LIGHTING', 'LED strobes', 17],
                        ['premium-plus', 'LIGHTING', 'LED walls', 18],
                        ['premium-plus', 'PRODUCTION', 'Generator (genset) with fuel', 19],
                        ['premium-plus', 'PRODUCTION', 'Sound system', 20],
                        ['premium-plus', 'PRODUCTION', 'Top, sub & feedback', 21],
                        ['premium-plus', 'ENTERTAINMENT', 'MC', 22],
                        ['premium-plus', 'ENTERTAINMENT', 'Hosting girls', 23],
                        ['premium-plus', 'ENTERTAINMENT', 'SFS', 24],
                        ['premium-plus', 'ENTERTAINMENT', 'Live fusion', 25],
                        ['premium-plus', 'ENTERTAINMENT', 'Welcome dance', 26],
                        ['premium-plus', 'HOSPITALITY', 'Cake', 27],
                        ['premium-plus', 'HOSPITALITY', 'Wine', 28],
                        ['premium-plus', 'EFFECTS', 'Cold fire', 29],
                        ['premium-plus', 'EFFECTS', 'Dry ice fog', 30],
                        ['premium-plus', 'EFFECTS', 'Confetti', 31],
                        ['premium-plus', 'EFFECTS', 'Bubble machine', 32]
                    ];
                    const stmtSrv = db.prepare(`INSERT INTO package_services (package_id, category_group, service_name, display_order) VALUES (?, ?, ?, ?)`);
                    seedServices.forEach(s => stmtSrv.run(s));
                    stmtSrv.finalize();
                    console.log("Package migration complete.");
                }
            });

            // GALLERY TABLE
            db.run(`
                CREATE TABLE IF NOT EXISTS gallery (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    title TEXT,
                    category TEXT,
                    image_url TEXT,
                    description TEXT,
                    display_order INTEGER DEFAULT 0,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `);

            // Seed initial gallery if empty
            db.get(`SELECT COUNT(*) as count FROM gallery`, [], (err, row) => {
                if (!err && (!row || row.count === 0)) {
                    console.log("Seeding initial gallery collections...");
                    const initialGallery = [
                        ['Traditional Hindu Mandap & Sacred Vows', 'Hindu Wedding', 'assets/images/hindu-destination-wedding.jpg', 'Authentic traditional mandap with floral artistry amidst misty hills.', 1],
                        ['Highland Hindu Wedding Ceremony', 'Hindu Wedding', 'assets/images/hindu-wedding.jpg', 'Vibrant ceremonial rituals and bespoke wedding stage.', 2],
                        ['Church Altar & Mountain Backdrop', 'Christian Wedding', 'assets/images/christian-destination-wedding.jpg', 'Graceful white and pastel floral sanctuary with grand walkway.', 3],
                        ['Cathedral Elegance & Evening Blessing', 'Christian Wedding', 'assets/images/christian-wedding.jpg', 'Atmospheric church celebration and luxury choir arrangement.', 4],
                        ['Regal Nikah Pavilion & Stage', 'Muslim Wedding', 'assets/images/muslim-destination-wedding.jpg', 'Grand royal floral arch and majestic stage backdrop.', 5],
                        ['Bespoke Malabar Wedding Scenography', 'Muslim Wedding', 'assets/images/muslim-wedding.jpg', 'Opulent wedding celebration with traditional hospitality aesthetic.', 6],
                        ['Highland Betrothal & Floral Ring Stage', 'Engagement', 'assets/images/betrothal.jpg', 'Bespoke ring ceremony stage with cascading florals and fairy lights.', 7],
                        ['Intimate Ring Exchange Pavilion', 'Engagement', 'assets/images/celebration-showcase.jpg', 'Elegant evening engagement setup for close family and friends.', 8],
                        ['Grand Gala Reception Scenography', 'Reception', 'assets/images/event-corporate-gala.jpg', 'State-of-the-art ballroom reception with custom stage lighting.', 9],
                        ['Indoor Luxury Banquet Reception', 'Reception', 'assets/images/indoor-wedding.jpg', 'Sophisticated table styling and warm ambient crystal chandeliers.', 10],
                        ['Tea Estate Open Air Reception', 'Reception', 'assets/images/outdoor-wedding.jpg', 'Evening garden celebration under the starlit Munnar skies.', 11],
                        ['Munnar Misty Highland Wedding', 'Destination Wedding', 'assets/images/munnar-main-destination-wedding.png', 'Iconic tea plantation amphitheatre vows with rolling cloud views.', 12],
                        ['Tea Estate Valley Panorama Wedding', 'Destination Wedding', 'assets/images/munnar-valley-wedding.png', 'Breathtaking mountain valley backdrop and natural botanical styling.', 13],
                        ['Intimate Mountain Slope Pavilion', 'Destination Wedding', 'assets/images/munnar-intimate-wedding.png', 'Exclusive hillside wedding gazebo overlooking endless green slopes.', 14],
                        ['Sunset Amphitheatre Gathering', 'Destination Wedding', 'assets/images/event-destination-outdoor.jpg', 'Sunset celebration with custom perimeter illumination.', 15],
                        ['Monolithic Concert & Truss Stage', 'Stage & Production', 'assets/images/stage-production.jpg', 'Heavy-duty aluminium trussing and moving head lighting fixtures.', 16],
                        ['Floral Ramp & Ambient Illumination', 'Stage & Production', 'assets/images/stage-decoration.jpg', 'Bespoke runway and illuminated focal backdrop.', 17],
                        ['High-End Acoustic & Line Array Production', 'Stage & Production', 'assets/images/sound-lighting.jpg', 'Tour-grade audio systems, stage monitors, and digital sound control.', 18],
                        ['Live Concert & Strobe Effects', 'Stage & Production', 'assets/images/event-live-concert.jpg', 'Dynamic lighting and concert production for high-energy celebrations.', 19],
                        ['Celebration Fireworks Finalé', 'Stage & Production', 'assets/images/fireworks-show.jpg', 'Spectacular cold pyro and fireworks display to close the night.', 20]
                    ];
                    const stmtGal = db.prepare(`INSERT INTO gallery (title, category, image_url, description, display_order) VALUES (?, ?, ?, ?, ?)`);
                    initialGallery.forEach(g => stmtGal.run(g));
                    stmtGal.finalize();
                }
            });

            // Ensure package imagery is stage-focused rather than cultural wedding photos
            db.run(`UPDATE packages_new SET image_url = 'assets/images/stage-decoration.jpg' WHERE id = 'gold' AND image_url LIKE '%hindu%'`);
            db.run(`UPDATE packages_new SET image_url = 'assets/images/sound-lighting.jpg' WHERE id = 'silver' AND image_url LIKE '%munnar%'`);
            db.run(`UPDATE packages_new SET image_url = 'assets/images/stage-production.jpg' WHERE id = 'premium-plus' AND image_url LIKE '%corporate%'`);
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
                    featuresArr.push(ps.service_name); // Include all package services without limit
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

// Get Gallery Images for public frontend
app.get('/api/public/gallery', (req, res) => {
    const category = req.query.category;
    if (category && category !== 'all' && category !== 'ALL') {
        db.all(`SELECT * FROM gallery WHERE LOWER(category) = LOWER(?) ORDER BY display_order ASC, created_at DESC`, [category], (err, rows) => {
            if (err) return res.status(500).json({ error: 'Database error' });
            res.json(rows);
        });
    } else {
        db.all(`SELECT * FROM gallery ORDER BY display_order ASC, created_at DESC`, [], (err, rows) => {
            if (err) return res.status(500).json({ error: 'Database error' });
            res.json(rows);
        });
    }
});

app.post('/api/enquiries', (req, res) => {
    const { name, email, phone, message } = req.body || {};
    
    // Validate name
    const trimmedName = typeof name === 'string' ? name.trim() : '';
    if (!trimmedName || trimmedName.length < 2 || trimmedName.length > 100) {
        return res.status(400).json({ error: 'Please provide a valid name between 2 and 100 characters.' });
    }

    // Validate phone
    const trimmedPhone = typeof phone === 'string' ? phone.trim() : '';
    const digitsOnly = trimmedPhone.replace(/\D/g, '');
    if (!trimmedPhone || digitsOnly.length < 7 || digitsOnly.length > 15) {
        return res.status(400).json({ error: 'Please provide a valid contact telephone number.' });
    }

    // Validate email if provided
    const trimmedEmail = typeof email === 'string' ? email.trim() : '';
    if (trimmedEmail) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(trimmedEmail) || trimmedEmail.length > 120) {
            return res.status(400).json({ error: 'Please provide a valid email address.' });
        }
    }

    // Sanitize message
    const trimmedMessage = typeof message === 'string' ? message.trim().slice(0, 2000) : '';

    db.run(
        `INSERT INTO enquiries (name, email, phone, message) VALUES (?, ?, ?, ?)`,
        [trimmedName, trimmedEmail, trimmedPhone, trimmedMessage],
        function(err) {
            if (err) return res.status(500).json({ error: 'Failed to submit enquiry. Please try again later.' });
            res.json({ success: true, id: this.lastID });
        }
    );
});

// Secure Booking Lookup (Admin authenticated or verified customer status lookup only)
app.get('/api/booking/:booking_id', (req, res) => {
    const bookingId = (req.params.booking_id || '').trim();
    if (!bookingId || bookingId.length > 100) {
        return res.status(400).json({ error: 'Invalid booking ID format.' });
    }

    // Check for Admin Bearer token authorization
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    let isAdmin = false;
    if (token) {
        try {
            const decoded = jwt.verify(token, JWT_SECRET);
            if (decoded && decoded.id) {
                isAdmin = true;
            }
        } catch (e) {
            // Invalid or expired token - do not treat as admin
        }
    }

    // Customer verification: requires phone number matching the booking record
    const verificationPhone = (req.query.phone || req.headers['x-booking-phone'] || '').toString().trim().replace(/[\s\-\+\(\)]/g, '');

    // Unauthorized if neither admin nor verification phone provided
    if (!isAdmin && !verificationPhone) {
        return res.status(401).json({ error: 'Unauthorized: Admin authentication or phone verification required to view booking details.' });
    }

    db.get(`SELECT * FROM bookings WHERE booking_id = ?`, [bookingId], (err, row) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        if (!row) return res.status(404).json({ error: 'Booking not found' });

        if (isAdmin) {
            // Authorized admin gets full booking record
            return res.json(row);
        }

        // Verify phone for customer access
        const bookingPhoneClean = (row.phone || '').toString().trim().replace(/[\s\-\+\(\)]/g, '');
        const bookingWaClean = (row.whatsapp || '').toString().trim().replace(/[\s\-\+\(\)]/g, '');

        const phoneMatches = verificationPhone && (
            (bookingPhoneClean && bookingPhoneClean.endsWith(verificationPhone.slice(-10))) ||
            (bookingWaClean && bookingWaClean.endsWith(verificationPhone.slice(-10)))
        );

        if (!phoneMatches) {
            return res.status(403).json({ error: 'Forbidden: Verification credentials do not match this booking.' });
        }

        // Return sanitized status info without sensitive PII
        res.json({
            booking_id: row.booking_id,
            event_type: row.event_type,
            event_date: row.event_date,
            package_name: row.package_name,
            status: row.status,
            payment_status: row.payment_status,
            guest_count: row.guest_count,
            created_at: row.created_at
        });
    });
});


// ==========================================
// ADMIN API ROUTES
// ==========================================

app.post('/api/admin/login', (req, res) => {
    const { username, password } = req.body || {};
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

// Image Upload (Single)
app.post('/api/admin/upload-image', authenticateToken, upload.single('image'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'Please upload an image file' });
    }
    const relativePath = 'assets/uploads/' + req.file.filename;
    res.json({ success: true, imageUrl: relativePath });
});

// Image Upload (Multiple files - up to 30 images at once)
app.post('/api/admin/upload-multiple', authenticateToken, upload.array('images', 30), (req, res) => {
    if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: 'Please select at least one image file to upload.' });
    }
    const uploadedFiles = req.files.map(file => ({
        imageUrl: 'assets/uploads/' + file.filename,
        originalName: file.originalname,
        size: file.size
    }));
    res.json({ success: true, files: uploadedFiles });
});

// Categories CRUD
app.get('/api/admin/categories', authenticateToken, (req, res) => {
    db.all(`SELECT * FROM categories ORDER BY display_order ASC`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json(rows);
    });
});

app.post('/api/admin/categories', authenticateToken, (req, res) => {
    const { name, display_order, status } = req.body || {};
    db.run(`INSERT INTO categories (name, display_order, status) VALUES (?, ?, ?)`, [name, display_order || 0, status || 'ACTIVE'], function(err) {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json({ success: true, id: this.lastID });
    });
});

app.put('/api/admin/categories/:id', authenticateToken, (req, res) => {
    const { name, display_order, status } = req.body || {};
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
    const { id, name, category_id, theme, short_description, description, price_from, price_to, image_url, status, display_order, services } = req.body || {};
    
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
    const { name, category_id, theme, short_description, description, price_from, price_to, image_url, status, display_order, services } = req.body || {};
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
    const { status } = req.body || {};
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
    const { category_group, service_name, display_order } = req.body || {};
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

// Admin Dashboard API
app.get('/api/admin/dashboard', authenticateToken, (req, res) => {
    const stats = {
        totalBookings: 0,
        pendingBookings: 0,
        confirmedBookings: 0,
        totalEnquiries: 0,
        totalPackages: 0,
        totalGallery: 0,
        upcomingEvents: 0,
        totalValue: 0,
        totalAdvance: 0,
        balanceDue: 0
    };
    db.serialize(() => {
        db.get(`SELECT COUNT(*) as total FROM bookings`, [], (err, row) => { if (row) stats.totalBookings = row.total || 0; });
        db.get(`SELECT COUNT(*) as pending FROM bookings WHERE status LIKE '%PENDING%'`, [], (err, row) => { if (row) stats.pendingBookings = row.pending || 0; });
        db.get(`SELECT COUNT(*) as confirmed FROM bookings WHERE status = 'CONFIRMED'`, [], (err, row) => { if (row) stats.confirmedBookings = row.confirmed || 0; });
        db.get(`SELECT SUM(package_amount) as val FROM bookings WHERE status != 'CANCELLED' AND status != 'PAYMENT FAILED'`, [], (err, row) => { if (row) stats.totalValue = row.val || 0; });
        db.get(`SELECT SUM(amount_paid) as val FROM bookings`, [], (err, row) => { if (row) stats.totalAdvance = row.val || 0; });
        db.get(`SELECT SUM(balance_amount) as val FROM bookings WHERE status != 'CANCELLED' AND status != 'PAYMENT FAILED'`, [], (err, row) => { if (row) stats.balanceDue = row.val || 0; });
        db.get(`SELECT COUNT(*) as total FROM enquiries`, [], (err, row) => { if (row) stats.totalEnquiries = row.total || 0; });
        db.get(`SELECT COUNT(*) as total FROM packages_new WHERE status = 'ACTIVE'`, [], (err, row) => { if (row) stats.totalPackages = row.total || 0; });
        db.get(`SELECT COUNT(*) as total FROM gallery`, [], (err, row) => { if (row) stats.totalGallery = row.total || 0; });
        const todayStr = new Date().toISOString().split('T')[0];
        db.get(`SELECT COUNT(*) as total FROM bookings WHERE event_date >= ?`, [todayStr], (err, row) => {
            if (row) stats.upcomingEvents = row.total || 0;
            res.json(stats);
        });
    });
});

// Admin Gallery APIs
app.get('/api/admin/gallery', authenticateToken, (req, res) => {
    const category = req.query.category;
    if (category && category !== 'all' && category !== 'ALL') {
        db.all(`SELECT * FROM gallery WHERE LOWER(category) = LOWER(?) ORDER BY display_order ASC, created_at DESC, id DESC`, [category], (err, rows) => {
            if (err) return res.status(500).json({ error: 'Database error' });
            res.json(rows || []);
        });
    } else {
        db.all(`SELECT * FROM gallery ORDER BY display_order ASC, created_at DESC, id DESC`, [], (err, rows) => {
            if (err) return res.status(500).json({ error: 'Database error' });
            res.json(rows || []);
        });
    }
});

// Single Photo Add
app.post('/api/admin/gallery', authenticateToken, (req, res) => {
    const { title, category, image_url, description, display_order } = req.body || {};
    if (!title || !category || !image_url) {
        return res.status(400).json({ error: 'Title, category, and image URL are required' });
    }
    db.run(
        `INSERT INTO gallery (title, category, image_url, description, display_order) VALUES (?, ?, ?, ?, ?)`,
        [title, category, image_url, description || '', parseInt(display_order, 10) || 0],
        function(err) {
            if (err) return res.status(500).json({ error: 'Database error' });
            res.json({ success: true, id: this.lastID });
        }
    );
});

// Batch Add Multiple Photos to a Category
app.post('/api/admin/gallery/batch', authenticateToken, (req, res) => {
    const { category, items } = req.body || {};
    if (!category || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: 'Category and a non-empty items array are required.' });
    }

    const stmt = db.prepare(`
        INSERT INTO gallery (title, category, image_url, description, display_order)
        VALUES (?, ?, ?, ?, ?)
    `);

    let count = 0;
    db.serialize(() => {
        items.forEach((item, idx) => {
            const title = item.title && item.title.trim() ? item.title.trim() : `${category} Setup #${idx + 1}`;
            const desc = item.description || '';
            const order = parseInt(item.display_order, 10) || 0;
            if (item.image_url) {
                stmt.run(title, category, item.image_url, desc, order);
                count++;
            }
        });

        stmt.finalize((err) => {
            if (err) return res.status(500).json({ error: 'Database error saving batch gallery images' });
            res.json({ success: true, count });
        });
    });
});

// Reorder Gallery Images (Optional priority batch update)
app.put('/api/admin/gallery/reorder', authenticateToken, (req, res) => {
    const { items } = req.body || {};
    if (!Array.isArray(items)) {
        return res.status(400).json({ error: 'Items array required' });
    }

    const stmt = db.prepare(`UPDATE gallery SET display_order = ? WHERE id = ?`);
    db.serialize(() => {
        items.forEach(it => {
            stmt.run(parseInt(it.display_order, 10) || 0, it.id);
        });
        stmt.finalize((err) => {
            if (err) return res.status(500).json({ error: 'Database error updating display order' });
            res.json({ success: true });
        });
    });
});

app.put('/api/admin/gallery/:id', authenticateToken, (req, res) => {
    const { title, category, image_url, description, display_order } = req.body || {};
    db.run(
        `UPDATE gallery SET title = ?, category = ?, image_url = ?, description = ?, display_order = ? WHERE id = ?`,
        [title, category, image_url, description || '', parseInt(display_order, 10) || 0, req.params.id],
        function(err) {
            if (err) return res.status(500).json({ error: 'Database error' });
            res.json({ success: true });
        }
    );
});

app.delete('/api/admin/gallery/:id', authenticateToken, (req, res) => {
    db.get(`SELECT image_url FROM gallery WHERE id = ?`, [req.params.id], (err, row) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        if (!row) return res.status(404).json({ error: 'Gallery photo not found' });

        const imageUrl = row.image_url;

        db.run(`DELETE FROM gallery WHERE id = ?`, [req.params.id], function(delErr) {
            if (delErr) return res.status(500).json({ error: 'Database error' });

            // Filesystem Safety: Strictly ensure file is confined within public/assets/uploads
            if (imageUrl && typeof imageUrl === 'string') {
                const uploadsDir = path.resolve(__dirname, 'public', 'assets', 'uploads');
                const resolvedTarget = path.resolve(__dirname, 'public', imageUrl);
                if (resolvedTarget.startsWith(uploadsDir + path.sep)) {
                    fs.unlink(resolvedTarget, (unlinkErr) => {
                        if (unlinkErr && unlinkErr.code !== 'ENOENT') {
                            console.error('Failed to unlink gallery file:', unlinkErr.message);
                        }
                    });
                }
            }

            res.json({ success: true });
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
    const { status, payment_status } = req.body || {};
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
    const { status } = req.body || {};
    db.run(`UPDATE enquiries SET status = ? WHERE id = ?`, [status, req.params.id], function(err) {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json({ success: true });
    });
});

app.post('/api/admin/notes', authenticateToken, (req, res) => {
    const { entity_type, entity_id, note } = req.body || {};
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
            dateFilter = "WHERE created_at >= ? AND created_at <= ?";
            params = [`${startDate} 00:00:00`, `${endDate} 23:59:59`];
        } else if (startDate) {
            dateFilter = "WHERE created_at >= ?";
            params = [`${startDate} 00:00:00`];
        } else if (endDate) {
            dateFilter = "WHERE created_at <= ?";
            params = [`${endDate} 23:59:59`];
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

// Global Error Handler
app.use((err, req, res, next) => {
    console.error('[UNHANDLED ERROR]', err.message);
    if (res.headersSent) {
        return next(err);
    }

    // Graceful handling of Multer file upload errors
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ error: 'File too large. Maximum file size allowed is 10MB.' });
        }
        return res.status(400).json({ error: `Upload error: ${err.message}` });
    }

    const status = err.status || err.statusCode || 500;
    res.status(status).json({
        error: process.env.NODE_ENV === 'production' && status === 500
            ? 'An internal server error occurred.' 
            : err.message
    });
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});

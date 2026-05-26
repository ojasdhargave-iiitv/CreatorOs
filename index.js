require("dotenv").config({ path: ".env.local" });
const cookieParser = require("cookie-parser");
const express = require('express');
const path = require('path');

// Validate required environment variables
const requiredEnvVars = [
    { name: 'MONGODB_URI', description: 'MongoDB connection string' },
    { name: 'JWT_SECRET', description: 'Secret key for JWT token signing' },
];

const missingVars = requiredEnvVars.filter((v) => !process.env[v.name]);

if (missingVars.length > 0) {
    console.error('\n❌ Missing required environment variables:');
    missingVars.forEach((v) => {
        console.error(`   - ${v.name} (${v.description})`);
    });
    console.error('\n📋 To set them up:');
    console.error('   1. Copy the example env file:');
    console.error('      cp .env.example .env.local');
    console.error('   2. Edit .env.local and fill in the values:');
    console.error('      - MONGODB_URI: Your MongoDB connection string');
    console.error('        (for local MongoDB: mongodb://localhost:27017/creatoros)');
    console.error('      - JWT_SECRET: Generate a random secret');
    console.error('        by running: openssl rand -base64 32');
    console.error('   3. Run the server again:');
    console.error('      npm run dev\n');
    process.exit(1);
}

const app = express();

const connectDB = require("./connect");
const authRoutes = require("./routes/auth");
const collaborationRoutes = require('./routes/collaboration');
const { acceptInvite, acceptInviteFromDashboard } = require('./controller/collaborationController');

connectDB();
app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.set("view engine", "ejs");
app.set('views', path.join(__dirname, 'view'));

app.use("/", authRoutes);

const protect = require("./middleware/auth");

const fs = require('fs');
const shortid = require('shortid');
const multer = require('multer');
const services = require('./services.config');
const User = require('./model/user');
const Invite = require('./model/invite');

const port = process.env.PORT || 3000;
const urlRoutes = require('./routes/url');
const instagramRoutes = require('./routes/instagram');

const suggestionRoutes = require('./routes/suggestionRoutes');
// ... after your other app.use() lines:
app.use('/suggestions', protect, suggestionRoutes);
app.use('/api/instagram', protect, instagramRoutes);
app.use('/services/creator-crm', protect, collaborationRoutes);
app.post('/dashboard/accept-invite', protect, acceptInviteFromDashboard);
app.get('/invites/accept/:token', acceptInvite);
// In-memory "database" to store URLs.
// Note: This data will be lost when the server restarts.
const urlDatabase = new Map();

app.use('/url', urlRoutes);

const uploadDir = "/tmp";

const storage = multer.diskStorage({
    destination: function (req, file, cb) { cb(null, "/tmp"); },
    filename: function (req, file, cb) { cb(null, Date.now() + '-' + file.originalname); }
});
const upload = multer({ storage: storage, limits: { fileSize: 50 * 1024 * 1024 } });

function findServiceByKey(key) {
    return services.find((service) => service.key === key);
}

function buildShortenerViewModel(req, shortId = null, error = null) {
    return {
        service: findServiceByKey('url-shortener'),
        shortUrl: shortId ? `${req.protocol}://${req.get('host')}/u/${shortId}` : null,
        error,
    };
}

function buildAccountViewModel(userDoc, fallbackUser) {
    const name = userDoc?.name || 'Creator';
    const initials = name
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0].toUpperCase())
        .join('') || 'CR';

    return {
        id: fallbackUser.id,
        name,
        email: userDoc?.email || '',
        initials,
    };
}

function buildAnalyticsViewModel() {
    return {
        isLoading: false,
        isEmpty: false,
        selectedRange: 'Last 30 days',
        lastUpdated: null,
        profile: {
            name: 'Profile not fetched',
            handle: '@username',
            category: 'Instagram public profile',
            bio: 'Enter an Instagram username and click Analyze to fetch public profile details through the configured Instagram Graph API credentials.',
            avatarInitials: 'IG',
            followers: '--',
            following: '--',
            totalPosts: '--',
            growthLabel: 'Awaiting profile',
        },
        metrics: [
            { label: 'Followers', value: '--', change: 'Fetch profile', tone: 'cyan' },
            { label: 'Engagement rate', value: '--', change: 'Pending analytics', tone: 'green' },
            { label: 'Avg. likes', value: '--', change: 'Pending posts', tone: 'blue' },
            { label: 'Avg. comments', value: '--', change: 'Pending posts', tone: 'orange' },
            { label: 'Posting frequency', value: '--', change: 'Pending history', tone: 'violet' },
            { label: 'Best post', value: '--', change: 'Pending posts', tone: 'pink' },
        ],
        charts: {
            labels: ['Start', 'Profile fetched', 'Snapshot 1', 'Snapshot 2', 'Snapshot 3'],
            followers: [0, 0, 0, 0, 0],
            engagement: [0, 0, 0, 0, 0],
            posts: ['No posts'],
            postPerformance: [0],
        },
        topPosts: [],
        timeline: [],
    };
}

app.get("/dashboard", protect, async (req, res) => {
    const userDoc = await User.findById(req.user.id).select('name email').lean();
    const invites = await Invite.find({ inviter: req.user.id }).lean();
    const inviteSummary = {
        total: invites.length,
        pending: invites.filter((invite) => invite.status === 'pending').length,
        accepted: invites.filter((invite) => invite.status === 'accepted').length,
        expired: invites.filter((invite) => invite.status === 'expired').length,
    };

    res.render("dashboard", {
        user: buildAccountViewModel(userDoc, req.user),
        services,
        inviteSummary,
        inviteAcceptMessage: null,
        inviteAcceptError: null,
    });
});

app.get("/profile", protect, async (req, res) => {
    const userDoc = await User.findById(req.user.id).select('name email').lean();

    res.render("profile", { user: buildAccountViewModel(userDoc, req.user) });
});

// Service hub landing page
app.get('/', (req, res) => {
    res.render('services-hub', { services });
});

// Optional convenience route
app.get('/services', (req, res) => {
    res.redirect('/');
});

// Protected service pages
app.get('/services/:serviceKey', protect, async (req, res) => {
    const service = findServiceByKey(req.params.serviceKey);

    if (!service) {
        return res.status(404).render('coming-soon', {
            service: {
                name: 'Unknown service',
                description: 'This service does not exist in the current module registry.',
                status: 'coming_soon',
            },
        });
    }

    if (service.status !== 'available') {
        return res.render('coming-soon', { service });
    }

    if (service.key === 'url-shortener') {
        return res.render('home', buildShortenerViewModel(req));
    }

    if (service.key === 'suggestion-tool') {
        return res.redirect('/suggestions');
    }

    if (service.key === 'creator-crm') {
        return res.redirect('/services/creator-crm');
    }

    if (service.key === 'analytics-dashboard') {
        const userDoc = await User.findById(req.user.id).select('name email').lean();

        return res.render('analytics-dashboard', {
            service,
            services,
            user: buildAccountViewModel(userDoc, req.user),
            analytics: buildAnalyticsViewModel(),
        });
    }

    if (service.key === 'file-upload') {
        return res.render('file-upload');
    }

    return res.render('coming-soon', { service });
});

// URL shortener submit flow (dedicated service route)
app.post('/services/url-shortener/shorten', protect, async (req, res) => {
    const { redirectUrl } = req.body;
    if (!redirectUrl) {
        return res.render('home', buildShortenerViewModel(req, null, 'Please enter a URL.'));
    }

    try {
        const shortId = shortid();

        // Store the new link in our in-memory database
        urlDatabase.set(shortId, {
            redirectUrl,
            totalClicks: 0,
            createdAt: [],
        });

        return res.render('home', buildShortenerViewModel(req, shortId));
    } catch (err) {
        // Log the actual error to the server console for debugging
        console.error('Error creating short URL:', err);
        return res.render('home', buildShortenerViewModel(req, null, 'An unexpected error occurred.'));
    }
});

// File upload endpoint
app.post('/services/file-upload/upload', protect, upload.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }
    return res.json({
        filename: req.file.originalname,
        size: req.file.size,
        mimetype: req.file.mimetype,
        path: req.file.filename,
    });
});

// Redirect for generated short URLs
app.get('/u/:shortId', async (req, res) => {
    const shortId = req.params.shortId;

    // Find the entry in our in-memory database
    const entry = urlDatabase.get(shortId);

    if (entry) {
        // Update analytics
        entry.totalClicks++;
        entry.createdAt.push({ timeStamp: new Date() });
        return res.redirect(entry.redirectUrl);
    } else {
        return res.status(404).send('URL not found');
    }
});

// Centralized error handler
const errorHandler = require('./middleware/errorHandler');
app.use(errorHandler);

if (require.main === module) {
    app.listen(port, () => {
        console.log(`Server is running on http://localhost:${port}`);
    });
}

module.exports = app;

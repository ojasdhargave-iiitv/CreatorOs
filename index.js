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

const suggestionRoutes = require('./routes/suggestionRoutes');
// ... after your other app.use() lines:
app.use('/suggestions', protect, suggestionRoutes);
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
        lastUpdated: '25 May 2026, 5:30 PM',
        profile: {
            name: 'Aarav Studio',
            handle: '@aaravstudio',
            category: 'Digital creator',
            bio: 'Short-form creator sharing design systems, creator workflows, and behind-the-scenes builds.',
            avatarInitials: 'AS',
            followers: '128.4K',
            following: '642',
            totalPosts: '318',
            growthLabel: '+8.6%',
        },
        metrics: [
            { label: 'Followers', value: '128.4K', change: '+8.6%', tone: 'cyan' },
            { label: 'Engagement rate', value: '6.82%', change: '+1.2%', tone: 'green' },
            { label: 'Avg. likes', value: '8.7K', change: '+940', tone: 'blue' },
            { label: 'Avg. comments', value: '412', change: '+38', tone: 'orange' },
            { label: 'Posting frequency', value: '5.4/wk', change: 'Consistent', tone: 'violet' },
            { label: 'Best post', value: '14.9%', change: 'Engagement', tone: 'pink' },
        ],
        charts: {
            labels: ['Apr 26', 'May 1', 'May 6', 'May 11', 'May 16', 'May 21', 'May 25'],
            followers: [113200, 115400, 118900, 120500, 123300, 126100, 128400],
            engagement: [5.4, 5.9, 6.1, 5.7, 6.4, 6.6, 6.82],
            posts: ['Launch reel', 'Carousel tips', 'Studio vlog', 'Template drop', 'AMA clip'],
            postPerformance: [14900, 12100, 9800, 8700, 7600],
        },
        topPosts: [
            { title: 'How I plan 30 days of content', type: 'Reel', likes: '14.2K', comments: '612', engagement: '14.9%', date: '24 May' },
            { title: 'Creator OS desk setup walkthrough', type: 'Carousel', likes: '11.8K', comments: '488', engagement: '12.4%', date: '22 May' },
            { title: '5 hooks that increased watch time', type: 'Reel', likes: '9.6K', comments: '371', engagement: '10.1%', date: '19 May' },
            { title: 'Behind the scenes: newsletter build', type: 'Post', likes: '7.4K', comments: '284', engagement: '8.7%', date: '16 May' },
        ],
        timeline: [
            { title: 'Top post detected', detail: 'Planning reel crossed 14.9% engagement.', time: 'Today, 4:20 PM' },
            { title: 'Audience growth spike', detail: 'Followers increased by 2.3K over the last 48 hours.', time: 'Today, 11:10 AM' },
            { title: 'Weekly consistency check', detail: 'Posting cadence stayed above 5 posts per week.', time: 'Yesterday' },
            { title: 'Profile snapshot saved', detail: 'Mock analytics snapshot prepared for dashboard UI.', time: '24 May' },
        ],
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

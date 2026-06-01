require("dotenv").config({ path: ".env.local" });
const cookieParser = require("cookie-parser");
const express = require('express');
const passport = require("passport");
const path = require('path');
const services = require('./services.config');

// Validate required environment variables
const requiredEnvVars = [
    { name: 'MONGODB_URI', description: 'MongoDB connection string' },
    { name: 'JWT_SECRET', description: 'Secret key for JWT token signing' },
];

const missingVars = requiredEnvVars.filter((v) => !process.env[v.name]);

if (missingVars.length > 0) {
    console.warn('\n⚠️ Missing environment variables for full production mode:');
    missingVars.forEach((v) => {
        console.warn(`   - ${v.name} (${v.description})`);
    });
    console.warn('\n📋 The app will start in local mock mode.');
    console.warn('   To use a real database, copy .env.example to .env.local and fill in the values.\n');
}

const app = express();

const connectDB = require("./connect");
const authRoutes = require("./routes/auth");
const collaborationRoutes = require('./routes/collaboration');
const analyticsRoutes = require("./routes/analytics");
const { acceptInvite, acceptInviteFromDashboard } = require('./controller/collaborationController');
const { loginLimiter, uploadLimiter, urlShortenerPageLimiter } = require('./middleware/rateLimiters');
const { wantsHtml } = require('./utils/requestType');
const { findServiceByKey, buildShortenerViewModel } = require('./utils/viewModels');

connectDB();
require("./workers/analyticsRefreshWorker");
app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(passport.initialize());

app.set("view engine", "ejs");
app.set('views', path.join(__dirname, 'view'));

app.post('/login', loginLimiter);

app.use("/", authRoutes);

const protect = require("./middleware/auth");
const { preventContributorWrites } = require("./middleware/auth");

const fs = require('fs');
app.use(express.static(path.join(__dirname, 'public')));
const shortid = require('shortid');
const multer = require('multer');
const User = require('./model/user');
const Invite = require('./model/invite');
const port = process.env.PORT || 3000;
const urlRoutes = require('./routes/url');
const instagramRoutes = require('./routes/instagram');
const asyncHandler = require('./utils/asyncHandler');

const suggestionRoutes = require('./routes/suggestionRoutes');

app.use('/suggestions', protect, suggestionRoutes);
app.use('/api/instagram', protect, instagramRoutes);
app.use('/services/creator-crm', protect, collaborationRoutes);
app.post('/dashboard/accept-invite', protect, preventContributorWrites, acceptInviteFromDashboard);
app.get('/invites/accept/:token', acceptInvite);

const Url = require('./model/url');

// ── CHANGE 1: /url → /api/urls (QR routes bhi yahan se serve honge) ──────────
app.use('/api/urls', urlRoutes);

app.use("/api/analytics", protect, analyticsRoutes);
const settingsRoutes = require('./routes/settings');
app.use('/api/settings', protect, settingsRoutes);

const uploadDir = "/tmp";

const storage = multer.diskStorage({
    destination: function (req, file, cb) { cb(null, "/tmp"); },
    filename: function (req, file, cb) { 
        // 100% foolproof sanitization to prevent any path traversal cross-platform
        let sanitizedFilename = path.basename(file.originalname);
        sanitizedFilename = sanitizedFilename.replace(/[/\\?%*:|"<>]/g, '-').replace(/^\.+/, '');
        cb(null, Date.now() + '-' + sanitizedFilename); 
    }
});
const upload = multer({ 
    storage: storage,
    limits: { fileSize: 50 * 1024 * 1024 } 
});

function buildAccountViewModel(userDoc, fallbackUser) {
    const name = userDoc?.name || fallbackUser?.name || 'Creator';
    const initials = name
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0].toUpperCase())
        .join('') || 'CR';

    const passwordChangedAt = userDoc?.passwordChangedAt || userDoc?.updatedAt || null;
    let passwordAgeDays = null;
    if (passwordChangedAt) {
        passwordAgeDays = Math.max(
            0,
            Math.floor((Date.now() - new Date(passwordChangedAt).getTime()) / (1000 * 60 * 60 * 24))
        );
    }

    const sub = userDoc?.subscription || {};
    const nextInvoice = sub.nextInvoiceDate
        ? new Date(sub.nextInvoiceDate)
        : (() => {
            const d = new Date();
            d.setMonth(d.getMonth() + 1);
            d.setDate(24);
            return d;
        })();

    return {
        id: fallbackUser.id,
        name,
        email: userDoc?.email || fallbackUser?.email || '',
        alias: userDoc?.alias || '',
        bio: userDoc?.bio || '',
        twoFactorEnabled: userDoc?.twoFactorEnabled || false,
        preferences: userDoc?.preferences || {
            appearanceMode: 'light',
            interfaceDensity: 'tactile',
            motionEffects: true,
            soundCues: false,
            autoSaveLinks: true
        },
        passwordAgeDays,
        billing: {
            planName: sub.planName || 'Pro Individual',
            priceMonthly: sub.priceMonthly ?? 29,
            nextInvoiceLabel: nextInvoice.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
            }),
            estimatedTotal: `$${(sub.priceMonthly ?? 29).toFixed(2)} USD`,
            cardBrand: sub.cardBrand || 'VISA',
            cardLast4: sub.cardLast4 || '4242',
            invoices: [
                { date: 'Sep 24, 2023', invoiceId: '#INV-88219', amount: '$29.00', status: 'PAID' },
                { date: 'Aug 24, 2023', invoiceId: '#INV-87112', amount: '$29.00', status: 'PAID' },
            ],
        },
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
            bio: 'Enter an Instagram username and click Analyze to fetch public profile details through the configured public-profile provider.',
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


function isGuestContributor(user) {
    return user?.role === 'guest_contributor';
}

function buildEmptyInviteSummary() {
    return {
        total: 0,
        pending: 0,
        accepted: 0,
        expired: 0,
    };
}

app.get("/dashboard", protect, asyncHandler(async (req, res) => {
    const userDoc = isGuestContributor(req.user)
        ? null
        : await User.findById(req.user.id)
            .select('name email alias bio twoFactorEnabled preferences passwordChangedAt updatedAt subscription')
            .lean();
    
    const inviteSummary = isGuestContributor(req.user)
        ? buildEmptyInviteSummary()
        : await Promise.all([
            Invite.countDocuments({ inviter: req.user.id, status: 'pending' }),
            Invite.countDocuments({ inviter: req.user.id, status: 'accepted' }),
            Invite.countDocuments({ inviter: req.user.id, status: 'expired' })
        ]).then(([pending, accepted, expired]) => ({
            total: pending + accepted + expired,
            pending,
            accepted,
            expired,
        }));

    res.render("dashboard", {
        user: buildAccountViewModel(userDoc, req.user),
        services,
        inviteSummary,
        inviteAcceptMessage: null,
        inviteAcceptError: null,
    });
}));

app.get("/my-links", protect, async (req, res) => {
    const userDoc = isGuestContributor(req.user)
        ? null
        : await User.findById(req.user.id).select('name email').lean();

    const host = req.get('host');
    const domain = host || 'creatoros.link';

    res.render("my-links", {
        user: buildAccountViewModel(userDoc, req.user),
        isGuestContributor: isGuestContributor(req.user),
        domain,
    });
});

app.get("/settings", protect, async (req, res) => {
    const userDoc = isGuestContributor(req.user)
        ? null
        : await User.findById(req.user.id)
            .select('name email alias bio twoFactorEnabled preferences passwordChangedAt updatedAt subscription')
            .lean();

    res.render("settings", {
        user: buildAccountViewModel(userDoc, req.user),
        isGuestContributor: isGuestContributor(req.user),
    });
});

app.get("/profile", protect, async (req, res) => {
    const userDoc = isGuestContributor(req.user)
        ? null
        : await User.findById(req.user.id).select('name email').lean();

    res.render("profile", { user: buildAccountViewModel(userDoc, req.user) });
}));

app.get('/', (req, res) => {
    res.render('services-hub', { services });
});

app.get('/services', (req, res) => {
    res.redirect('/');
});

// Protected service pages
app.get('/services/:serviceKey', protect, asyncHandler(async (req, res) => {
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
        const userDoc = await User.findById(req.user.id)
            .select('name email')
            .lean();

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

}));

const { isValidUrl } = require('./utils/validators');

app.post('/services/url-shortener/shorten', protect, preventContributorWrites, urlShortenerPageLimiter, asyncHandler(async (req, res) => {
    const { redirectUrl } = req.body;
    if (!redirectUrl || !isValidUrl(redirectUrl)) {
        return res.render('home', buildShortenerViewModel(req, null, 'Please enter a valid HTTP or HTTPS URL.'));
    }

    const shortId = shortid();

        await Url.create({
            shortId,
            redirectUrl,
            userId: req.user?.id || null,
            linkedAt: new Date(),
        });

    return res.render('home', buildShortenerViewModel(req, shortId));
}));

app.post('/services/file-upload/upload', protect, preventContributorWrites, uploadLimiter, upload.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ success: false, message: 'No file uploaded', error: 'No file uploaded' });
    }
    return res.json({
        success: true,
        filename: req.file.originalname,
        size: req.file.size,
        mimetype: req.file.mimetype,
        path: req.file.filename,
    });
});
// ── Mock Instagram Graph API Endpoint ──────────────────────────────────────
app.get('/api/instagram/profile', protect, preventContributorWrites, asyncHandler(async (req, res) => {
    const { username } = req.query;
    if (!username) {
        return res.status(400).json({ success: false, error: { message: 'Username is required' } });
    }

    // Generate dynamic mock data based on the requested username
    const followersBase = Math.floor(Math.random() * 500000) + 10000;
    
    // Generate 90 days of mock chart data to support the date range filter
    const labels = [];
    const followers = [];
    const engagement = [];
    
    const now = new Date();
    for (let i = 89; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        labels.push(d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
        
        // Simulating some realistic growth/fluctuations
        const dayFollowers = followersBase - (i * (Math.random() * 500 + 100));
        followers.push(Math.max(0, Math.floor(dayFollowers)));
        
        const dayEngagement = (Math.random() * 4 + 3).toFixed(2); // 3% to 7%
        engagement.push(parseFloat(dayEngagement));
    }

    const posts = ['Reel: Morning Routine', 'Carousel: Setup Tour', 'Photo: NYC', 'Reel: Q&A', 'Photo: BTS'];
    const postPerformance = posts.map(() => Math.floor(Math.random() * 20000) + 1000);

    return res.json({
        success: true,
        data: {
            username: username,
            name: username.charAt(0).toUpperCase() + username.slice(1),
            followers: followers[followers.length - 1],
            following: Math.floor(Math.random() * 1000),
            totalPosts: Math.floor(Math.random() * 1000),
            category: 'Digital creator',
            bio: `Official profile of ${username}. Creating awesome content daily!`,
            fetchedAt: new Date().toISOString(),
            profileImage: `https://ui-avatars.com/api/?name=${encodeURIComponent(username)}&size=200&background=random`,
            charts: {
                labels,
                followers,
                engagement,
                posts,
                postPerformance
            }
        }
    });
}));

// Redirect for generated short URLs
app.get('/u/:shortId', asyncHandler(async (req, res) => {
    const shortId = req.params.shortId;

    const entry = await Url.findOneAndUpdate(
        { shortId },
        {
            $inc:  { totalClicks: 1 },
            $push: { visitHistory: { timestamp: new Date(), source: 'direct' } },
        },
        { new: true }
    );

    if (!entry) {
        if (wantsHtml(req)) {
            return res.status(404).render('error', {
                error: 'The short URL you are looking for does not exist or has been removed.'
            });
        }
        return res.status(404).json({ success: false, message: 'URL not found', error: 'URL not found' });
    }

    return res.redirect(entry.redirectUrl);
}));

const errorHandler = require('./middleware/errorHandler');
app.use(errorHandler);

if (require.main === module) {
    app.listen(port, () => {
        console.log(`Server is running on http://localhost:${port}`);
    });
}

module.exports = app;

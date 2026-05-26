const crypto = require('crypto');

const USERNAME_PATTERN = /^[A-Za-z0-9._]{1,30}$/;
const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);
const DEFAULT_GRAPH_API_VERSION = 'v25.0';

class InstagramProfileError extends Error {
    constructor(code, message, statusCode = 500, details = null) {
        super(message);
        this.name = 'InstagramProfileError';
        this.code = code;
        this.statusCode = statusCode;
        this.details = details;
    }
}

function normalizeUsername(username) {
    return String(username || '')
        .trim()
        .replace(/^@/, '')
        .toLowerCase();
}

function validateUsername(username) {
    const normalizedUsername = normalizeUsername(username);

    if (!normalizedUsername || !USERNAME_PATTERN.test(normalizedUsername)) {
        throw new InstagramProfileError(
            'INVALID_USERNAME',
            'Enter a valid Instagram username using letters, numbers, periods, or underscores.',
            400
        );
    }

    if (normalizedUsername.includes('..')) {
        throw new InstagramProfileError(
            'INVALID_USERNAME',
            'Instagram usernames cannot contain consecutive periods.',
            400
        );
    }

    return normalizedUsername;
}

function getInstagramConfig() {
    const accessToken = process.env.INSTAGRAM_ACCESS_TOKEN;
    const businessAccountId = process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID;

    if (!accessToken || !businessAccountId) {
        throw new InstagramProfileError(
            'MISSING_INSTAGRAM_CONFIG',
            'Instagram API credentials are not configured. Add INSTAGRAM_ACCESS_TOKEN and INSTAGRAM_BUSINESS_ACCOUNT_ID to your environment.',
            500
        );
    }

    return {
        accessToken,
        businessAccountId,
        appSecret: process.env.META_APP_SECRET || process.env.INSTAGRAM_APP_SECRET,
        graphApiVersion: process.env.META_GRAPH_API_VERSION || DEFAULT_GRAPH_API_VERSION,
    };
}

function buildAppSecretProof(accessToken, appSecret) {
    if (!appSecret) {
        return null;
    }

    return crypto
        .createHmac('sha256', appSecret)
        .update(accessToken)
        .digest('hex');
}

function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function requestWithRetry(url, attempts = 3) {
    let lastError = null;

    for (let attempt = 1; attempt <= attempts; attempt += 1) {
        try {
            const response = await fetch(url);
            const payload = await response.json().catch(() => ({}));

            if (response.ok) {
                return payload;
            }

            const apiError = payload.error || {};
            lastError = new InstagramProfileError(
                response.status === 404 ? 'PROFILE_NOT_FOUND' : 'INSTAGRAM_API_ERROR',
                apiError.message || 'Instagram API returned an error while fetching the profile.',
                response.status,
                apiError
            );

            if (!RETRYABLE_STATUSES.has(response.status) || attempt === attempts) {
                throw lastError;
            }
        } catch (error) {
            lastError = error;

            if (error instanceof InstagramProfileError && !RETRYABLE_STATUSES.has(error.statusCode)) {
                throw error;
            }

            if (attempt === attempts) {
                throw error;
            }
        }

        await delay(250 * attempt);
    }

    throw lastError;
}

function normalizeProfile(profile, username) {
    if (!profile || !profile.id) {
        throw new InstagramProfileError(
            'PROFILE_NOT_FOUND',
            'Unable to fetch this Instagram profile. Make sure it is a public Business or Creator account.',
            404
        );
    }

    return {
        username: profile.username || username,
        name: profile.name || profile.username || username,
        profileImage: profile.profile_picture_url || '',
        bio: profile.biography || '',
        category: 'Public creator profile',
        followers: Number(profile.followers_count || 0),
        following: Number(profile.follows_count || 0),
        totalPosts: Number(profile.media_count || 0),
        source: 'instagram_graph_api',
        fetchedAt: new Date().toISOString(),
    };
}

async function fetchInstagramProfile(username) {
    const normalizedUsername = validateUsername(username);
    const config = getInstagramConfig();
    const params = new URLSearchParams({
        fields: `business_discovery.username(${normalizedUsername}){id,username,name,biography,profile_picture_url,followers_count,follows_count,media_count}`,
        access_token: config.accessToken,
    });
    const appSecretProof = buildAppSecretProof(config.accessToken, config.appSecret);

    if (appSecretProof) {
        params.set('appsecret_proof', appSecretProof);
    }

    const url = `https://graph.facebook.com/${config.graphApiVersion}/${config.businessAccountId}?${params.toString()}`;
    const payload = await requestWithRetry(url);

    return normalizeProfile(payload.business_discovery, normalizedUsername);
}

module.exports = {
    InstagramProfileError,
    fetchInstagramProfile,
    validateUsername,
};

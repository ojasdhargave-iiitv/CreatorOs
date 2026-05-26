const User = require("../model/user");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");

const CONTRIBUTOR_EMAIL = "contributor@creatoros.local";
const CONTRIBUTOR_NAME = "Contributor";
const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const GENERIC_LOGIN_ERROR = "Invalid email or password";

function wantsHtml(req) {
    const accept = req.headers.accept || "";
    return accept.includes("text/html");
}

function isGoogleAuthConfigured() {
    return Boolean(
        process.env.GOOGLE_CLIENT_ID &&
        process.env.GOOGLE_CLIENT_SECRET &&
        process.env.GOOGLE_CALLBACK_URL
    );
}

function createToken(userId) {
    return jwt.sign(
        {
            id: userId,
        },
        process.env.JWT_SECRET,
        {
            expiresIn: "7d",
        }
    );
}

function setAuthCookie(res, token) {
    res.cookie("token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: ONE_WEEK_MS,
    });
}

function redirectWithLoginError(res, error) {
    return res.redirect(`/login?error=${encodeURIComponent(error)}`);
}

function renderLoginError(req, res) {
    if (wantsHtml(req)) {
        return res.status(401).render("login", {
            error: GENERIC_LOGIN_ERROR,
            googleAuthConfigured: isGoogleAuthConfigured(),
        });
    }

    return res.status(401).json({ success: false, message: GENERIC_LOGIN_ERROR });
}

const signup = async (req, res, next) => {
    try {
        const { name, email, password } = req.body || {};
        const normalizedEmail = email.toLowerCase().trim();

        const existingUser = await User.findOne({ email: normalizedEmail });

        if (existingUser) {
            if (wantsHtml(req)) {
                return res.status(409).render("signup", { error: "User already exists" });
            }
            return res.status(409).json({ success: false, message: "User already exists" });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const user = await User.create({
            name,
            email: normalizedEmail,
            password: hashedPassword,
            authProvider: "local",
        });

        if (wantsHtml(req)) return res.redirect("/login");
        return res.status(201).json({ success: true, data: { id: user._id, email: user.email } });
    } catch (error) {
        return next(error);
    }
};

const login = async (req, res, next) => {
    try {
        const { email, password } = req.body || {};
        const normalizedEmail = email.toLowerCase().trim();
        const user = await User.findOne({ email: normalizedEmail });

        if (!user || !user.password) {
            return renderLoginError(req, res);
        }

        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            return renderLoginError(req, res);
        }

        user.lastLoginAt = new Date();
        await user.save();

        const token = createToken(user._id);
        setAuthCookie(res, token);

        if (wantsHtml(req)) return res.redirect("/dashboard");
        return res.status(200).json({ success: true, message: "Authenticated" });
    } catch (error) {
        return next(error);
    }
};

const handleGoogleCallback = async (req, res) => {
    try {
        if (!req.user) {
            return redirectWithLoginError(res, "Google sign-in was cancelled or could not be completed.");
        }

        const token = createToken(req.user._id);
        setAuthCookie(res, token);

        return res.redirect("/dashboard?login=google");
    } catch (error) {
        console.error("Google login error:", error);
        return redirectWithLoginError(res, "Google sign-in failed. Please try again.");
    }
};

const loginAsContributor = async (req, res, next) => {
    try {
        let user = await User.findOne({ email: CONTRIBUTOR_EMAIL });

        if (!user) {
            const randomPassword = crypto.randomUUID();
            const hashedPassword = await bcrypt.hash(randomPassword, 10);

            user = await User.create({
                name: CONTRIBUTOR_NAME,
                email: CONTRIBUTOR_EMAIL,
                password: hashedPassword,
                authProvider: "local",
            });
        }

        user.lastLoginAt = new Date();
        await user.save();

        const token = createToken(user._id);
        setAuthCookie(res, token);

        if (wantsHtml(req)) return res.redirect("/dashboard");
        return res.status(200).json({ success: true, message: "Authenticated as contributor" });
    } catch (error) {
        return next(error);
    }
};

module.exports = {
    signup,
    login,
    handleGoogleCallback,
    loginAsContributor,
};

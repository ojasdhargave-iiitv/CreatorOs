const User = require("../model/user");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

const createAuthToken = (user) => {
    return jwt.sign(
        {
            id: user._id,
        },
        process.env.JWT_SECRET,
        {
            expiresIn: "7d",
        }
    );
};

const setAuthCookie = (res, token) => {
    res.cookie("token", token, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: ONE_WEEK_MS,
    });
};

const redirectWithLoginError = (res, error) => {
    return res.redirect(`/login?error=${encodeURIComponent(error)}`);
};

const signup = async (req, res) => {
    try {
        const { name, email, password } = req.body;
        const normalizedEmail = email.toLowerCase().trim();

        const existingUser = await User.findOne({ email: normalizedEmail });

        if (existingUser) {
            return res.status(409).send("User already exists");
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        await User.create({
            name,
            email: normalizedEmail,
            password: hashedPassword,
            authProvider: "local",
        });

        return res.redirect("/login");
    } catch (error) {
        console.error("Signup error:", error);
        return res.status(500).send("Unable to create account. Please try again.");
    }
};

const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        const normalizedEmail = email.toLowerCase().trim();

        const user = await User.findOne({ email: normalizedEmail });

        if (!user || !user.password) {
            return res.status(401).send("Invalid credentials");
        }

        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            return res.status(401).send("Invalid credentials");
        }

        user.lastLoginAt = new Date();
        await user.save();

        const token = createAuthToken(user);
        setAuthCookie(res, token);

        return res.redirect("/dashboard");
    } catch (error) {
        console.error("Login error:", error);
        return res.status(500).send("Unable to log in. Please try again.");
    }
};

const handleGoogleCallback = async (req, res) => {
    try {
        if (!req.user) {
            return redirectWithLoginError(res, "Google sign-in was cancelled or could not be completed.");
        }

        const token = createAuthToken(req.user);
        setAuthCookie(res, token);

        return res.redirect("/dashboard?login=google");
    } catch (error) {
        console.error("Google login error:", error);
        return redirectWithLoginError(res, "Google sign-in failed. Please try again.");
    }
};

module.exports = {
    signup,
    login,
    handleGoogleCallback,
};

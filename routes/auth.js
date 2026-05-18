const express = require("express");
const router = express.Router();

const { signup, login } = require("../controller/auth");

router.post("/signup", signup);

module.exports = router;

router.get("/signup", (req, res) => {
    res.render("signup");
});

router.get("/login", (req, res) => {
    res.render("login");
});

router.post("/login", login);

router.get("/logout", (req, res) => {
    res.clearCookie("token");

    res.redirect("/login");
});
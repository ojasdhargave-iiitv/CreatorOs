const { z } = require('zod');

const signupSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

const loginSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(1, 'Password is required'),
});

function validate(schema) {
  return (req, res, next) => {
    try {
      // parse will throw if invalid
      schema.parse(req.body || {});
      return next();
    } catch (err) {
      const errors = (err.errors || []).map((e) => ({ path: e.path.join('.'), message: e.message }));
      return res.status(400).json({ success: false, message: 'Invalid request data', errors });
    }
  };
}

module.exports = {
  signupValidator: validate(signupSchema),
  loginValidator: validate(loginSchema),
};

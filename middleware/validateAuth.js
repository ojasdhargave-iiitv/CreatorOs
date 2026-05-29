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

function validate(schema, viewName) {
  return (req, res, next) => {
    try {
      // parse will throw if invalid
      schema.parse(req.body || {});
      return next();
    } catch (err) {
      const errors = (err.errors || []).map((e) => ({ path: e.path.join('.'), message: e.message }));
      
      const wantsHtml = req.headers.accept && req.headers.accept.includes('text/html');
      
      if (wantsHtml && viewName) {
        // Use the first validation error as the friendly error message
        const errorMessage = errors.length > 0 ? errors[0].message : 'Invalid request data';
        return res.status(400).render(viewName, { error: errorMessage });
      }

      return res.status(400).json({ success: false, message: 'Invalid request data', errors });
    }
  };
}

module.exports = {
  signupValidator: validate(signupSchema, 'signup'),
  loginValidator: validate(loginSchema, 'login'),
};

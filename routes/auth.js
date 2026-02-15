/**
 * auth.js - Authentication Routes
 * 
 * This module handles all authentication-related functionality including:
 * - User login and logout
 * - Registration success confirmation
 * - Password reset/recovery
 * 
 * Routes:
 * - GET  /auth/login - Display login form
 * - POST /auth/login - Process login
 * - GET  /auth/logout - Log out and destroy session
 * - GET  /auth/registration-success - Show registration confirmation
 * - GET  /auth/forgot-password - Display password reset form
 * - POST /auth/forgot-password - Process password reset request
 */

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');

/**
 * Generate a random temporary password
 * 
 * Creates a 12-character alphanumeric password in uppercase.
 * Used for password reset functionality.
 * 
 * @returns {string} Randomly generated temporary password
 */
function generateTempPassword() {
  return Math.random().toString(36).slice(-12).toUpperCase();
}

/**
 * GET /auth/login
 * Display the login form
 * 
 * @returns Renders login.ejs with empty form
 */
router.get('/login', (req, res) => {
  res.render('login.ejs', { errors: [], data: {}, req: req });
});

/**
 * POST /auth/login
 * Process login form submission
 * 
 * Validates credentials against database:
 * 1. Check username exists
 * 2. Verify password using bcrypt
 * 3. Create session on successful authentication
 * 4. Redirect to home page
 * 
 * @param {string} req.body.username - User's username
 * @param {string} req.body.password - User's password
 * @returns Redirects to / on success, re-renders login form on failure
 */
router.post('/login', (req, res, next) => {
  const { username, password } = req.body;
  
  // Validate input presence
  if (!username || !password) {
    return res.render('login.ejs', { errors: [{ msg: 'Username and password required' }], data: req.body });
  }

  // Query database for user
  global.db.get('SELECT user_id, user_name, password, role FROM users WHERE user_name = ?', [username], function(err, row) {
    if (err) return next(err);
    if (!row) return res.render('login.ejs', { errors: [{ msg: 'Invalid credentials' }], data: req.body, req: req });

    // Verify password
    const match = bcrypt.compareSync(password, row.password || '');
    if (!match) return res.render('login.ejs', { errors: [{ msg: 'Invalid credentials' }], data: req.body, req: req });

    // Create user session
    req.session.user = { id: row.user_id, user_name: row.user_name, role: row.role || 'attendee' };
    res.redirect('/');
  });
});

/**
 * GET /auth/logout
 * Log out the current user
 * 
 * Destroys the user's session and redirects to home page.
 * 
 * @returns Redirects to / after session destruction
 */
router.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/');
  });
});

/**
 * GET /auth/registration-success
 * Display registration confirmation page
 * 
 * Shows confirmation message after successful user registration.
 * User must be logged in to view this page (auto-logged in after registration).
 * 
 * Security: Requires active session
 * 
 * @returns Renders registration-success.ejs or redirects to login if not authenticated
 */
router.get('/registration-success', (req, res) => {
  // Check if user is logged in (security check)
  if (!req.session.user) {
    return res.redirect('/auth/login');
  }
  res.render('registration-success.ejs', { req: req });
});

/**
 * GET /auth/forgot-password
 * Display password reset form
 * 
 * @returns Renders forgot-password.ejs with empty form
 */
router.get('/forgot-password', (req, res) => {
  res.render('forgot-password.ejs', { errors: [], data: {}, req: req });
});

/**
 * POST /auth/forgot-password
 * Process password reset request
 * 
 * Generates a temporary password and updates the user's account.
 * The temporary password is displayed on the success page.
 * 
 * Process:
 * 1. Validate username is provided
 * 2. Check if user exists in database
 * 3. Generate random temporary password
 * 4. Hash and store new password
 * 5. Display temporary password to user
 * 
 * @param {string} req.body.username - Username for password reset
 * @returns Renders password-reset-success.ejs with temporary password on success
 */
router.post('/forgot-password', (req, res, next) => {
  const { username } = req.body;

  // Validate username is provided
  if (!username || username.trim() === '') {
    return res.render('forgot-password.ejs', {
      errors: [{ msg: 'Please enter your username' }],
      data: req.body,
      req: req
    });
  }

  // Check if user exists
  global.db.get('SELECT user_id, user_name FROM users WHERE user_name = ?', [username], function(err, user) {
    if (err) return next(err);

    if (!user) {
      return res.render('forgot-password.ejs', {
        errors: [{ msg: 'Username not found' }],
        data: req.body,
        req: req
      });
    }

    // Generate temporary password
    const tempPassword = generateTempPassword();
    const hashedPassword = bcrypt.hashSync(tempPassword, 10);

    // Update password in database
    global.db.run(
      'UPDATE users SET password = ? WHERE user_id = ?',
      [hashedPassword, user.user_id],
      function(err) {
        if (err) return next(err);

        // Show success page with temporary password
        res.render('password-reset-success.ejs', {
          tempPassword: tempPassword,
          req: req
        });
      }
    );
  });
});

// Export the router
module.exports = router;

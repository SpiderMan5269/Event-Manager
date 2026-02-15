/**
 * profile.js
 * Routes for user profile management:
 * - viewing user profile
 * - changing password
 */

const express = require("express");
const router = express.Router();
const bcrypt = require('bcryptjs');
const { changePasswordSchema } = require('../middleware/joiSchemas');
const { formatJoiErrors } = require('../middleware/joiErrorHandler');
const { ensureAuthenticated } = require('../middleware/auth');

// Protect all profile routes
router.use(ensureAuthenticated);

/**
 * @desc Display user profile page
 * Outputs: Renders user-profile.ejs with user data
 */
router.get('/', (req, res, next) => {
  if (!req.session || !req.session.user || !req.session.user.id) {
    return res.redirect('/auth/login');
  }

  const userId = req.session.user.id;
  const query = "SELECT user_id, user_name FROM users WHERE user_id = ?";

  global.db.get(query, [userId], function(err, user) {
    if (err) return next(err);
    if (!user) return res.status(404).send("User not found");

    res.render('user-profile.ejs', {
      user: user,
      errors: [],
      fieldErrors: {},
      req: req
    });
  });
});

/**
 * @desc Handle password change
 * Inputs: current_password, new_password, confirm_password
 * Outputs: Updates password in database, redirects to profile with success message
 */
router.post('/change-password', (req, res, next) => {
  if (!req.session || !req.session.user || !req.session.user.id) {
    return res.redirect('/auth/login');
  }

  // Validate input
  const { error, value } = changePasswordSchema.validate(req.body, { abortEarly: false });
  if (error) {
    const { errors, fieldErrors } = formatJoiErrors(error);
    const userId = req.session.user.id;
    const userQuery = "SELECT user_id, user_name FROM users WHERE user_id = ?";
    return global.db.get(userQuery, [userId], function(err, user) {
      if (err) return next(err);
      return res.render('user-profile.ejs', {
        user: user,
        errors: errors,
        fieldErrors: fieldErrors,
        req: req
      });
    });
  }

  const userId = req.session.user.id;
  const { current_password, new_password } = value;

  // Get user's current password hash
  const query = "SELECT password FROM users WHERE user_id = ?";
  global.db.get(query, [userId], function(err, user) {
    if (err) return next(err);

    if (!user || !user.password) {
      return res.render('user-profile.ejs', {
        user: { user_id: userId, user_name: req.session.user.user_name },
        errors: [{ msg: 'Unable to verify current password' }],
        fieldErrors: {},
        req: req
      });
    }

    // Verify current password
    const passwordMatch = bcrypt.compareSync(current_password, user.password);
    if (!passwordMatch) {
      return res.render('user-profile.ejs', {
        user: { user_id: userId, user_name: req.session.user.user_name },
        errors: [{ msg: 'Current password is incorrect' }],
        fieldErrors: { current_password: ['Current password is incorrect'] },
        req: req
      });
    }

    // Hash new password and update
    const hashedPassword = bcrypt.hashSync(new_password, 10);
    const updateQuery = "UPDATE users SET password = ? WHERE user_id = ?";

    global.db.run(updateQuery, [hashedPassword, userId], function(err) {
      if (err) return next(err);

      // Re-render profile with success message
      const userQuery = "SELECT user_id, user_name FROM users WHERE user_id = ?";
      global.db.get(userQuery, [userId], function(err, user) {
        if (err) return next(err);
        res.render('user-profile.ejs', {
          user: user,
          successMessage: 'Password updated successfully!',
          errors: [],
          fieldErrors: {},
          req: req
        });
      });
    });
  });
});

module.exports = router;

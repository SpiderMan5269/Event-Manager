/**
 * auth.js - Authentication Middleware
 * 
 * This module provides middleware functions for protecting routes and
 * enforcing authentication and authorization requirements.
 * 
 * Middleware Functions:
 * - ensureAuthenticated: Requires user to be logged in
 * - ensureOrganiser: Requires user to be logged in with organiser role
 */

const bcrypt = require('bcryptjs');

/**
 * ensureAuthenticated
 * Middleware to protect routes requiring authentication
 * 
 * Checks if user has an active session. If not authenticated,
 * redirects to login page.
 * 
 * Usage: Apply to any route that requires a logged-in user
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
function ensureAuthenticated(req, res, next) {
  if (req.session && req.session.user && req.session.user.id) {
    return next();
  }
  res.redirect('/auth/login');
}

/**
 * ensureOrganiser
 * Middleware to protect organiser-only routes
 * 
 * Checks if user is authenticated AND has the 'organiser' role.
 * Non-organisers (including attendees) are shown a 403 access denied page.
 * 
 * Usage: Apply to routes that should only be accessible to organisers
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
function ensureOrganiser(req, res, next) {
  if (req.session && req.session.user && req.session.user.id && req.session.user.role === 'organiser') {
    return next();
  }
  res.status(403);
  return res.render('no-access.ejs', { req });
}

// Export middleware functions
module.exports = { ensureAuthenticated, ensureOrganiser };

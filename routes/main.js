/**
 * main.js - Main Application Routes
 * 
 * This module handles the primary public-facing routes:
 * - Home page with role-aware content
 * - Access denied page for unauthorized access attempts
 * 
 * Routes:
 * - GET / - Home page
 * - GET /no-access - 403 Access Denied page
 */

const express = require("express");
const router = express.Router();

/**
 * GET /
 * Display the home page with role-specific content
 * 
 * The home page adapts based on user authentication status and role:
 * - Guests: See login/register options
 * - Attendees: See links to browse events and bookings
 * - Organisers: See links to manage events, analytics, and settings
 * 
 * @returns Renders index.ejs with dynamic content based on user session
 */
router.get("/", (req, res) => {
  res.render("index.ejs", { title: "Home page", req: req });
});

/**
 * GET /no-access
 * Display access denied page (HTTP 403)
 * 
 * This page is shown when users attempt to access resources they don't
 * have permission for (e.g., attendees trying to access organiser pages).
 * 
 * @returns Renders no-access.ejs with 403 status code
 */
router.get('/no-access', (req, res) => {
  res.status(403).render('no-access.ejs', { req: req });
});

// Export the router
module.exports = router;

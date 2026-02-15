/**
 * users.js - User Registration Routes
 * 
 * This module handles user registration functionality including:
 * - Displaying the registration form
 * - Processing new user registrations
 * - Validating user input (including duplicate username checking)
 * - Password hashing for secure storage
 * - Automatic login after successful registration
 * 
 * Routes:
 * - GET  /users/add-user - Display registration form
 * - POST /users/add-user - Process registration submission
 */

const express = require("express");
const router = express.Router();
const { userSchema } = require('../middleware/joiSchemas');
const { formatJoiErrors } = require('../middleware/joiErrorHandler');
const bcrypt = require('bcryptjs');


/**
 * GET /users/add-user
 * Display the user registration form
 * 
 * @returns Renders add-user.ejs with empty form
 */
router.get("/add-user", (req, res) => {
    res.render("add-user.ejs", { errors: [], data: {}, req: req });
});

/**
 * POST /users/add-user
 * Process user registration form submission
 * 
 * Validation Steps:
 * 1. Validate input using Joi schema (username, password, confirm_password)
 * 2. Check for duplicate username in database
 * 3. Hash password using bcrypt
 * 4. Insert new user into database
 * 5. Auto-login the new user by creating a session
 * 6. Redirect to registration success page
 * 
 * @param {string} req.body.user_name - Desired username
 * @param {string} req.body.password - User password
 * @param {string} req.body.confirm_password - Password confirmation
 * @param {string} req.body.organiser - Optional 'yes' if registering as organiser
 * @returns Redirects to /auth/registration-success on success, re-renders form with errors on failure
 */
router.post("/add-user", (req, res, next) => {
    // Validate input with Joi
    const { error, value } = userSchema.validate(req.body, { abortEarly: false });
    if (error) {
        const { errors, fieldErrors } = formatJoiErrors(error);
        return res.render('add-user.ejs', { errors, fieldErrors, data: req.body, req: req });
    }

    // Check if username already exists
    const checkQuery = "SELECT user_id FROM users WHERE user_name = ?;";
    global.db.get(checkQuery, [value.user_name], function(err, row) {
        if (err) {
            return next(err);
        }
        
        if (row) {
            // Username already exists - display error to user
            const errors = [{ msg: 'Username already exists. Please choose a different username.' }];
            const fieldErrors = { user_name: ['Username already exists. Please choose a different username.'] };
            return res.render('add-user.ejs', { errors, fieldErrors, data: req.body, req: req });
        }

        // Username is available - proceed with registration
        // Hash password before storing in database
        const hashed = bcrypt.hashSync(value.password, 10);
        const role = (value.organiser === 'yes') ? 'organiser' : 'attendee';
        const query = "INSERT INTO users (user_name, password, role) VALUES( ?, ?, ? );"
        const query_parameters = [value.user_name, hashed, role]
        
        // Execute the insertion query
        global.db.run(query, query_parameters, function (err) {
            if (err) {
                next(err);
            } else {
                // Get the newly created user's ID and username
                const newUserId = this.lastID;
                const username = value.user_name;
                
                // Auto-login: Create session for the new user
                req.session.user = {
                    id: newUserId,
                    user_name: username,
                    role: role
                };
                
                // Redirect to registration success page
                res.redirect('/auth/registration-success');
            }
        });
    });
});

// Export the router
module.exports = router;

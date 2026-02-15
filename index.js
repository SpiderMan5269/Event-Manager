/**
 * index.js - Main Application Entry Point
 * 
 * This file initializes and configures the Express.js server for the Event Management System.
 * It sets up middleware, database connections, session management, and route handlers.
 * 
 * Key Responsibilities:
 * - Express server initialization and configuration
 * - SQLite database connection and schema initialization
 * - Database migrations for schema updates
 * - Session management with persistent storage
 * - Route mounting for all application modules
 * 
 * Dependencies:
 * - express: Web application framework
 * - body-parser: Middleware for parsing request bodies
 * - ejs: Template engine for rendering views
 * - express-session: Session middleware
 * - connect-sqlite3: SQLite session store
 * - sqlite3: SQLite database driver
 */

// Set up express, bodyparser and EJS
const express = require('express');
const app = express();
const port = 3000;
var bodyParser = require("body-parser");
app.use(bodyParser.urlencoded({ extended: true }));
app.set('view engine', 'ejs'); // set the app to use ejs for rendering
app.use(express.static(__dirname + '/public')); // set location of static files
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);

// Session setup with SQLite store for persistent sessions across server restarts
// maxAge set to 7 days (in milliseconds) for persistent login with cookies
app.use(
    session({
        store: new SQLiteStore({ db: 'sessions.db' }),
        secret: process.env.SESSION_SECRET || 'dev-session-secret',
        resave: false,
        saveUninitialized: false,
        cookie: { 
            secure: false,
            maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days in milliseconds
        },
    })
);

// Set up SQLite
// Items in the global namespace are accessible throughout the node application
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

/**
 * runMigrations - Applies database schema updates
 * 
 * This function checks the existing database schema and applies necessary
 * column additions to support new features. Migrations are idempotent and
 * safe to run multiple times.
 * 
 * Migrations performed:
 * - Add 'password' column to users table (for authentication)
 * - Add 'role' column to users table (for organiser/attendee differentiation)
 * - Add 'user_id' column to bookings table (to link bookings to registered users)
 */
function runMigrations() {
    // Ensure users table has a password column for authentication
    global.db.all("PRAGMA table_info('users')", function(err, cols) {
        if (!err && cols) {
            const hasPassword = cols.some(c => c.name === 'password');
            if (!hasPassword) {
                try {
                    global.db.run("ALTER TABLE users ADD COLUMN password TEXT", function(aerr) {
                        if (aerr) {
                            console.warn('Could not add password column to users table:', aerr.message);
                        } else {
                            console.log('Migrated users table: added password column');
                        }
                    });
                } catch (e) {
                    console.warn('Migration error (users.password):', e.message);
                }
            }

            const hasRole = cols.some(c => c.name === 'role');
            if (!hasRole) {
                try {
                    global.db.run("ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'attendee'", function(aerr) {
                        if (aerr) {
                            console.warn('Could not add role column to users table:', aerr.message);
                        } else {
                            console.log('Migrated users table: added role column');
                            // Backfill: set first user as organiser, others as attendee by default
                            global.db.run("UPDATE users SET role = 'organiser' WHERE user_id = 1");
                            global.db.run("UPDATE users SET role = COALESCE(role, 'attendee') WHERE role IS NULL");
                        }
                    });
                } catch (e) {
                    console.warn('Migration error (users.role):', e.message);
                }
            }
        }
        // Ensure bookings table has a user_id column to link bookings to registered users
        global.db.all("PRAGMA table_info('bookings')", function(err, cols) {
            if (!err && cols) {
                const hasUserId = cols.some(c => c.name === 'user_id');
                if (!hasUserId) {
                    try {
                        global.db.run("ALTER TABLE bookings ADD COLUMN user_id INTEGER", function(aerr) {
                            if (aerr) {
                                console.warn('Could not add user_id column to bookings table:', aerr.message);
                            } else {
                                console.log('Migrated bookings table: added user_id column');
                            }
                        });
                    } catch (e) {
                        console.warn('Migration error (bookings.user_id):', e.message);
                    }
                }
            }
        });
    });
}

/**
 * Database Initialization
 * 
 * Establishes connection to SQLite database and initializes schema if needed.
 * On first run, loads db_schema.sql to create tables and populate sample data.
 * On subsequent runs, only applies migrations to update existing schema.
 */
global.db = new sqlite3.Database('./database.db',function(err){
    if(err){
        console.error(err);
        process.exit(1); // bail out we can't connect to the DB
    } else {
        console.log("Database connected");
        global.db.run("PRAGMA foreign_keys=ON");
        
        // Load initial schema and sample data on first run
        global.db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='users'", function(schemaErr, row) {
            if (!row) {
                // Tables don't exist, load schema and sample data
                const schemaPath = path.join(__dirname, 'db_schema.sql');
                const schemaSql = fs.readFileSync(schemaPath, 'utf8');
                global.db.exec(schemaSql, function(execErr) {
                    if (execErr) {
                        console.warn('Error loading initial schema:', execErr.message);
                    } else {
                        console.log('Initial schema and sample data loaded successfully');
                        // Run migrations AFTER schema loads
                        runMigrations();
                    }
                });
            } else {
                // Tables already exist, just run migrations
                runMigrations();
            }
        });
    }
});

/**
 * Route Mounting
 * 
 * All route modules are imported and mounted to their respective URL paths.
 * Each route module handles a specific functional area of the application.
 */

// Handle requests to the home page 
const mainRoutes = require('./routes/main');
app.use('/', mainRoutes);

// Organiser routes - event creation and management
const organiserRoutes = require('./routes/organiser');
app.use('/organiser', organiserRoutes);

// Attendee routes - event browsing and booking
const attendeeRoutes = require('./routes/attendee');
app.use('/attendee', attendeeRoutes);

// User registration routes
const usersRoutes = require('./routes/users');
app.use('/users', usersRoutes);

// Authentication routes - login, logout, password reset
const authRoutes = require('./routes/auth');
app.use('/auth', authRoutes);

// User profile routes - profile management and password change
const profileRoutes = require('./routes/profile');
app.use('/profile', profileRoutes);

/**
 * Start the server
 */
app.listen(port, () => {
    console.log(`Example app listening on port http://localhost:${port}`)
})


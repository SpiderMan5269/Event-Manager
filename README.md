# Event Management Web Application

## Overview
This is a full-stack web application for managing events, bookings, and users. It is designed for coursework in CM2040 Database Networks and the Web. The app allows organisers to create and manage events, and attendees to browse, filter, and book tickets. It features user authentication, session management, and a responsive UI.

## Features
- User registration with auto-login, secure password hashing, and role selection (organiser or attendee via checkbox)
- User authentication and session management (with persistent sessions)
- Role-based access: organiser pages hidden/blocked for attendees; organisers unrestricted
- Organiser dashboard: create, edit, publish, delete events, and view last-modified timestamps
- Attendee dashboard: browse, search, and filter events by price and availability
- Ticket booking and cancellation (with automatic ticket quantity updates)
- User profile management and password change
- Site settings (name, description, contact info, email)
- Analytics dashboard for organisers (event stats, revenue, bookings)
- Forgot password and password reset with temporary password
- Sample data and schema auto-initialization on first run

## Installation requirements
* NodeJS 
    - follow the install instructions at https://nodejs.org/en/
    - we recommend using the latest LTS version
* Sqlite3 
    - follow the instructions at https://www.tutorialspoint.com/sqlite/sqlite_installation.htm 
    - Note that the latest versions of the Mac OS and Linux come with SQLite pre-installed

## How to Use
1. **Install dependencies:**
    ```
    npm install
    ```
2. **Build the database:**
    - On Windows:
      ```
      npm run build-db-win
      ```
    - On Mac/Linux:
      ```
      npm run build-db
      ```
3. **Start the server:**
    ```
    npm start
    ```
4. **Access the app:**
    - Open [http://localhost:3000] in your browser.
    - Register via `/users/add-user`; check “Register as organiser” to get organiser access, otherwise you are an attendee.
    - `/organiser` — Organiser dashboard (organiser role only)

## Main Routes
- `/` — Home page
- `/auth/login` — Login
- `/auth/logout` — Logout
- `/auth/registration-success` — Registration success (auto-login)
- `/auth/forgot-password` — Forgot password
- `/organiser` — Organiser dashboard
- `/organiser/settings` — Site settings
- `/organiser/events/:id/edit` — Edit event
- `/organiser/events/:id/view` — View event details
- `/attendee` — Attendee dashboard (event search/filter)
- `/attendee/events/:id` — View event as attendee
- `/attendee/my-bookings` — My bookings
- `/profile` — User profile

## Libraries Used
- express
- ejs
- sqlite3
- express-session
- connect-sqlite3
- bcryptjs
- joi
- body-parser
- date-fns

## Project Structure
- `index.js` — Main server file, database setup, and route mounting
- `db_schema.sql` — Database schema and sample data
- `routes/` — All route handlers (organiser, attendee, users, auth, profile)
- `middleware/` — Validation schemas, authentication middleware
- `views/` — EJS templates for all pages
- `public/` — Static files (CSS)

## Notes
- All attendee routes require login; guests are redirected to `/auth/login`.
- All database tables are created and managed via `db_schema.sql`.
- The app auto-initializes the schema and sample data on first run.
- All sensitive routes are protected by authentication middleware.

---

For further details, see code comments and the schema file.

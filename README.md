# Event Management Web Application

A full-stack web application for managing events, bookings and users, built with Node.js, Express, EJS and SQLite for CM2040 Databases, Networks and the Web (BSc Computer Science, University of London, academic direction by Goldsmiths). Organisers create and manage events; attendees browse, filter and book tickets.

## Features

- User registration with auto-login, **bcrypt password hashing** and role selection (organiser or attendee)
- Authentication with persistent **session management**
- **Role-based access control**: organiser pages are hidden and blocked for attendees
- **Input validation** with Joi on all forms
- Organiser dashboard: create, edit, publish and delete events, with last-modified timestamps
- Attendee dashboard: browse, search and filter events by price and availability
- Ticket booking and cancellation with automatic ticket quantity updates
- Profile management, password change, and forgot-password flow with a temporary password
- Analytics dashboard for organisers (event stats, revenue, bookings)
- Site settings (name, description, contact details)
- Schema and sample data initialise automatically on first run

## Requirements

- [Node.js](https://nodejs.org/) (latest LTS recommended)
- SQLite3 (pre-installed on recent macOS and most Linux distributions)

## Running it

```
npm install
npm run build-db-win   # Windows
npm run build-db       # macOS / Linux
npm start
```

Then open http://localhost:3000. Register via `/users/add-user` and tick "Register as organiser" to get organiser access; otherwise you are an attendee.

## Main routes

| Route | Page |
|---|---|
| `/` | Home |
| `/auth/login`, `/auth/logout` | Log in / out |
| `/auth/forgot-password` | Forgot password |
| `/organiser` | Organiser dashboard |
| `/organiser/settings` | Site settings |
| `/organiser/events/:id/edit` | Edit event |
| `/organiser/events/:id/view` | View event details |
| `/attendee` | Attendee dashboard (search and filter) |
| `/attendee/events/:id` | View event as attendee |
| `/attendee/my-bookings` | My bookings |
| `/profile` | User profile |

## Project structure

- `index.js`: main server file, database setup and route mounting
- `db_schema.sql`: database schema and sample data
- `routes/`: route handlers (organiser, attendee, users, auth, profile)
- `middleware/`: validation schemas and authentication middleware
- `views/`: EJS templates

Libraries: express, ejs, sqlite3, express-session, connect-sqlite3, bcryptjs, joi, body-parser, date-fns.

## About

Built by Akshit Sankhala as coursework for CM2040. Shared here as a portfolio piece; please do not submit it as your own coursework.

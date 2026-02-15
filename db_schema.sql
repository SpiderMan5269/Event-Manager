PRAGMA foreign_keys = ON;

BEGIN TRANSACTION;

-- Users (organisers)
CREATE TABLE IF NOT EXISTS users (
    user_id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_name TEXT NOT NULL
);

-- Optional: email accounts (can be extended later)
CREATE TABLE IF NOT EXISTS email_accounts (
    email_account_id INTEGER PRIMARY KEY AUTOINCREMENT,
    email_address TEXT NOT NULL,
    user_id INTEGER,
    FOREIGN KEY (user_id) REFERENCES users(user_id)
);

-- Site-wide settings (single row table)
CREATE TABLE IF NOT EXISTS site_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    email TEXT,
    contact_info TEXT
);

-- Events created by organisers
CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    organiser_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    event_date TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('draft', 'published')),
    created_at TEXT NOT NULL,
    updated_at TEXT,
    published_at TEXT,
    -- cover_image removed (no longer used),
    FOREIGN KEY (organiser_id) REFERENCES users(user_id)
);

-- Ticket types per event
CREATE TABLE IF NOT EXISTS tickets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id INTEGER NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('full', 'concession')),
    price REAL NOT NULL,
    total_quantity INTEGER NOT NULL,
    remaining_quantity INTEGER NOT NULL,
    FOREIGN KEY (event_id) REFERENCES events(id)
);

-- Bookings made by attendees
CREATE TABLE IF NOT EXISTS bookings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id INTEGER NOT NULL,
    attendee_name TEXT NOT NULL,
    full_tickets INTEGER NOT NULL,
    concession_tickets INTEGER NOT NULL,
    booked_at TEXT NOT NULL,
    FOREIGN KEY (event_id) REFERENCES events(id)
);

-- Default site settings
INSERT INTO site_settings (name, description, email, contact_info)
VALUES (
    'EventHub Platform',
    'Discover amazing events, manage bookings, and create unforgettable experiences.',
    'support@eventhub.com',
    'Phone: +44 12 3456 7890 | Address: London, UK'
);

-- Sample organisers (users)
INSERT INTO users (user_name) VALUES ('Simon Star');
INSERT INTO users (user_name) VALUES ('Dianne Dean');
INSERT INTO users (user_name) VALUES ('Harry Hilbert');

-- Sample published events by Simon Star
INSERT INTO events (
    organiser_id,
    title,
    description,
    event_date,
    status,
    created_at,
    published_at
) VALUES (
    1,
    'London Tech Conference 2025 (Sample Event)',
    'Join industry leaders and innovators for a day of inspiring talks, networking, and hands-on workshops. Topics include AI, blockchain, and web development.',
    '2025-02-15 09:00:00',
    'published',
    '2024-11-01 10:00:00',
    '2024-11-05 10:00:00'
);

INSERT INTO events (
    organiser_id,
    title,
    description,
    event_date,
    status,
    created_at,
    published_at
) VALUES (
    1,
    'Jazz Night at the Venue (Sample Event)',
    'Experience smooth jazz performances by local and international artists. Perfect for an evening out with friends. Food and drinks available at the bar.',
    '2025-03-01 19:00:00',
    'published',
    '2024-10-15 10:00:00',
    '2024-10-20 10:00:00'
);

-- Sample events by Dianne Dean
INSERT INTO events (
    organiser_id,
    title,
    description,
    event_date,
    status,
    created_at,
    published_at
) VALUES (
    2,
    'Community Art Exhibition (Sample Event)',
    'Celebrate local talent with our annual art exhibition. Browse paintings, sculptures, and digital art. All pieces available for purchase. Opening reception with free wine and cheese.',
    '2025-02-28 10:00:00',
    'published',
    '2024-09-01 10:00:00',
    '2024-09-10 10:00:00'
);

INSERT INTO events (
    organiser_id,
    title,
    description,
    event_date,
    status,
    created_at,
    published_at
) VALUES (
    2,
    'Beginner Yoga Retreat (Sample Event)',
    'Relax and rejuvenate with our weekend yoga retreat. Suitable for all levels, including complete beginners. Includes meals, accommodation, and expert instruction.',
    '2025-04-12 08:00:00',
    'published',
    '2024-12-01 10:00:00',
    '2024-12-05 10:00:00'
);

-- Sample draft event by Harry Hilbert
INSERT INTO events (
    organiser_id,
    title,
    description,
    event_date,
    status,
    created_at,
    published_at
) VALUES (
    3,
    'Summer Music Festival (Coming Soon)',
    'Three days of live music, food trucks, and entertainment. Early bird tickets now available.',
    '2025-07-15 14:00:00',
    'draft',
    '2024-12-10 10:00:00',
    NULL
);

-- Tickets for London Tech Conference
INSERT INTO tickets (event_id, type, price, total_quantity, remaining_quantity)
VALUES (1, 'full', 49.99, 200, 142);

INSERT INTO tickets (event_id, type, price, total_quantity, remaining_quantity)
VALUES (1, 'concession', 24.99, 100, 87);

-- Tickets for Jazz Night
INSERT INTO tickets (event_id, type, price, total_quantity, remaining_quantity)
VALUES (2, 'full', 35.00, 150, 95);

INSERT INTO tickets (event_id, type, price, total_quantity, remaining_quantity)
VALUES (2, 'concession', 20.00, 75, 62);

-- Tickets for Art Exhibition
INSERT INTO tickets (event_id, type, price, total_quantity, remaining_quantity)
VALUES (3, 'full', 15.00, 300, 245);

INSERT INTO tickets (event_id, type, price, total_quantity, remaining_quantity)
VALUES (3, 'concession', 8.00, 150, 128);

-- Tickets for Yoga Retreat
INSERT INTO tickets (event_id, type, price, total_quantity, remaining_quantity)
VALUES (4, 'full', 299.00, 50, 18);

INSERT INTO tickets (event_id, type, price, total_quantity, remaining_quantity)
VALUES (4, 'concession', 199.00, 25, 12);

-- Sample bookings to show the system in action
INSERT INTO bookings (event_id, attendee_name, full_tickets, concession_tickets, booked_at)
VALUES (1, 'Alice Johnson', 2, 1, '2024-12-18 14:30:00');

INSERT INTO bookings (event_id, attendee_name, full_tickets, concession_tickets, booked_at)
VALUES (1, 'Bob Smith', 1, 0, '2024-12-17 09:15:00');

INSERT INTO bookings (event_id, attendee_name, full_tickets, concession_tickets, booked_at)
VALUES (2, 'Charlie Davis', 4, 2, '2024-12-16 16:45:00');

INSERT INTO bookings (event_id, attendee_name, full_tickets, concession_tickets, booked_at)
VALUES (3, 'Emma Wilson', 3, 0, '2024-12-15 11:20:00');

INSERT INTO bookings (event_id, attendee_name, full_tickets, concession_tickets, booked_at)
VALUES (4, 'Frank Miller', 1, 1, '2024-12-14 13:50:00');

-- Sample email accounts
INSERT INTO email_accounts (email_address, user_id)
VALUES ('simon.star@mail.com', 1);

INSERT INTO email_accounts (email_address, user_id)
VALUES ('dianne.dean@mail.com', 2);

INSERT INTO email_accounts (email_address, user_id)
VALUES ('harry.hilbert@mail.com', 3);

COMMIT;

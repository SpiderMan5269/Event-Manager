/**
 * attendee.js
 * Routes related to attendee functionality:
 * - viewing published events
 * - viewing event details
 * - booking tickets
 */

const express = require("express");
const router = express.Router();
const { bookingSchema } = require('../middleware/joiSchemas');
const { formatJoiErrors } = require('../middleware/joiErrorHandler');
const { ensureAuthenticated } = require('../middleware/auth');

// Protect all attendee routes
router.use(ensureAuthenticated);

/**
 * @desc Display the attendee home page with search/filter options
 * Query params: 
 *   - search: search term for event title/description
 *   - minPrice: minimum ticket price
 *   - maxPrice: maximum ticket price
 *   - availability: 'available' or 'soldout'
 */
router.get("/", (req, res, next) => {
  const siteQuery = "SELECT * FROM site_settings LIMIT 1";
  const searchTerm = req.query.search ? `%${req.query.search}%` : null;
  const minPrice = req.query.minPrice ? parseFloat(req.query.minPrice) : null;
  const maxPrice = req.query.maxPrice ? parseFloat(req.query.maxPrice) : null;
  const availability = req.query.availability || null;
  
  let eventQuery = `SELECT DISTINCT e.id, e.title, e.description, e.event_date, e.status 
                   FROM events e 
                   LEFT JOIN tickets t ON e.id = t.event_id
                   WHERE e.status = 'published'`;
  let eventParams = [];
  
  // Add search filter if provided
  if (searchTerm) {
    eventQuery += " AND (e.title LIKE ? OR e.description LIKE ?)";
    eventParams = [searchTerm, searchTerm];
  }
  
  // Add price filter if provided
  if (minPrice !== null) {
    eventQuery += " AND t.price >= ?";
    eventParams.push(minPrice);
  }
  if (maxPrice !== null) {
    eventQuery += " AND t.price <= ?";
    eventParams.push(maxPrice);
  }
  
  eventQuery += " ORDER BY e.event_date ASC";
  
  const ticketsQuery = "SELECT event_id, SUM(remaining_quantity) as total_remaining FROM tickets GROUP BY event_id";

  global.db.get(siteQuery, function (err, site) {
    if (err) {
      next(err);
    } else {
      global.db.all(eventQuery, eventParams, function (err, events) {
        if (err) {
          next(err);
        } else {
          global.db.all(ticketsQuery, function (err, tickets) {
            if (err) {
              next(err);
            } else {
              // Create a map of event_id -> total_remaining for quick lookup
              const ticketMap = {};
              (tickets || []).forEach(t => {
                ticketMap[t.event_id] = t.total_remaining;
              });

              // Add sold-out flag to each event and apply availability filter
              events = (events || []).map(event => ({
                ...event,
                isSoldOut: ticketMap[event.id] === 0 || ticketMap[event.id] === null
              })).filter(event => {
                if (availability === 'available') {
                  return !event.isSoldOut;
                } else if (availability === 'soldout') {
                  return event.isSoldOut;
                }
                return true; // No filter
              });

              res.render("attendee-home", {
                site: site,
                events: events,
                searchTerm: req.query.search || '',
                minPrice: req.query.minPrice || '',
                maxPrice: req.query.maxPrice || '',
                availability: req.query.availability || '',
                req: req,
              });
            }
          });
        }
      });
    }
  });
});

/**
 * @desc Display a single event for attendees
 */
router.get("/events/:id", (req, res, next) => {
  const eventId = req.params.id;

  const eventQuery =
    "SELECT * FROM events WHERE id = ? AND status = 'published'";

  const ticketsQuery = "SELECT * FROM tickets WHERE event_id = ?";

  global.db.get(eventQuery, [eventId], function (err, event) {
    if (err) {
      next(err);
    } else if (!event) {
      // Event not found or not published
      res.status(404).send("Event not found");
    } else {
      global.db.all(ticketsQuery, [eventId], function (err, tickets) {
        if (err) {
          next(err);
        } else {
          res.render("attendee-event", {
            event: event,
            tickets: tickets,
            req: req,
          });
        }
      });
    }
  });
});

/**
 * @desc Book tickets for an event
 */
router.post("/events/:id/register", (req, res, next) => {
  const eventId = req.params.id;
  const { error, value } = bookingSchema.validate(req.body, { abortEarly: false, convert: true });
  
  if (error) {
    const { errors, fieldErrors } = formatJoiErrors(error);
    const eventQuery = "SELECT * FROM events WHERE id = ? AND status = 'published'";
    const ticketsQuery = "SELECT * FROM tickets WHERE event_id = ?";

    return global.db.get(eventQuery, [eventId], function (err, event) {
      if (err) return next(err);
      if (!event) return res.status(404).send('Event not found');
      global.db.all(ticketsQuery, [eventId], function (err, tickets) {
        if (err) return next(err);
        return res.render('attendee-event', { event, tickets, errors, fieldErrors, data: req.body, req: req });
      });
    });
  }

  const attendeeName = value.attendee_name;
  const fullTicketsRequested = parseInt(value.full_tickets, 10) || 0;
  const concessionTicketsRequested = parseInt(value.concession_tickets, 10) || 0;

  // Ensure the attendee selects at least one ticket
  if (fullTicketsRequested === 0 && concessionTicketsRequested === 0) {
    const eventQuery = "SELECT * FROM events WHERE id = ? AND status = 'published'";
    const ticketsQuery = "SELECT * FROM tickets WHERE event_id = ?";
    const errors = [{ msg: 'Please select at least one ticket to continue' }];
    const fieldErrors = { full_tickets: ['Select at least one ticket'], concession_tickets: ['Select at least one ticket'] };

    return global.db.get(eventQuery, [eventId], function (err, event) {
      if (err) return next(err);
      if (!event) return res.status(404).send('Event not found');
      global.db.all(ticketsQuery, [eventId], function (err, tickets) {
        if (err) return next(err);
        return res.render('attendee-event', { event, tickets, errors, fieldErrors, data: req.body, req: req });
      });
    });
  }

  const fullTicketQuery = "SELECT remaining_quantity FROM tickets WHERE event_id = ? AND type = 'full'";
  const concessionTicketQuery = "SELECT remaining_quantity FROM tickets WHERE event_id = ? AND type = 'concession'";

  // Check availability
  global.db.get(fullTicketQuery, [eventId], function (err, fullRow) {
    if (err) return next(err);

    if (fullTicketsRequested > 0 && (!fullRow || fullRow.remaining_quantity < fullTicketsRequested)) {
      const errors = [{ msg: 'Not enough full tickets available' }];
      const fieldErrors = { full_tickets: ['Not enough full tickets available'] };
      const eventQuery = "SELECT * FROM events WHERE id = ? AND status = 'published'";
      const ticketsQuery = "SELECT * FROM tickets WHERE event_id = ?";
      return global.db.get(eventQuery, [eventId], function (err, event) {
        if (err) return next(err);
        if (!event) return res.status(404).send('Event not found');
        global.db.all(ticketsQuery, [eventId], function (err, tickets) {
          if (err) return next(err);
          return res.render('attendee-event', { event, tickets, errors, fieldErrors, data: req.body, req: req });
        });
      });
    }

    global.db.get(concessionTicketQuery, [eventId], function (err, concRow) {
      if (err) return next(err);

      if (concessionTicketsRequested > 0 && (!concRow || concRow.remaining_quantity < concessionTicketsRequested)) {
        const errors = [{ msg: 'Not enough concession tickets available' }];
        const fieldErrors = { concession_tickets: ['Not enough concession tickets available'] };
        const eventQuery = "SELECT * FROM events WHERE id = ? AND status = 'published'";
        const ticketsQuery = "SELECT * FROM tickets WHERE event_id = ?";
        return global.db.get(eventQuery, [eventId], function (err, event) {
          if (err) return next(err);
          if (!event) return res.status(404).send('Event not found');
          global.db.all(ticketsQuery, [eventId], function (err, tickets) {
            if (err) return next(err);
            return res.render('attendee-event', { event, tickets, errors, fieldErrors, data: req.body, req: req });
          });
        });
      }

      // Both checks passed - proceed with booking
      let insertBookingQuery = "INSERT INTO bookings (event_id, attendee_name, full_tickets, concession_tickets, booked_at) Values (?, ?, ?, ?, CURRENT_TIMESTAMP)";
      const bookingParamsBase = [eventId, attendeeName, fullTicketsRequested, concessionTicketsRequested];

      if (req.session && req.session.user && req.session.user.id) {
        insertBookingQuery = "INSERT INTO bookings (event_id, attendee_name, full_tickets, concession_tickets, booked_at, user_id) Values (?, ?, ?, ?, CURRENT_TIMESTAMP, ?)";
      }

      global.db.run("BEGIN TRANSACTION", function (err) {
        if (err) return next(err);

        global.db.run(
          insertBookingQuery,
          (req.session && req.session.user && req.session.user.id) ? bookingParamsBase.concat(req.session.user.id) : bookingParamsBase,
          function (err) {
            if (err) {
              return global.db.run("ROLLBACK", () => next(err));
            }

            const updateFullQuery = "UPDATE tickets SET remaining_quantity = remaining_quantity - ? WHERE event_id = ? AND type = 'full'";
            const updateConcessionQuery = "UPDATE tickets SET remaining_quantity = remaining_quantity - ? WHERE event_id = ? AND type = 'concession'";

            global.db.run(updateFullQuery, [fullTicketsRequested, eventId], function (err) {
              if (err) {
                return global.db.run("ROLLBACK", () => next(err));
              }

              global.db.run(updateConcessionQuery, [concessionTicketsRequested, eventId], function (err) {
                if (err) {
                  return global.db.run("ROLLBACK", () => next(err));
                }

                global.db.run("COMMIT", function (err) {
                  if (err) {
                    return global.db.run("ROLLBACK", () => next(err));
                  }

                  // Get the booking details for confirmation page
                  const lastBookingQuery = "SELECT b.id, b.attendee_name, b.full_tickets, b.concession_tickets, b.booked_at, e.id as event_id, e.title, e.event_date FROM bookings b JOIN events e ON b.event_id = e.id ORDER BY b.id DESC LIMIT 1";
                  global.db.get(lastBookingQuery, function(err, booking) {
                    if (err) return next(err);
                    const eventQuery = "SELECT * FROM events WHERE id = ?";
                    global.db.get(eventQuery, [eventId], function(err, event) {
                      if (err) return next(err);
                      res.render('booking-confirmation.ejs', { event: event, booking: booking, req: req });
                    });
                  });
                });
              });
            });
          }
        );
      });
    });
  });
});

/**
 * @desc Show all bookings made by the authenticated user
 */
router.get('/my-bookings', (req, res, next) => {
  if (!req.session || !req.session.user || !req.session.user.id) {
    return res.redirect('/auth/login');
  }

  const userId = req.session.user.id;
  const query = `SELECT b.id, b.attendee_name, b.full_tickets, b.concession_tickets, b.booked_at, e.id as event_id, e.title, e.event_date
    FROM bookings b
    JOIN events e ON b.event_id = e.id
    WHERE b.user_id = ? ORDER BY b.booked_at DESC`;

  global.db.all(query, [userId], function(err, rows) {
    if (err) return next(err);
    
    // Check if this is a redirect after cancellation
    const successMessage = req.query.cancelled ? 'Booking cancelled successfully! Tickets have been restored.' : null;
    
    res.render('attendee-bookings.ejs', { bookings: rows, successMessage: successMessage, req: req });
  });
});

/**
 * @desc Cancel a booking and restore ticket quantities
 * Inputs: bookingId (from URL), user_id (from session)
 * Outputs: Redirects to /attendee/my-bookings with success message
 */
router.post('/bookings/:bookingId/cancel', (req, res, next) => {
  if (!req.session || !req.session.user || !req.session.user.id) {
    return res.redirect('/auth/login');
  }

  const bookingId = req.params.bookingId;
  const userId = req.session.user.id;

  // First, get the booking details to restore tickets
  const getBookingQuery = "SELECT event_id, full_tickets, concession_tickets FROM bookings WHERE id = ? AND user_id = ?";
  
  global.db.get(getBookingQuery, [bookingId, userId], function(err, booking) {
    if (err) return next(err);
    
    if (!booking) {
      return res.status(404).send("Booking not found or you do not have permission to cancel it");
    }

    // Start transaction to restore tickets and delete booking
    global.db.run("BEGIN TRANSACTION", function(err) {
      if (err) return next(err);

      // Delete the booking
      const deleteBookingQuery = "DELETE FROM bookings WHERE id = ?";
      global.db.run(deleteBookingQuery, [bookingId], function(err) {
        if (err) {
          return global.db.run("ROLLBACK", () => next(err));
        }

        // Restore full price tickets
        const restoreFullQuery = "UPDATE tickets SET remaining_quantity = remaining_quantity + ? WHERE event_id = ? AND type = 'full'";
        global.db.run(restoreFullQuery, [booking.full_tickets, booking.event_id], function(err) {
          if (err) {
            return global.db.run("ROLLBACK", () => next(err));
          }

          // Restore concession tickets
          const restoreConcessionQuery = "UPDATE tickets SET remaining_quantity = remaining_quantity + ? WHERE event_id = ? AND type = 'concession'";
          global.db.run(restoreConcessionQuery, [booking.concession_tickets, booking.event_id], function(err) {
            if (err) {
              return global.db.run("ROLLBACK", () => next(err));
            }

            // Commit transaction
            global.db.run("COMMIT", function(err) {
              if (err) {
                return global.db.run("ROLLBACK", () => next(err));
              }

              // Redirect back to bookings with success message
              res.redirect('/attendee/my-bookings?cancelled=true');
            });
          });
        });
      });
    });
  });
});

module.exports = router;

/**
 * organiser.js
 * Routes related to organiser functionality:
 * - viewing organiser home
 * - creating, editing, publishing, deleting events
 * - updating site settings
 */

const express = require("express");
const router = express.Router();
const { parseISO, format, isValid } = require('date-fns');
const { settingsSchema, eventSchema } = require('../middleware/joiSchemas');
const { formatJoiErrors } = require('../middleware/joiErrorHandler');
const { ensureAuthenticated, ensureOrganiser } = require('../middleware/auth');
const fs = require('fs');

// Format timestamps for display; fall back to raw value if parsing fails
function formatDisplayDate(raw) {
  if (!raw) return 'Not modified yet';
  try {
    const parsed = parseISO(raw);
    if (isValid(parsed)) return format(parsed, 'd MMM yyyy HH:mm');
  } catch (e) {
    // ignore parse errors, fall back to raw
  }
  return raw;
}

// Protect all organiser routes and ensure organiser role
router.use(ensureAuthenticated, ensureOrganiser);

/**
 * @desc Display the organiser home page
 */
router.get("/", (req, res, next) => {
  const siteQuery = "SELECT * FROM site_settings LIMIT 1";
  const draftEventsQuery = "SELECT * FROM events WHERE status = 'draft'";
  const publishedEventsQuery =
    "SELECT * FROM events WHERE status = 'published'";

  global.db.get(siteQuery, function (err, site) {
    if (err) {
      next(err);
    } else {
      global.db.all(draftEventsQuery, function (err, drafts) {
        if (err) {
          next(err);
        } else {
          global.db.all(publishedEventsQuery, function (err, published) {
            if (err) {
              next(err);
            } else {
              const mapWithModified = (events = []) => events.map(ev => ({
                ...ev,
                lastModifiedDisplay: formatDisplayDate(ev.updated_at || ev.created_at)
              }));

              res.render("organiser-home", {
                site: site,
                draftEvents: mapWithModified(drafts),
                publishedEvents: mapWithModified(published),
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
 * @desc Display analytics dashboard with event performance metrics
 * Outputs: Renders organiser-analytics.ejs with stats and event data
 */
router.get("/analytics", (req, res, next) => {
  // Get all events for this organiser
  const eventsQuery = "SELECT id, title, description, event_date, status FROM events WHERE organiser_id = ? ORDER BY event_date DESC";
  
  const organiserId = (req.session && req.session.user && req.session.user.id) ? req.session.user.id : 1;

  global.db.all(eventsQuery, [organiserId], function(err, events) {
    if (err) return next(err);

    if (!events || events.length === 0) {
      return res.render('organiser-analytics.ejs', {
        stats: {
          totalEvents: 0,
          publishedEvents: 0,
          totalBookings: 0,
          totalRevenue: 0
        },
        events: [],
        req: req
      });
    }

    // For each event, get detailed stats
    let stats = {
      totalEvents: events.length,
      publishedEvents: events.filter(e => e.status === 'published').length,
      totalBookings: 0,
      totalRevenue: 0
    };

    let eventStats = [];
    let processed = 0;

    events.forEach((event, index) => {
      const ticketsQuery = "SELECT type, price, total_quantity, remaining_quantity FROM tickets WHERE event_id = ?";
      const bookingsQuery = "SELECT full_tickets, concession_tickets FROM bookings WHERE event_id = ?";

      global.db.all(ticketsQuery, [event.id], function(err, tickets) {
        if (err) return next(err);

        // Calculate ticket capacity and revenue
        let totalCapacity = 0;
        let fullPrice = 0;
        let concessionPrice = 0;

        tickets.forEach(t => {
          totalCapacity += t.total_quantity;
          if (t.type === 'full') fullPrice = t.price;
          if (t.type === 'concession') concessionPrice = t.price;
        });

        global.db.all(bookingsQuery, [event.id], function(err, bookings) {
          if (err) return next(err);

          let totalBookings = 0;
          let ticketsSold = 0;
          let fullTicketsSold = 0;
          let concessionTicketsSold = 0;
          let revenue = 0;

          bookings.forEach(b => {
            totalBookings++;
            fullTicketsSold += b.full_tickets || 0;
            concessionTicketsSold += b.concession_tickets || 0;
            ticketsSold += (b.full_tickets || 0) + (b.concession_tickets || 0);
            revenue += (b.full_tickets || 0) * fullPrice + (b.concession_tickets || 0) * concessionPrice;
          });

          eventStats.push({
            id: event.id,
            title: event.title,
            event_date: event.event_date,
            status: event.status,
            total_capacity: totalCapacity,
            tickets_sold: ticketsSold,
            total_bookings: totalBookings,
            full_tickets_sold: fullTicketsSold,
            concession_tickets_sold: concessionTicketsSold,
            revenue: revenue
          });

          stats.totalBookings += totalBookings;
          stats.totalRevenue += revenue;

          processed++;

          // When all events processed, render the page
          if (processed === events.length) {
            res.render('organiser-analytics.ejs', {
              stats: stats,
              events: eventStats,
              req: req
            });
          }
        });
      });
    });
  });
});

router.get("/settings", (req, res, next) => {
  const query = "SELECT * FROM site_settings LIMIT 1";

  global.db.get(query, function (err, settings) {
    if (err) {
      next(err);
    } else {
      res.render("organiser-settings", { settings, req: req });
    }
  });
});

router.post("/settings", (req, res, next) => {
  const { error, value } = settingsSchema.validate(req.body, { abortEarly: false });
  if (error) {
    const { errors, fieldErrors } = formatJoiErrors(error);
    return res.render('organiser-settings', { settings: req.body, errors, fieldErrors, req: req });
  }

  const settingsQuery =
    "UPDATE site_settings SET name = ?, description = ?, email = ?, contact_info = ? WHERE id = 1";

  global.db.run(
    settingsQuery,
    [value.name, value.description, value.email || null, value.contact_info || null],
    function (err) {
      if (err) {
        next(err);
      } else {
        res.redirect("/organiser");
      }
    }
  );
});

/**
 * @desc Create a new draft event
 */
router.post("/events/create", (req, res, next) => {
  const insertEventCreate =
    "INSERT INTO events (organiser_id, title, description, event_date, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)";
  const organiserId = (req.session && req.session.user && req.session.user.id) ? req.session.user.id : 1;

  // Use today's date as default for new draft events (yyyy-MM-dd)
  const today = format(new Date(), 'yyyy-MM-dd');

  global.db.run(
    insertEventCreate,
    [organiserId, "Untitled Event", "TBC", today, "draft"],
    function (err) {
      if (err) {
        next(err);
      } else {
        const eventId = this.lastID;
        const insertFullTicket =
          "INSERT INTO tickets (event_id, type, price, total_quantity, remaining_quantity) VALUES (?, ?, ?, ?, ?)";

        global.db.run(insertFullTicket, [eventId, "full", 0, 0, 0]);
        global.db.run(insertFullTicket, [eventId, "concession", 0, 0, 0]);

        res.redirect(`/organiser/events/${eventId}/edit`);
      }
    }
  );
});

/**
 * @desc Display edit page for a specific event
 */
router.get("/events/:id/edit", (req, res, next) => {
  const eventId = req.params.id;

  const eventQuery = "SELECT * FROM events WHERE id = ?";
  const ticketQuery = "SELECT * FROM tickets WHERE event_id = ?";

  global.db.get(eventQuery, [eventId], function (err, event) {
    if (err) {
      next(err);
    } else if (!event) {
      return res.status(404).send("Event not found");
    } else {
      global.db.all(ticketQuery, [eventId], function (err, tickets) {
        if (err) {
          next(err);
        } else {
          // Normalize event_date for the date input (yyyy-MM-dd) if possible
          try {
            let displayDate = event.event_date;
            const parsed = parseISO(event.event_date);
            if (isValid(parsed)) {
              displayDate = format(parsed, 'yyyy-MM-dd');
            }
            event.event_date = displayDate;
          } catch (e) {
            // leave event.event_date as-is
          }

          event.lastModifiedDisplay = formatDisplayDate(event.updated_at || event.created_at);

          res.render("organiser-edit-events", {
            event: event,
            tickets: tickets,
            errors: [],
            req: req,
          });
        }
      });
    }
  });
});

/**
 * @desc Save changes to an event
 */
router.post("/events/:id/edit", (req, res, next) => {
    const eventId = req.params.id;
    const {
      title,
      description,
      event_date,
      full_price,
      full_quantity,
      concession_price,
      concession_quantity,
    } = req.body;
    const { error, value } = eventSchema.validate(req.body, { abortEarly: false });
    if (error) {
      const { errors, fieldErrors } = formatJoiErrors(error);
      return global.db.get(
        "SELECT * FROM events WHERE id = ?",
        [req.params.id],
        (err, event) => {
          if (err) return next(err);
          global.db.all(
            "SELECT * FROM tickets WHERE event_id = ?",
            [eventId],
            (err, tickets) => {
              if (err) return next(err);

              res.render("organiser-edit-events", {
                event,
                tickets,
                errors,
                fieldErrors,
                data: req.body,
                req: req,
              });
            }
          );
        }
      );
    }

    const updateEventQuery =
      "UPDATE events SET title = ?, description = ?, event_date = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?";

    let normalizedDate = value.event_date || event_date;
    // Try parse as ISO first, then fallback to Date constructor
    let parsed = parseISO(normalizedDate);
    if (!isValid(parsed)) {
      parsed = new Date(normalizedDate);
    }
    if (isValid(parsed)) {
      normalizedDate = format(parsed, 'yyyy-MM-dd');
    } else {
      // keep provided value; Joi should have flagged invalid dates
      normalizedDate = value.event_date || event_date;
    }

    global.db.run(
      updateEventQuery,
      [value.title, value.description, normalizedDate, eventId],
      function (err) {
        if (err) {
          next(err);
        } else {
          const updateFullTicketQuery =
            "UPDATE tickets SET price = ?, total_quantity = ?, remaining_quantity = ? WHERE event_id = ? AND type = 'full'";

          global.db.run(
            updateFullTicketQuery,
            [full_price, full_quantity, full_quantity, eventId],
            function (err) {
              if (err) {
                return next(err);
              }

              const updateConcessionTicketQuery =
                "UPDATE tickets SET price = ?, total_quantity = ?, remaining_quantity = ? WHERE event_id = ? AND type = 'concession'";

              global.db.run(
                updateConcessionTicketQuery,
                [
                  concession_price,
                  concession_quantity,
                  concession_quantity,
                  eventId,
                ],
                function (err) {
                  if (err) {
                    return next(err);
                  }

                  res.redirect("/organiser");
                }
              );
            }
          );
        }
      }
    );
});
router.post("/events/:id/publish", (req, res, next) => {
  const eventId = req.params.id;

  const ticketsSumQuery = "SELECT SUM(total_quantity) AS total, SUM(remaining_quantity) AS remaining FROM tickets WHERE event_id = ?";
  global.db.get(ticketsSumQuery, [eventId], function(err, sums) {
    if (err) return next(err);
    const total = (sums && sums.total) ? sums.total : 0;
    const remaining = (sums && sums.remaining) ? sums.remaining : 0;
    if (total <= 0) {
      // Load event and tickets and show an error on the edit page
      const eventQuery = "SELECT * FROM events WHERE id = ?";
      const ticketQuery = "SELECT * FROM tickets WHERE event_id = ?";
      return global.db.get(eventQuery, [eventId], function(err, event) {
        if (err) return next(err);
        global.db.all(ticketQuery, [eventId], function(err, tickets) {
          if (err) return next(err);
          const errors = [{ msg: 'Cannot publish an event with zero tickets. Add at least one full or concession ticket before publishing.' }];
          return res.render('organiser-edit-events', { event, tickets, errors, fieldErrors: {}, data: {}, req: req });
        });
      });
    }

    const publishQuery = "UPDATE events SET status = 'published', published_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?";
    global.db.run(publishQuery, [eventId], function (err) {
      if (err) return next(err);
      res.redirect('/organiser');
    });
  });
});

/**
 * @desc View event details (read-only) with booking information
 */
router.get("/events/:id/view", (req, res, next) => {
  const eventId = req.params.id;

  const eventQuery = "SELECT * FROM events WHERE id = ?";
  const ticketQuery = "SELECT * FROM tickets WHERE event_id = ?";
  const bookingsQuery = "SELECT b.*, u.user_name as attendee_name FROM bookings b LEFT JOIN users u ON b.user_id = u.user_id WHERE b.event_id = ? ORDER BY b.booked_at DESC";

  global.db.get(eventQuery, [eventId], function (err, event) {
    if (err) {
      next(err);
    } else if (!event) {
      return res.status(404).send("Event not found");
    } else {
      global.db.all(ticketQuery, [eventId], function (err, tickets) {
        if (err) {
          next(err);
        } else {
          global.db.all(bookingsQuery, [eventId], function (err, bookings) {
            if (err) {
              next(err);
            } else {
              // Format event_date for display
              try {
                const parsed = parseISO(event.event_date);
                if (isValid(parsed)) {
                  event.event_date_formatted = format(parsed, 'EEEE, d MMMM yyyy');
                } else {
                  event.event_date_formatted = event.event_date;
                }
              } catch (e) {
                event.event_date_formatted = event.event_date;
              }

              // Calculate ticket statistics
              const ticketStats = {
                full: tickets.find(t => t.type === 'full') || {},
                concession: tickets.find(t => t.type === 'concession') || {}
              };

              const totalTicketsSold = (bookings || []).reduce((sum, b) => sum + (b.full_tickets || 0) + (b.concession_tickets || 0), 0);

              res.render("organiser-event-details", {
                event: event,
                tickets: tickets,
                bookings: bookings || [],
                ticketStats: ticketStats,
                totalTicketsSold: totalTicketsSold,
                req: req
              });
            }
          });
        }
      });
    }
  });
});

/**
 * @desc Delete an event and all related data
 */
router.post("/events/:id/delete", (req, res, next) => {
  const eventId = req.params.id;

  global.db.run("DELETE FROM tickets WHERE event_id = ?", [eventId]);
  global.db.run("DELETE FROM bookings WHERE event_id = ?", [eventId]);
  global.db.run("DELETE FROM events WHERE id = ?", [eventId], function (err) {
    if (err) {
      next(err);
    } else {
      res.redirect("/organiser");
    }
  });
});

module.exports = router;

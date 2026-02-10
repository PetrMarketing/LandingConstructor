const express = require('express');
const router = express.Router();
const { getDb } = require('../config/database');
const { v4: uuidv4 } = require('uuid');

// ============================================================
// BOOKINGS / ЗАПИСИ НА УСЛУГИ
// ============================================================

// Get all bookings for project
router.get('/:projectId', (req, res) => {
    try {
        const db = getDb();
        const { date, employee_id, status, client_id, from_date, to_date, limit = 100, offset = 0 } = req.query;

        let query = `
            SELECT b.*,
                s.name as service_name, s.duration as service_duration,
                (e.first_name || ' ' || e.last_name) as employee_name,
                c.first_name, c.last_name, c.phone as client_phone_db
            FROM bookings b
            LEFT JOIN services s ON s.id = b.service_id
            LEFT JOIN employees e ON e.id = b.employee_id
            LEFT JOIN clients c ON c.id = b.client_id
            WHERE b.project_id = ?
        `;
        const params = [req.params.projectId];

        if (date) {
            query += ` AND b.booking_date = ?`;
            params.push(date);
        }
        if (from_date) {
            query += ` AND b.booking_date >= ?`;
            params.push(from_date);
        }
        if (to_date) {
            query += ` AND b.booking_date <= ?`;
            params.push(to_date);
        }
        if (employee_id) {
            query += ` AND b.employee_id = ?`;
            params.push(employee_id);
        }
        if (status) {
            query += ` AND b.status = ?`;
            params.push(status);
        }
        if (client_id) {
            query += ` AND b.client_id = ?`;
            params.push(client_id);
        }

        query += ` ORDER BY b.booking_date DESC, b.start_time ASC LIMIT ? OFFSET ?`;
        params.push(Number(limit), Number(offset));

        const bookings = db.prepare(query).all(...params);

        res.json({ success: true, bookings });
    } catch (error) {
        console.error('Get bookings error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get bookings for calendar view (by date range)
router.get('/:projectId/calendar', (req, res) => {
    try {
        const db = getDb();
        const { from, to, employee_id } = req.query;

        if (!from || !to) {
            return res.status(400).json({ success: false, error: 'Укажите диапазон дат (from, to)' });
        }

        let query = `
            SELECT b.*,
                s.name as service_name, s.duration as service_duration,
                (e.first_name || ' ' || e.last_name) as employee_name
            FROM bookings b
            LEFT JOIN services s ON s.id = b.service_id
            LEFT JOIN employees e ON e.id = b.employee_id
            WHERE b.project_id = ?
                AND b.booking_date >= ?
                AND b.booking_date <= ?
                AND b.status != 'cancelled'
        `;
        const params = [req.params.projectId, from, to];

        if (employee_id) {
            query += ` AND b.employee_id = ?`;
            params.push(employee_id);
        }

        query += ` ORDER BY b.booking_date, b.start_time`;

        const bookings = db.prepare(query).all(...params);

        // Group by date for calendar
        const calendar = {};
        bookings.forEach(b => {
            if (!calendar[b.booking_date]) {
                calendar[b.booking_date] = [];
            }
            calendar[b.booking_date].push(b);
        });

        res.json({ success: true, calendar, bookings });
    } catch (error) {
        console.error('Get calendar error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get available time slots
router.get('/:projectId/slots', (req, res) => {
    try {
        const db = getDb();
        const { date, service_id, employee_id } = req.query;

        if (!date || !service_id) {
            return res.status(400).json({ success: false, error: 'Укажите дату и услугу' });
        }

        // Get service duration
        const service = db.prepare('SELECT duration FROM services WHERE id = ?').get(service_id);
        if (!service) {
            return res.status(404).json({ success: false, error: 'Услуга не найдена' });
        }
        const duration = service.duration || 60; // default 60 min

        // Get day of week (0 = Sunday, 1 = Monday, ...)
        const dayOfWeek = new Date(date).getDay();

        // Get employees who can provide this service
        let employeesQuery = `
            SELECT e.id, (e.first_name || ' ' || e.last_name) as name, es.start_time, es.end_time, es.break_start, es.break_end
            FROM employees e
            LEFT JOIN employee_schedules es ON es.employee_id = e.id AND es.day_of_week = ?
            WHERE e.project_id = ?
                AND e.is_active = 1
                AND (es.is_working = 1 OR es.is_working IS NULL)
        `;
        const employeeParams = [dayOfWeek, req.params.projectId];

        if (employee_id) {
            employeesQuery += ` AND e.id = ?`;
            employeeParams.push(employee_id);
        }

        const employees = db.prepare(employeesQuery).all(...employeeParams);

        // Get existing bookings for the date
        const existingBookings = db.prepare(`
            SELECT employee_id, start_time, end_time
            FROM bookings
            WHERE project_id = ?
                AND booking_date = ?
                AND status NOT IN ('cancelled', 'no_show')
        `).all(req.params.projectId, date);

        // Check for schedule exceptions
        const exceptions = db.prepare(`
            SELECT employee_id, type, start_time, end_time
            FROM schedule_exceptions
            WHERE date = ?
        `).all(date);

        // Generate available slots for each employee
        const slots = [];

        employees.forEach(emp => {
            // Check if employee has exception for this day
            const exception = exceptions.find(e => e.employee_id === emp.id);
            if (exception && exception.type === 'day_off') {
                return; // Skip this employee
            }

            const workStart = exception?.start_time || emp.start_time || '09:00';
            const workEnd = exception?.end_time || emp.end_time || '18:00';

            // Generate time slots (every 30 min)
            const slotInterval = 30;
            let currentTime = timeToMinutes(workStart);
            const endTime = timeToMinutes(workEnd);

            while (currentTime + duration <= endTime) {
                const slotStart = minutesToTime(currentTime);
                const slotEnd = minutesToTime(currentTime + duration);

                // Check if in break
                if (emp.break_start && emp.break_end) {
                    const breakStart = timeToMinutes(emp.break_start);
                    const breakEnd = timeToMinutes(emp.break_end);
                    if (currentTime < breakEnd && currentTime + duration > breakStart) {
                        currentTime += slotInterval;
                        continue;
                    }
                }

                // Check if conflicts with existing booking
                const hasConflict = existingBookings.some(booking => {
                    if (booking.employee_id !== emp.id) return false;
                    const bookingStart = timeToMinutes(booking.start_time);
                    const bookingEnd = timeToMinutes(booking.end_time);
                    return currentTime < bookingEnd && currentTime + duration > bookingStart;
                });

                if (!hasConflict) {
                    slots.push({
                        employee_id: emp.id,
                        employee_name: emp.name,
                        date,
                        start_time: slotStart,
                        end_time: slotEnd
                    });
                }

                currentTime += slotInterval;
            }
        });

        res.json({ success: true, slots, service_duration: duration });
    } catch (error) {
        console.error('Get slots error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================================
// EMPLOYEE SCHEDULES (must be before /:bookingId routes)
// ============================================================

// Get all schedules for project employees
router.get('/:projectId/schedules', (req, res) => {
    try {
        const db = getDb();
        const schedules = db.prepare(`
            SELECT es.*, (e.first_name || ' ' || e.last_name) as employee_name
            FROM employee_schedules es
            JOIN employees e ON e.id = es.employee_id
            WHERE e.project_id = ?
            ORDER BY e.first_name, es.day_of_week
        `).all(req.params.projectId);

        res.json({ success: true, schedules });
    } catch (error) {
        console.error('Get schedules error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get employees for booking context
router.get('/:projectId/employees', (req, res) => {
    try {
        const db = getDb();
        const { service_id } = req.query;

        let query, params;
        if (service_id) {
            query = `
                SELECT e.id, e.first_name, e.last_name, e.position, e.avatar_url,
                    se.price_override, se.duration_override
                FROM employees e
                JOIN service_employees se ON se.employee_id = e.id AND se.service_id = ? AND se.is_active = 1
                WHERE e.project_id = ? AND e.is_active = 1
                ORDER BY e.first_name, e.last_name
            `;
            params = [service_id, req.params.projectId];
        } else {
            query = `
                SELECT e.id, e.first_name, e.last_name, e.position, e.avatar_url
                FROM employees e
                WHERE e.project_id = ? AND e.is_active = 1
                ORDER BY e.first_name, e.last_name
            `;
            params = [req.params.projectId];
        }

        const employees = db.prepare(query).all(...params);
        res.json({ success: true, employees });
    } catch (error) {
        console.error('Get booking employees error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get employee schedule
router.get('/:projectId/schedules/:employeeId', (req, res) => {
    try {
        const db = getDb();
        const schedules = db.prepare(`
            SELECT * FROM employee_schedules WHERE employee_id = ? ORDER BY day_of_week
        `).all(req.params.employeeId);

        const exceptions = db.prepare(`
            SELECT * FROM schedule_exceptions
            WHERE employee_id = ? AND date >= date('now')
            ORDER BY date
            LIMIT 30
        `).all(req.params.employeeId);

        res.json({ success: true, schedules, exceptions });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Set employee schedule
router.post('/:projectId/schedules/:employeeId', (req, res) => {
    try {
        const db = getDb();
        const { schedules } = req.body;

        const upsert = db.prepare(`
            INSERT INTO employee_schedules (id, employee_id, day_of_week, start_time, end_time, is_working, break_start, break_end)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(employee_id, day_of_week) DO UPDATE SET
                start_time = excluded.start_time,
                end_time = excluded.end_time,
                is_working = excluded.is_working,
                break_start = excluded.break_start,
                break_end = excluded.break_end
        `);

        const updateMany = db.transaction((items) => {
            for (const s of items) {
                upsert.run(
                    uuidv4(), req.params.employeeId, s.day_of_week,
                    s.start_time, s.end_time, s.is_working ? 1 : 0,
                    s.break_start, s.break_end
                );
            }
        });

        updateMany(schedules);

        res.json({ success: true });
    } catch (error) {
        console.error('Set schedule error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Add schedule exception (day off, vacation, etc.)
router.post('/:projectId/schedules/:employeeId/exceptions', (req, res) => {
    try {
        const db = getDb();
        const { date, type, reason, start_time, end_time } = req.body;

        db.prepare(`
            INSERT INTO schedule_exceptions (id, employee_id, date, type, reason, start_time, end_time)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(uuidv4(), req.params.employeeId, date, type || 'day_off', reason, start_time, end_time);

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Delete schedule exception
router.delete('/:projectId/schedules/:employeeId/exceptions/:exceptionId', (req, res) => {
    try {
        const db = getDb();
        db.prepare('DELETE FROM schedule_exceptions WHERE id = ?').run(req.params.exceptionId);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================================
// CLIENT VISITS (must be before /:bookingId routes)
// ============================================================

// Get client visit history
router.get('/:projectId/clients/:clientId/visits', (req, res) => {
    try {
        const db = getDb();
        const visits = db.prepare(`
            SELECT v.*, s.name as service_name, (e.first_name || ' ' || e.last_name) as employee_name
            FROM client_visits v
            LEFT JOIN services s ON s.id = v.service_id
            LEFT JOIN employees e ON e.id = v.employee_id
            WHERE v.client_id = ?
            ORDER BY v.visit_date DESC
            LIMIT 50
        `).all(req.params.clientId);

        const stats = db.prepare(`
            SELECT
                COUNT(*) as total_visits,
                SUM(amount_paid) as total_spent,
                AVG(rating) as avg_rating,
                MAX(visit_date) as last_visit
            FROM client_visits
            WHERE client_id = ?
        `).get(req.params.clientId);

        res.json({ success: true, visits, stats });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================================
// BOOKING CRUD (/:bookingId routes - must be after static routes)
// ============================================================

// Create booking
router.post('/:projectId', (req, res) => {
    try {
        const db = getDb();
        const id = uuidv4();
        const {
            client_id, employee_id, service_id, booking_date, start_time,
            duration: reqDuration, client_name, client_phone, client_email, comment, source,
            send_reminder, reminder_time
        } = req.body;

        if (!service_id || !booking_date || !start_time) {
            return res.status(400).json({ success: false, error: 'Укажите услугу, дату и время' });
        }

        // Get service duration and price
        const service = db.prepare('SELECT duration, price FROM services WHERE id = ?').get(service_id);
        if (!service) {
            return res.status(404).json({ success: false, error: 'Услуга не найдена' });
        }

        const duration = reqDuration || service.duration || 60;
        const startMinutes = timeToMinutes(start_time);
        const end_time = minutesToTime(startMinutes + duration);

        // Check for conflicts
        const conflict = db.prepare(`
            SELECT id FROM bookings
            WHERE project_id = ?
                AND employee_id = ?
                AND booking_date = ?
                AND status NOT IN ('cancelled', 'no_show')
                AND (
                    (start_time < ? AND end_time > ?) OR
                    (start_time >= ? AND start_time < ?)
                )
        `).get(req.params.projectId, employee_id, booking_date, end_time, start_time, start_time, end_time);

        if (conflict) {
            return res.status(400).json({ success: false, error: 'Это время уже занято' });
        }

        // Create or find client
        let finalClientId = client_id;
        if (!finalClientId && client_phone) {
            // Try to find existing client by phone
            const existingClient = db.prepare(`
                SELECT id FROM clients WHERE project_id = ? AND phone = ?
            `).get(req.params.projectId, client_phone);

            if (existingClient) {
                finalClientId = existingClient.id;
            } else if (client_name) {
                // Create new client
                finalClientId = uuidv4();
                const nameParts = client_name.split(' ');
                db.prepare(`
                    INSERT INTO clients (id, project_id, first_name, last_name, phone, email, source)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                `).run(finalClientId, req.params.projectId, nameParts[0], nameParts.slice(1).join(' ') || null,
                    client_phone, client_email, 'booking');
            }
        }

        db.prepare(`
            INSERT INTO bookings (
                id, project_id, client_id, employee_id, service_id, booking_date,
                start_time, end_time, client_name, client_phone, client_email,
                comment, source, price
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            id, req.params.projectId, finalClientId, employee_id, service_id,
            booking_date, start_time, end_time, client_name, client_phone, client_email,
            comment, source || 'website', service.price
        );

        // Create reminder (1 hour before)
        const reminderTime = new Date(`${booking_date}T${start_time}`);
        reminderTime.setHours(reminderTime.getHours() - 1);

        db.prepare(`
            INSERT INTO booking_reminders (id, booking_id, type, send_at, message)
            VALUES (?, ?, 'sms', ?, ?)
        `).run(uuidv4(), id, reminderTime.toISOString(), `Напоминаем о записи сегодня в ${start_time}`);

        const booking = db.prepare(`
            SELECT b.*, s.name as service_name, (e.first_name || ' ' || e.last_name) as employee_name
            FROM bookings b
            LEFT JOIN services s ON s.id = b.service_id
            LEFT JOIN employees e ON e.id = b.employee_id
            WHERE b.id = ?
        `).get(id);

        res.json({ success: true, booking });
    } catch (error) {
        console.error('Create booking error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get single booking
router.get('/:projectId/:bookingId', (req, res) => {
    try {
        const db = getDb();
        const booking = db.prepare(`
            SELECT b.*,
                s.name as service_name, s.duration as service_duration,
                (e.first_name || ' ' || e.last_name) as employee_name,
                c.first_name, c.last_name, c.phone as client_phone_db
            FROM bookings b
            LEFT JOIN services s ON s.id = b.service_id
            LEFT JOIN employees e ON e.id = b.employee_id
            LEFT JOIN clients c ON c.id = b.client_id
            WHERE b.id = ? AND b.project_id = ?
        `).get(req.params.bookingId, req.params.projectId);

        if (!booking) {
            return res.status(404).json({ success: false, error: 'Запись не найдена' });
        }

        res.json({ success: true, booking });
    } catch (error) {
        console.error('Get booking error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Update booking
router.put('/:projectId/:bookingId', (req, res) => {
    try {
        const db = getDb();
        const {
            employee_id, booking_date, start_time, status, comment, cancelled_reason
        } = req.body;

        // If changing time, recalculate end_time
        let end_time = null;
        if (start_time) {
            const booking = db.prepare('SELECT service_id FROM bookings WHERE id = ?').get(req.params.bookingId);
            const service = db.prepare('SELECT duration FROM services WHERE id = ?').get(booking.service_id);
            const duration = service?.duration || 60;
            end_time = minutesToTime(timeToMinutes(start_time) + duration);
        }

        db.prepare(`
            UPDATE bookings SET
                employee_id = COALESCE(?, employee_id),
                booking_date = COALESCE(?, booking_date),
                start_time = COALESCE(?, start_time),
                end_time = COALESCE(?, end_time),
                status = COALESCE(?, status),
                comment = COALESCE(?, comment),
                cancelled_reason = COALESCE(?, cancelled_reason),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND project_id = ?
        `).run(
            employee_id, booking_date, start_time, end_time, status, comment, cancelled_reason,
            req.params.bookingId, req.params.projectId
        );

        const booking = db.prepare(`
            SELECT b.*, s.name as service_name, (e.first_name || ' ' || e.last_name) as employee_name
            FROM bookings b
            LEFT JOIN services s ON s.id = b.service_id
            LEFT JOIN employees e ON e.id = b.employee_id
            WHERE b.id = ?
        `).get(req.params.bookingId);

        res.json({ success: true, booking });
    } catch (error) {
        console.error('Update booking error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Confirm booking
router.post('/:projectId/:bookingId/confirm', (req, res) => {
    try {
        const db = getDb();
        db.prepare(`
            UPDATE bookings SET status = 'confirmed', updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND project_id = ?
        `).run(req.params.bookingId, req.params.projectId);

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Send booking reminder
router.post('/:projectId/:bookingId/reminder', (req, res) => {
    try {
        const db = getDb();
        db.prepare(`
            UPDATE bookings SET
                reminder_sent = 1,
                updated_at = datetime('now')
            WHERE id = ? AND project_id = ?
        `).run(req.params.bookingId, req.params.projectId);

        res.json({ success: true, message: 'Напоминание отправлено' });
    } catch (error) {
        console.error('Send reminder error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Complete booking (mark as visited)
router.post('/:projectId/:bookingId/complete', (req, res) => {
    try {
        const db = getDb();
        const { amount_paid, notes, rating, feedback } = req.body;

        const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(req.params.bookingId);
        if (!booking) {
            return res.status(404).json({ success: false, error: 'Запись не найдена' });
        }

        // Update booking status
        db.prepare(`
            UPDATE bookings SET status = 'completed', paid_amount = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).run(amount_paid || booking.price, req.params.bookingId);

        // Create visit record
        if (booking.client_id) {
            db.prepare(`
                INSERT INTO client_visits (
                    id, project_id, client_id, booking_id, service_id, employee_id,
                    visit_date, status, notes, rating, feedback, amount_paid
                ) VALUES (?, ?, ?, ?, ?, ?, ?, 'completed', ?, ?, ?, ?)
            `).run(
                uuidv4(), req.params.projectId, booking.client_id, booking.id,
                booking.service_id, booking.employee_id, booking.booking_date,
                notes, rating, feedback, amount_paid || booking.price
            );

            // Update client stats
            db.prepare(`
                UPDATE clients SET
                    total_orders = total_orders + 1,
                    total_spent = total_spent + ?,
                    last_order_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `).run(amount_paid || booking.price || 0, booking.client_id);
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Complete booking error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Cancel booking
router.post('/:projectId/:bookingId/cancel', (req, res) => {
    try {
        const db = getDb();
        const { reason } = req.body;

        db.prepare(`
            UPDATE bookings SET
                status = 'cancelled',
                cancelled_reason = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND project_id = ?
        `).run(reason, req.params.bookingId, req.params.projectId);

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Delete booking
router.delete('/:projectId/:bookingId', (req, res) => {
    try {
        const db = getDb();
        db.prepare('DELETE FROM bookings WHERE id = ? AND project_id = ?')
            .run(req.params.bookingId, req.params.projectId);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Helper functions
function timeToMinutes(time) {
    if (!time) return 0;
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
}

function minutesToTime(minutes) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

module.exports = router;

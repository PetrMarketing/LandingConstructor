const express = require('express');
const router = express.Router();
const { getDb } = require('../config/database');
const { v4: uuidv4 } = require('uuid');

// ============================================================
// COURSE ACCESS / ДОСТУПЫ К КУРСАМ
// ============================================================

// Get course access for client
router.get('/:projectId/access/:courseId/:clientId', (req, res) => {
    try {
        const db = getDb();
        const access = db.prepare(`
            SELECT * FROM course_access WHERE course_id = ? AND client_id = ?
        `).get(req.params.courseId, req.params.clientId);

        if (!access) {
            return res.json({ success: true, has_access: false });
        }

        // Check if expired
        const now = new Date().toISOString();
        const isActive = access.is_active &&
            (!access.starts_at || access.starts_at <= now) &&
            (!access.expires_at || access.expires_at > now);

        res.json({
            success: true,
            has_access: isActive,
            access: { ...access, is_currently_active: isActive }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Grant course access
router.post('/:projectId/access/:courseId', (req, res) => {
    try {
        const db = getDb();
        const id = uuidv4();
        const { client_id, access_type, source, order_id, starts_at, expires_at } = req.body;

        db.prepare(`
            INSERT INTO course_access (id, course_id, client_id, access_type, source, order_id, starts_at, expires_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(course_id, client_id) DO UPDATE SET
                access_type = excluded.access_type,
                source = excluded.source,
                order_id = excluded.order_id,
                starts_at = excluded.starts_at,
                expires_at = excluded.expires_at,
                is_active = 1
        `).run(id, req.params.courseId, client_id, access_type || 'full', source || 'manual', order_id, starts_at, expires_at);

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Revoke course access
router.delete('/:projectId/access/:courseId/:clientId', (req, res) => {
    try {
        const db = getDb();
        db.prepare('UPDATE course_access SET is_active = 0 WHERE course_id = ? AND client_id = ?')
            .run(req.params.courseId, req.params.clientId);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get all clients with access to course
router.get('/:projectId/access/:courseId/students', (req, res) => {
    try {
        const db = getDb();
        const students = db.prepare(`
            SELECT ca.*, c.first_name, c.last_name, c.email, c.phone,
                cp.progress_percent, cp.status as progress_status, cp.completed_at
            FROM course_access ca
            JOIN clients c ON c.id = ca.client_id
            LEFT JOIN course_progress cp ON cp.course_id = ca.course_id AND cp.client_id = ca.client_id
            WHERE ca.course_id = ?
            ORDER BY ca.created_at DESC
        `).all(req.params.courseId);

        res.json({ success: true, students });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================================
// HOMEWORK / ДОМАШНИЕ ЗАДАНИЯ
// ============================================================

// Get homework for lesson
router.get('/:projectId/homework/lesson/:lessonId', (req, res) => {
    try {
        const db = getDb();
        const homework = db.prepare('SELECT * FROM homework WHERE lesson_id = ?').all(req.params.lessonId);
        res.json({ success: true, homework });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Create homework
router.post('/:projectId/homework', (req, res) => {
    try {
        const db = getDb();
        const id = uuidv4();
        const { lesson_id, course_id, title, description, instructions, deadline_days, max_score, is_required } = req.body;

        db.prepare(`
            INSERT INTO homework (id, lesson_id, course_id, title, description, instructions, deadline_days, max_score, is_required)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(id, lesson_id, course_id, title, description, instructions, deadline_days, max_score || 100, is_required ? 1 : 0);

        const homework = db.prepare('SELECT * FROM homework WHERE id = ?').get(id);
        res.json({ success: true, homework });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Submit homework
router.post('/:projectId/homework/:homeworkId/submit', (req, res) => {
    try {
        const db = getDb();
        const id = uuidv4();
        const { client_id, content, attachments } = req.body;

        db.prepare(`
            INSERT INTO homework_submissions (id, homework_id, client_id, content, attachments)
            VALUES (?, ?, ?, ?, ?)
        `).run(id, req.params.homeworkId, client_id, content, JSON.stringify(attachments || []));

        const submission = db.prepare('SELECT * FROM homework_submissions WHERE id = ?').get(id);
        res.json({
            success: true,
            submission: { ...submission, attachments: JSON.parse(submission.attachments || '[]') }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Review homework submission
router.put('/:projectId/homework/submissions/:submissionId/review', (req, res) => {
    try {
        const db = getDb();
        const { score, feedback, reviewed_by, status } = req.body;

        db.prepare(`
            UPDATE homework_submissions SET
                score = ?, feedback = ?, reviewed_by = ?, status = ?, reviewed_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).run(score, feedback, reviewed_by, status || 'reviewed', req.params.submissionId);

        const submission = db.prepare('SELECT * FROM homework_submissions WHERE id = ?').get(req.params.submissionId);
        res.json({
            success: true,
            submission: { ...submission, attachments: JSON.parse(submission.attachments || '[]') }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get submissions for homework (teacher view)
router.get('/:projectId/homework/:homeworkId/submissions', (req, res) => {
    try {
        const db = getDb();
        const submissions = db.prepare(`
            SELECT hs.*, c.first_name, c.last_name, c.email
            FROM homework_submissions hs
            JOIN clients c ON c.id = hs.client_id
            WHERE hs.homework_id = ?
            ORDER BY hs.submitted_at DESC
        `).all(req.params.homeworkId);

        res.json({
            success: true,
            submissions: submissions.map(s => ({
                ...s,
                attachments: JSON.parse(s.attachments || '[]')
            }))
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================================
// QUIZZES / ТЕСТЫ
// ============================================================

// Get quiz
router.get('/:projectId/quizzes/:quizId', (req, res) => {
    try {
        const db = getDb();
        const quiz = db.prepare('SELECT * FROM quizzes WHERE id = ?').get(req.params.quizId);
        if (!quiz) {
            return res.status(404).json({ success: false, error: 'Тест не найден' });
        }

        const questions = db.prepare(`
            SELECT * FROM quiz_questions WHERE quiz_id = ? ORDER BY sort_order
        `).all(quiz.id);

        res.json({
            success: true,
            quiz,
            questions: questions.map(q => ({
                ...q,
                options: JSON.parse(q.options || '[]'),
                // Hide correct answer for students
                correct_answer: undefined
            }))
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Create quiz
router.post('/:projectId/quizzes', (req, res) => {
    try {
        const db = getDb();
        const id = uuidv4();
        const {
            lesson_id, course_id, title, description, time_limit_minutes,
            passing_score, attempts_allowed, shuffle_questions, show_answers, is_required
        } = req.body;

        db.prepare(`
            INSERT INTO quizzes (
                id, lesson_id, course_id, title, description, time_limit_minutes,
                passing_score, attempts_allowed, shuffle_questions, show_answers, is_required
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            id, lesson_id, course_id, title, description, time_limit_minutes,
            passing_score || 70, attempts_allowed || 3, shuffle_questions ? 1 : 0,
            show_answers !== false ? 1 : 0, is_required ? 1 : 0
        );

        const quiz = db.prepare('SELECT * FROM quizzes WHERE id = ?').get(id);
        res.json({ success: true, quiz });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Add question to quiz
router.post('/:projectId/quizzes/:quizId/questions', (req, res) => {
    try {
        const db = getDb();
        const id = uuidv4();
        const { question_type, question_text, options, correct_answer, explanation, points, sort_order } = req.body;

        db.prepare(`
            INSERT INTO quiz_questions (id, quiz_id, question_type, question_text, options, correct_answer, explanation, points, sort_order)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            id, req.params.quizId, question_type || 'single', question_text,
            JSON.stringify(options || []), correct_answer, explanation, points || 1, sort_order || 0
        );

        const question = db.prepare('SELECT * FROM quiz_questions WHERE id = ?').get(id);
        res.json({
            success: true,
            question: { ...question, options: JSON.parse(question.options || '[]') }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Start quiz attempt
router.post('/:projectId/quizzes/:quizId/start', (req, res) => {
    try {
        const db = getDb();
        const { client_id } = req.body;
        const quiz = db.prepare('SELECT * FROM quizzes WHERE id = ?').get(req.params.quizId);

        // Check attempts limit
        const { count } = db.prepare(`
            SELECT COUNT(*) as count FROM quiz_attempts WHERE quiz_id = ? AND client_id = ?
        `).get(req.params.quizId, client_id);

        if (quiz.attempts_allowed && count >= quiz.attempts_allowed) {
            return res.status(400).json({ success: false, error: 'Превышен лимит попыток' });
        }

        const id = uuidv4();
        db.prepare(`
            INSERT INTO quiz_attempts (id, quiz_id, client_id) VALUES (?, ?, ?)
        `).run(id, req.params.quizId, client_id);

        // Get questions (shuffle if needed)
        let questions = db.prepare(`
            SELECT id, question_type, question_text, options, points FROM quiz_questions WHERE quiz_id = ?
        `).all(req.params.quizId);

        if (quiz.shuffle_questions) {
            questions = questions.sort(() => Math.random() - 0.5);
        }

        res.json({
            success: true,
            attempt_id: id,
            time_limit_minutes: quiz.time_limit_minutes,
            questions: questions.map(q => ({
                ...q,
                options: JSON.parse(q.options || '[]')
            }))
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Submit quiz answers
router.post('/:projectId/quizzes/:quizId/submit/:attemptId', (req, res) => {
    try {
        const db = getDb();
        const { answers } = req.body; // { question_id: answer }

        const attempt = db.prepare('SELECT * FROM quiz_attempts WHERE id = ?').get(req.params.attemptId);
        if (!attempt) {
            return res.status(404).json({ success: false, error: 'Попытка не найдена' });
        }

        const quiz = db.prepare('SELECT * FROM quizzes WHERE id = ?').get(req.params.quizId);
        const questions = db.prepare('SELECT * FROM quiz_questions WHERE quiz_id = ?').all(req.params.quizId);

        let score = 0;
        let maxScore = 0;
        const results = [];

        for (const q of questions) {
            maxScore += q.points;
            const userAnswer = answers[q.id];
            const isCorrect = userAnswer === q.correct_answer;

            if (isCorrect) {
                score += q.points;
            }

            results.push({
                question_id: q.id,
                correct: isCorrect,
                user_answer: userAnswer,
                correct_answer: quiz.show_answers ? q.correct_answer : undefined,
                explanation: quiz.show_answers ? q.explanation : undefined
            });
        }

        const percent = Math.round((score / maxScore) * 100);
        const passed = percent >= quiz.passing_score;

        // Calculate time spent
        const startedAt = new Date(attempt.started_at);
        const now = new Date();
        const timeSpent = Math.round((now - startedAt) / 1000);

        db.prepare(`
            UPDATE quiz_attempts SET
                answers = ?, score = ?, max_score = ?, percent = ?, passed = ?,
                completed_at = CURRENT_TIMESTAMP, time_spent_seconds = ?
            WHERE id = ?
        `).run(JSON.stringify(answers), score, maxScore, percent, passed ? 1 : 0, timeSpent, req.params.attemptId);

        res.json({
            success: true,
            score,
            max_score: maxScore,
            percent,
            passed,
            passing_score: quiz.passing_score,
            results: quiz.show_answers ? results : undefined
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================================
// WEBINARS / ВЕБИНАРЫ
// ============================================================

// Get webinars for project
router.get('/:projectId/webinars', (req, res) => {
    try {
        const db = getDb();
        const { status, from_date, to_date } = req.query;

        let query = `
            SELECT w.*, c.name as course_name,
                (e.first_name || ' ' || e.last_name) as host_name,
                (SELECT COUNT(*) FROM webinar_registrations WHERE webinar_id = w.id) as registrations_count
            FROM webinars w
            LEFT JOIN courses c ON c.id = w.course_id
            LEFT JOIN employees e ON e.id = w.host_id
            WHERE w.project_id = ?
        `;
        const params = [req.params.projectId];

        if (status) {
            query += ` AND w.status = ?`;
            params.push(status);
        }
        if (from_date) {
            query += ` AND w.scheduled_at >= ?`;
            params.push(from_date);
        }
        if (to_date) {
            query += ` AND w.scheduled_at <= ?`;
            params.push(to_date);
        }

        query += ` ORDER BY w.scheduled_at DESC`;

        const webinars = db.prepare(query).all(...params);
        res.json({ success: true, webinars });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Create webinar
router.post('/:projectId/webinars', (req, res) => {
    try {
        const db = getDb();
        const id = uuidv4();
        const {
            course_id, title, description, host_id, scheduled_at, duration_minutes,
            timezone, platform, join_url, max_participants
        } = req.body;

        db.prepare(`
            INSERT INTO webinars (
                id, project_id, course_id, title, description, host_id, scheduled_at,
                duration_minutes, timezone, platform, join_url, max_participants
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            id, req.params.projectId, course_id, title, description, host_id, scheduled_at,
            duration_minutes || 60, timezone || 'Europe/Moscow', platform || 'zoom', join_url, max_participants
        );

        const webinar = db.prepare('SELECT * FROM webinars WHERE id = ?').get(id);
        res.json({ success: true, webinar });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Register for webinar
router.post('/:projectId/webinars/:webinarId/register', (req, res) => {
    try {
        const db = getDb();
        const id = uuidv4();
        const { client_id, client_name, client_email } = req.body;

        // Check capacity
        const webinar = db.prepare('SELECT max_participants FROM webinars WHERE id = ?').get(req.params.webinarId);
        const { count } = db.prepare('SELECT COUNT(*) as count FROM webinar_registrations WHERE webinar_id = ?')
            .get(req.params.webinarId);

        if (webinar.max_participants && count >= webinar.max_participants) {
            return res.status(400).json({ success: false, error: 'Все места заняты' });
        }

        db.prepare(`
            INSERT INTO webinar_registrations (id, webinar_id, client_id, client_name, client_email)
            VALUES (?, ?, ?, ?, ?)
        `).run(id, req.params.webinarId, client_id, client_name, client_email);

        res.json({ success: true, registration_id: id });
    } catch (error) {
        if (error.message.includes('UNIQUE')) {
            return res.status(400).json({ success: false, error: 'Вы уже зарегистрированы' });
        }
        res.status(500).json({ success: false, error: error.message });
    }
});

// Update webinar status (start, end, cancel)
router.put('/:projectId/webinars/:webinarId/status', (req, res) => {
    try {
        const db = getDb();
        const { status, recording_url } = req.body;

        db.prepare(`
            UPDATE webinars SET status = ?, recording_url = COALESCE(?, recording_url) WHERE id = ?
        `).run(status, recording_url, req.params.webinarId);

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================================
// CERTIFICATES / СЕРТИФИКАТЫ
// ============================================================

// Get certificate templates
router.get('/:projectId/certificates/templates', (req, res) => {
    try {
        const db = getDb();
        const templates = db.prepare(`
            SELECT * FROM certificate_templates WHERE project_id = ? ORDER BY is_default DESC, name
        `).all(req.params.projectId);

        res.json({
            success: true,
            templates: templates.map(t => ({
                ...t,
                fields: JSON.parse(t.fields || '[]')
            }))
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Create certificate template
router.post('/:projectId/certificates/templates', (req, res) => {
    try {
        const db = getDb();
        const id = uuidv4();
        const { name, design, background_image, text_template, fields, is_default } = req.body;

        if (is_default) {
            db.prepare('UPDATE certificate_templates SET is_default = 0 WHERE project_id = ?')
                .run(req.params.projectId);
        }

        db.prepare(`
            INSERT INTO certificate_templates (id, project_id, name, design, background_image, text_template, fields, is_default)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(id, req.params.projectId, name, design || 'default', background_image, text_template,
            JSON.stringify(fields || []), is_default ? 1 : 0);

        const template = db.prepare('SELECT * FROM certificate_templates WHERE id = ?').get(id);
        res.json({
            success: true,
            template: { ...template, fields: JSON.parse(template.fields || '[]') }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Issue certificate
router.post('/:projectId/certificates/issue', (req, res) => {
    try {
        const db = getDb();
        const id = uuidv4();
        const { template_id, course_id, client_id } = req.body;

        // Generate unique certificate number
        const certNumber = `CERT-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
        const verificationCode = uuidv4().split('-')[0].toUpperCase();

        db.prepare(`
            INSERT INTO certificates (id, template_id, course_id, client_id, certificate_number, verification_code)
            VALUES (?, ?, ?, ?, ?, ?)
        `).run(id, template_id, course_id, client_id, certNumber, verificationCode);

        // Update course progress
        db.prepare(`
            UPDATE course_progress SET certificate_issued = 1 WHERE course_id = ? AND client_id = ?
        `).run(course_id, client_id);

        const certificate = db.prepare(`
            SELECT cert.*, c.name as course_name, cl.first_name, cl.last_name
            FROM certificates cert
            JOIN courses c ON c.id = cert.course_id
            JOIN clients cl ON cl.id = cert.client_id
            WHERE cert.id = ?
        `).get(id);

        res.json({ success: true, certificate });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Verify certificate
router.get('/:projectId/certificates/verify/:code', (req, res) => {
    try {
        const db = getDb();
        const certificate = db.prepare(`
            SELECT cert.*, c.name as course_name, cl.first_name, cl.last_name
            FROM certificates cert
            JOIN courses c ON c.id = cert.course_id
            JOIN clients cl ON cl.id = cert.client_id
            WHERE cert.verification_code = ? OR cert.certificate_number = ?
        `).get(req.params.code, req.params.code);

        if (!certificate) {
            return res.json({ success: true, valid: false });
        }

        res.json({
            success: true,
            valid: true,
            certificate: {
                certificate_number: certificate.certificate_number,
                course_name: certificate.course_name,
                student_name: `${certificate.first_name} ${certificate.last_name}`,
                issued_at: certificate.issued_at
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get client's certificates
router.get('/:projectId/certificates/client/:clientId', (req, res) => {
    try {
        const db = getDb();
        const certificates = db.prepare(`
            SELECT cert.*, c.name as course_name, c.cover_image
            FROM certificates cert
            JOIN courses c ON c.id = cert.course_id
            WHERE cert.client_id = ?
            ORDER BY cert.issued_at DESC
        `).all(req.params.clientId);

        res.json({ success: true, certificates });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;

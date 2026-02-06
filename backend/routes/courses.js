const express = require('express');
const router = express.Router();
const { getDb } = require('../config/database');
const { v4: uuidv4 } = require('uuid');

// ============================================================
// COURSES
// ============================================================

// Get all courses for project
router.get('/:projectId', (req, res) => {
    try {
        const db = getDb();
        const { category_id, status, is_featured, level, search, limit = 50, offset = 0 } = req.query;

        let query = `
            SELECT c.*, cat.name as category_name,
                e.first_name as instructor_first_name, e.last_name as instructor_last_name
            FROM courses c
            LEFT JOIN categories cat ON cat.id = c.category_id
            LEFT JOIN employees e ON e.id = c.instructor_id
            WHERE c.project_id = ?
        `;
        const params = [req.params.projectId];

        if (category_id) {
            query += ` AND c.category_id = ?`;
            params.push(category_id);
        }
        if (status) {
            query += ` AND c.status = ?`;
            params.push(status);
        }
        if (is_featured !== undefined) {
            query += ` AND c.is_featured = ?`;
            params.push(is_featured === 'true' ? 1 : 0);
        }
        if (level) {
            query += ` AND c.level = ?`;
            params.push(level);
        }
        if (search) {
            query += ` AND (c.name LIKE ? OR c.description LIKE ?)`;
            const searchTerm = `%${search}%`;
            params.push(searchTerm, searchTerm);
        }

        query += ` ORDER BY c.created_at DESC LIMIT ? OFFSET ?`;
        params.push(Number(limit), Number(offset));

        const courses = db.prepare(query).all(...params);

        res.json({
            success: true,
            courses: courses.map(c => ({
                ...c,
                what_you_learn: JSON.parse(c.what_you_learn || '[]'),
                requirements: JSON.parse(c.requirements || '[]')
            }))
        });
    } catch (error) {
        console.error('Get courses error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get single course with modules and lessons
router.get('/:projectId/:courseId', (req, res) => {
    try {
        const db = getDb();
        const course = db.prepare(`
            SELECT c.*, cat.name as category_name,
                e.first_name as instructor_first_name, e.last_name as instructor_last_name,
                e.avatar_url as instructor_avatar, e.position as instructor_position
            FROM courses c
            LEFT JOIN categories cat ON cat.id = c.category_id
            LEFT JOIN employees e ON e.id = c.instructor_id
            WHERE c.id = ? AND c.project_id = ?
        `).get(req.params.courseId, req.params.projectId);

        if (!course) {
            return res.status(404).json({ success: false, error: 'Курс не найден' });
        }

        // Get modules with lessons
        const modules = db.prepare(`
            SELECT * FROM course_modules WHERE course_id = ? ORDER BY sort_order
        `).all(course.id);

        const modulesWithLessons = modules.map(module => {
            const lessons = db.prepare(`
                SELECT * FROM course_lessons WHERE module_id = ? ORDER BY sort_order
            `).all(module.id);

            return {
                ...module,
                lessons: lessons.map(l => ({
                    ...l,
                    attachments: JSON.parse(l.attachments || '[]')
                }))
            };
        });

        // Get reviews
        const reviews = db.prepare(`
            SELECT r.*, cl.first_name, cl.last_name
            FROM reviews r
            LEFT JOIN clients cl ON cl.id = r.client_id
            WHERE r.entity_type = 'course' AND r.entity_id = ? AND r.is_approved = 1
            ORDER BY r.created_at DESC
            LIMIT 20
        `).all(course.id);

        res.json({
            success: true,
            course: {
                ...course,
                what_you_learn: JSON.parse(course.what_you_learn || '[]'),
                requirements: JSON.parse(course.requirements || '[]'),
                modules: modulesWithLessons
            },
            reviews
        });
    } catch (error) {
        console.error('Get course error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Create course
router.post('/:projectId', (req, res) => {
    try {
        const db = getDb();
        const id = uuidv4();
        const {
            name, slug, description, short_description, price, compare_price,
            category_id, instructor_id, cover_image, preview_video, duration_hours,
            level, language, what_you_learn, requirements, meta_title, meta_description,
            is_featured, is_visible, status
        } = req.body;

        if (!name) {
            return res.status(400).json({ success: false, error: 'Название курса обязательно' });
        }

        db.prepare(`
            INSERT INTO courses (
                id, project_id, name, slug, description, short_description, price, compare_price,
                category_id, instructor_id, cover_image, preview_video, duration_hours,
                level, language, what_you_learn, requirements, meta_title, meta_description,
                is_featured, is_visible, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            id, req.params.projectId, name, slug || name.toLowerCase().replace(/\s+/g, '-'),
            description, short_description, price, compare_price, category_id, instructor_id,
            cover_image, preview_video, duration_hours, level || 'beginner', language || 'ru',
            JSON.stringify(what_you_learn || []), JSON.stringify(requirements || []),
            meta_title, meta_description, is_featured ? 1 : 0, is_visible !== false ? 1 : 0,
            status || 'draft'
        );

        const course = db.prepare('SELECT * FROM courses WHERE id = ?').get(id);

        res.json({
            success: true,
            course: {
                ...course,
                what_you_learn: JSON.parse(course.what_you_learn || '[]'),
                requirements: JSON.parse(course.requirements || '[]')
            }
        });
    } catch (error) {
        console.error('Create course error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Update course
router.put('/:projectId/:courseId', (req, res) => {
    try {
        const db = getDb();
        const {
            name, slug, description, short_description, price, compare_price,
            category_id, instructor_id, cover_image, preview_video, duration_hours,
            level, language, what_you_learn, requirements, meta_title, meta_description,
            is_featured, is_visible, status
        } = req.body;

        const wasPublished = db.prepare('SELECT status FROM courses WHERE id = ?').get(req.params.courseId);

        db.prepare(`
            UPDATE courses SET
                name = COALESCE(?, name),
                slug = COALESCE(?, slug),
                description = COALESCE(?, description),
                short_description = COALESCE(?, short_description),
                price = COALESCE(?, price),
                compare_price = COALESCE(?, compare_price),
                category_id = COALESCE(?, category_id),
                instructor_id = COALESCE(?, instructor_id),
                cover_image = COALESCE(?, cover_image),
                preview_video = COALESCE(?, preview_video),
                duration_hours = COALESCE(?, duration_hours),
                level = COALESCE(?, level),
                language = COALESCE(?, language),
                what_you_learn = COALESCE(?, what_you_learn),
                requirements = COALESCE(?, requirements),
                meta_title = COALESCE(?, meta_title),
                meta_description = COALESCE(?, meta_description),
                is_featured = COALESCE(?, is_featured),
                is_visible = COALESCE(?, is_visible),
                status = COALESCE(?, status),
                published_at = CASE WHEN ? = 'published' AND ? != 'published' THEN CURRENT_TIMESTAMP ELSE published_at END,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND project_id = ?
        `).run(
            name, slug, description, short_description, price, compare_price,
            category_id, instructor_id, cover_image, preview_video, duration_hours,
            level, language,
            what_you_learn ? JSON.stringify(what_you_learn) : null,
            requirements ? JSON.stringify(requirements) : null,
            meta_title, meta_description,
            is_featured !== undefined ? (is_featured ? 1 : 0) : null,
            is_visible !== undefined ? (is_visible ? 1 : 0) : null,
            status, status, wasPublished?.status,
            req.params.courseId, req.params.projectId
        );

        // Update lessons count
        const { count } = db.prepare(`
            SELECT COUNT(*) as count FROM course_lessons WHERE course_id = ?
        `).get(req.params.courseId);

        db.prepare('UPDATE courses SET lessons_count = ? WHERE id = ?')
            .run(count, req.params.courseId);

        const course = db.prepare('SELECT * FROM courses WHERE id = ?').get(req.params.courseId);

        res.json({
            success: true,
            course: {
                ...course,
                what_you_learn: JSON.parse(course.what_you_learn || '[]'),
                requirements: JSON.parse(course.requirements || '[]')
            }
        });
    } catch (error) {
        console.error('Update course error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Delete course
router.delete('/:projectId/:courseId', (req, res) => {
    try {
        const db = getDb();
        db.prepare('DELETE FROM courses WHERE id = ? AND project_id = ?')
            .run(req.params.courseId, req.params.projectId);

        res.json({ success: true });
    } catch (error) {
        console.error('Delete course error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================================
// MODULES
// ============================================================

// Add module to course
router.post('/:projectId/:courseId/modules', (req, res) => {
    try {
        const db = getDb();
        const id = uuidv4();
        const { title, description, sort_order, is_free } = req.body;

        // Get max sort order if not provided
        let order = sort_order;
        if (order === undefined) {
            const max = db.prepare('SELECT MAX(sort_order) as max FROM course_modules WHERE course_id = ?')
                .get(req.params.courseId);
            order = (max?.max || 0) + 1;
        }

        db.prepare(`
            INSERT INTO course_modules (id, course_id, title, description, sort_order, is_free)
            VALUES (?, ?, ?, ?, ?, ?)
        `).run(id, req.params.courseId, title, description, order, is_free ? 1 : 0);

        const module = db.prepare('SELECT * FROM course_modules WHERE id = ?').get(id);

        res.json({ success: true, module });
    } catch (error) {
        console.error('Create module error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Update module
router.put('/:projectId/:courseId/modules/:moduleId', (req, res) => {
    try {
        const db = getDb();
        const { title, description, sort_order, is_free } = req.body;

        db.prepare(`
            UPDATE course_modules SET
                title = COALESCE(?, title),
                description = COALESCE(?, description),
                sort_order = COALESCE(?, sort_order),
                is_free = COALESCE(?, is_free)
            WHERE id = ? AND course_id = ?
        `).run(title, description, sort_order, is_free !== undefined ? (is_free ? 1 : 0) : null,
            req.params.moduleId, req.params.courseId);

        const module = db.prepare('SELECT * FROM course_modules WHERE id = ?').get(req.params.moduleId);

        res.json({ success: true, module });
    } catch (error) {
        console.error('Update module error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Delete module
router.delete('/:projectId/:courseId/modules/:moduleId', (req, res) => {
    try {
        const db = getDb();
        db.prepare('DELETE FROM course_modules WHERE id = ? AND course_id = ?')
            .run(req.params.moduleId, req.params.courseId);

        res.json({ success: true });
    } catch (error) {
        console.error('Delete module error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Reorder modules
router.put('/:projectId/:courseId/modules/reorder', (req, res) => {
    try {
        const db = getDb();
        const { modules } = req.body;

        const updateStmt = db.prepare('UPDATE course_modules SET sort_order = ? WHERE id = ?');
        const updateMany = db.transaction((modules) => {
            for (const module of modules) {
                updateStmt.run(module.sort_order, module.id);
            }
        });

        updateMany(modules);

        res.json({ success: true });
    } catch (error) {
        console.error('Reorder modules error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================================
// LESSONS
// ============================================================

// Add lesson to module
router.post('/:projectId/:courseId/modules/:moduleId/lessons', (req, res) => {
    try {
        const db = getDb();
        const id = uuidv4();
        const {
            title, description, content_type, content, video_url, video_duration,
            attachments, sort_order, is_free
        } = req.body;

        // Get max sort order if not provided
        let order = sort_order;
        if (order === undefined) {
            const max = db.prepare('SELECT MAX(sort_order) as max FROM course_lessons WHERE module_id = ?')
                .get(req.params.moduleId);
            order = (max?.max || 0) + 1;
        }

        db.prepare(`
            INSERT INTO course_lessons (
                id, module_id, course_id, title, description, content_type, content,
                video_url, video_duration, attachments, sort_order, is_free
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            id, req.params.moduleId, req.params.courseId, title, description,
            content_type || 'video', content, video_url, video_duration,
            JSON.stringify(attachments || []), order, is_free ? 1 : 0
        );

        // Update course lessons count
        const { count } = db.prepare(`
            SELECT COUNT(*) as count FROM course_lessons WHERE course_id = ?
        `).get(req.params.courseId);

        db.prepare('UPDATE courses SET lessons_count = ? WHERE id = ?')
            .run(count, req.params.courseId);

        const lesson = db.prepare('SELECT * FROM course_lessons WHERE id = ?').get(id);

        res.json({
            success: true,
            lesson: {
                ...lesson,
                attachments: JSON.parse(lesson.attachments || '[]')
            }
        });
    } catch (error) {
        console.error('Create lesson error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Update lesson
router.put('/:projectId/:courseId/lessons/:lessonId', (req, res) => {
    try {
        const db = getDb();
        const {
            title, description, content_type, content, video_url, video_duration,
            attachments, sort_order, is_free
        } = req.body;

        db.prepare(`
            UPDATE course_lessons SET
                title = COALESCE(?, title),
                description = COALESCE(?, description),
                content_type = COALESCE(?, content_type),
                content = COALESCE(?, content),
                video_url = COALESCE(?, video_url),
                video_duration = COALESCE(?, video_duration),
                attachments = COALESCE(?, attachments),
                sort_order = COALESCE(?, sort_order),
                is_free = COALESCE(?, is_free),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND course_id = ?
        `).run(
            title, description, content_type, content, video_url, video_duration,
            attachments ? JSON.stringify(attachments) : null, sort_order,
            is_free !== undefined ? (is_free ? 1 : 0) : null,
            req.params.lessonId, req.params.courseId
        );

        const lesson = db.prepare('SELECT * FROM course_lessons WHERE id = ?').get(req.params.lessonId);

        res.json({
            success: true,
            lesson: {
                ...lesson,
                attachments: JSON.parse(lesson.attachments || '[]')
            }
        });
    } catch (error) {
        console.error('Update lesson error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Delete lesson
router.delete('/:projectId/:courseId/lessons/:lessonId', (req, res) => {
    try {
        const db = getDb();
        db.prepare('DELETE FROM course_lessons WHERE id = ? AND course_id = ?')
            .run(req.params.lessonId, req.params.courseId);

        // Update course lessons count
        const { count } = db.prepare(`
            SELECT COUNT(*) as count FROM course_lessons WHERE course_id = ?
        `).get(req.params.courseId);

        db.prepare('UPDATE courses SET lessons_count = ? WHERE id = ?')
            .run(count, req.params.courseId);

        res.json({ success: true });
    } catch (error) {
        console.error('Delete lesson error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================================
// STUDENT PROGRESS
// ============================================================

// Get student progress
router.get('/:projectId/:courseId/progress/:clientId', (req, res) => {
    try {
        const db = getDb();
        let progress = db.prepare(`
            SELECT * FROM course_progress WHERE course_id = ? AND client_id = ?
        `).get(req.params.courseId, req.params.clientId);

        if (!progress) {
            // Create initial progress
            const id = uuidv4();
            db.prepare(`
                INSERT INTO course_progress (id, course_id, client_id)
                VALUES (?, ?, ?)
            `).run(id, req.params.courseId, req.params.clientId);

            progress = db.prepare('SELECT * FROM course_progress WHERE id = ?').get(id);
        }

        res.json({
            success: true,
            progress: {
                ...progress,
                completed_lessons: JSON.parse(progress.completed_lessons || '[]')
            }
        });
    } catch (error) {
        console.error('Get progress error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Update lesson progress
router.post('/:projectId/:courseId/progress/:clientId/complete/:lessonId', (req, res) => {
    try {
        const db = getDb();
        const { courseId, clientId, lessonId } = req.params;

        let progress = db.prepare(`
            SELECT * FROM course_progress WHERE course_id = ? AND client_id = ?
        `).get(courseId, clientId);

        if (!progress) {
            const id = uuidv4();
            db.prepare(`
                INSERT INTO course_progress (id, course_id, client_id, started_at)
                VALUES (?, ?, ?, CURRENT_TIMESTAMP)
            `).run(id, courseId, clientId);

            progress = db.prepare('SELECT * FROM course_progress WHERE id = ?').get(id);
        }

        const completedLessons = JSON.parse(progress.completed_lessons || '[]');
        if (!completedLessons.includes(lessonId)) {
            completedLessons.push(lessonId);
        }

        // Calculate progress percent
        const { total } = db.prepare('SELECT COUNT(*) as total FROM course_lessons WHERE course_id = ?')
            .get(courseId);
        const progressPercent = Math.round((completedLessons.length / total) * 100);

        const isCompleted = progressPercent >= 100;

        db.prepare(`
            UPDATE course_progress SET
                completed_lessons = ?,
                last_lesson_id = ?,
                progress_percent = ?,
                status = CASE WHEN ? >= 100 THEN 'completed' ELSE 'in_progress' END,
                completed_at = CASE WHEN ? >= 100 AND completed_at IS NULL THEN CURRENT_TIMESTAMP ELSE completed_at END
            WHERE course_id = ? AND client_id = ?
        `).run(
            JSON.stringify(completedLessons), lessonId, progressPercent,
            progressPercent, progressPercent, courseId, clientId
        );

        // Update course students count if just started
        if (completedLessons.length === 1) {
            db.prepare('UPDATE courses SET students_count = students_count + 1 WHERE id = ?')
                .run(courseId);
        }

        const updatedProgress = db.prepare(`
            SELECT * FROM course_progress WHERE course_id = ? AND client_id = ?
        `).get(courseId, clientId);

        res.json({
            success: true,
            progress: {
                ...updatedProgress,
                completed_lessons: JSON.parse(updatedProgress.completed_lessons || '[]')
            },
            is_completed: isCompleted
        });
    } catch (error) {
        console.error('Complete lesson error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Issue certificate
router.post('/:projectId/:courseId/progress/:clientId/certificate', (req, res) => {
    try {
        const db = getDb();
        const { certificate_url } = req.body;

        db.prepare(`
            UPDATE course_progress SET
                certificate_issued = 1,
                certificate_url = ?
            WHERE course_id = ? AND client_id = ?
        `).run(certificate_url, req.params.courseId, req.params.clientId);

        const progress = db.prepare(`
            SELECT * FROM course_progress WHERE course_id = ? AND client_id = ?
        `).get(req.params.courseId, req.params.clientId);

        res.json({
            success: true,
            progress: {
                ...progress,
                completed_lessons: JSON.parse(progress.completed_lessons || '[]')
            }
        });
    } catch (error) {
        console.error('Issue certificate error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;

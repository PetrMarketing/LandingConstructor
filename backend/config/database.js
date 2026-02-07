const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const config = require('./config');

// Database instance (lazy initialization)
let db = null;

function getDb() {
    if (db) return db;

    // Ensure data directory exists
    const dataDir = path.dirname(config.DB_PATH);
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }

    // Initialize database
    db = new Database(config.DB_PATH);

    // Enable foreign keys
    db.pragma('foreign_keys = ON');

    return db;
}

// Initialize tables
function initDatabase() {
    const db = getDb();
    // Users table
    db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            name TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'client',
            avatar TEXT,
            phone TEXT,
            is_active INTEGER DEFAULT 1,
            email_verified INTEGER DEFAULT 0,
            last_login TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Refresh tokens table
    db.exec(`
        CREATE TABLE IF NOT EXISTS refresh_tokens (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            token TEXT NOT NULL,
            expires_at TEXT NOT NULL,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    `);

    // Projects table
    db.exec(`
        CREATE TABLE IF NOT EXISTS projects (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT,
            domain TEXT,
            owner_id TEXT NOT NULL,
            settings TEXT DEFAULT '{}',
            is_active INTEGER DEFAULT 1,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
        )
    `);

    // Project members table (for multi-user access)
    db.exec(`
        CREATE TABLE IF NOT EXISTS project_members (
            id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL,
            user_id TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'editor',
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            UNIQUE(project_id, user_id)
        )
    `);

    // Folders table
    db.exec(`
        CREATE TABLE IF NOT EXISTS folders (
            id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL,
            parent_id TEXT,
            name TEXT NOT NULL,
            type TEXT DEFAULT 'pages',
            sort_order INTEGER DEFAULT 0,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
            FOREIGN KEY (parent_id) REFERENCES folders(id) ON DELETE CASCADE
        )
    `);

    // Pages table
    db.exec(`
        CREATE TABLE IF NOT EXISTS pages (
            id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL,
            folder_id TEXT,
            name TEXT NOT NULL,
            slug TEXT,
            content TEXT DEFAULT '{}',
            meta TEXT DEFAULT '{}',
            status TEXT DEFAULT 'draft',
            created_by TEXT,
            updated_by TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
            FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE SET NULL,
            FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
            FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
        )
    `);

    // Landings table
    db.exec(`
        CREATE TABLE IF NOT EXISTS landings (
            id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL,
            name TEXT NOT NULL,
            slug TEXT,
            template TEXT,
            elements TEXT DEFAULT '[]',
            meta TEXT DEFAULT '{}',
            settings TEXT DEFAULT '{}',
            status TEXT DEFAULT 'draft',
            views INTEGER DEFAULT 0,
            created_by TEXT,
            updated_by TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
            FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
            FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
        )
    `);

    // Products table
    db.exec(`
        CREATE TABLE IF NOT EXISTS products (
            id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL,
            type TEXT DEFAULT 'product',
            name TEXT NOT NULL,
            description TEXT,
            sku TEXT,
            price REAL DEFAULT 0,
            old_price REAL,
            currency TEXT DEFAULT 'RUB',
            images TEXT DEFAULT '[]',
            category_id TEXT,
            stock INTEGER DEFAULT 0,
            is_active INTEGER DEFAULT 1,
            attributes TEXT DEFAULT '{}',
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
        )
    `);

    // Categories table
    db.exec(`
        CREATE TABLE IF NOT EXISTS categories (
            id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL,
            parent_id TEXT,
            name TEXT NOT NULL,
            slug TEXT,
            description TEXT,
            image TEXT,
            sort_order INTEGER DEFAULT 0,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
            FOREIGN KEY (parent_id) REFERENCES categories(id) ON DELETE CASCADE
        )
    `);

    // Orders table
    db.exec(`
        CREATE TABLE IF NOT EXISTS orders (
            id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL,
            order_number TEXT NOT NULL,
            customer_id TEXT,
            customer_name TEXT,
            customer_email TEXT,
            customer_phone TEXT,
            items TEXT DEFAULT '[]',
            subtotal REAL DEFAULT 0,
            discount REAL DEFAULT 0,
            shipping REAL DEFAULT 0,
            total REAL DEFAULT 0,
            currency TEXT DEFAULT 'RUB',
            status TEXT DEFAULT 'pending',
            payment_status TEXT DEFAULT 'pending',
            payment_method TEXT,
            shipping_method TEXT,
            shipping_address TEXT DEFAULT '{}',
            notes TEXT,
            source TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
            FOREIGN KEY (customer_id) REFERENCES users(id) ON DELETE SET NULL
        )
    `);

    // Form submissions table (leads from landings)
    db.exec(`
        CREATE TABLE IF NOT EXISTS submissions (
            id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL,
            landing_id TEXT,
            form_name TEXT,
            data TEXT DEFAULT '{}',
            status TEXT DEFAULT 'new',
            source_url TEXT,
            ip_address TEXT,
            user_agent TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
            FOREIGN KEY (landing_id) REFERENCES landings(id) ON DELETE SET NULL
        )
    `);

    // Files/Media table
    db.exec(`
        CREATE TABLE IF NOT EXISTS files (
            id TEXT PRIMARY KEY,
            project_id TEXT,
            user_id TEXT,
            filename TEXT NOT NULL,
            original_name TEXT NOT NULL,
            mime_type TEXT,
            size INTEGER,
            path TEXT NOT NULL,
            url TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
        )
    `);

    // Activity log table
    db.exec(`
        CREATE TABLE IF NOT EXISTS activity_log (
            id TEXT PRIMARY KEY,
            user_id TEXT,
            project_id TEXT,
            action TEXT NOT NULL,
            entity_type TEXT,
            entity_id TEXT,
            details TEXT DEFAULT '{}',
            ip_address TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
        )
    `);

    // Create indexes
    db.exec(`
        CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
        CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id);
        CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token ON refresh_tokens(token);
        CREATE INDEX IF NOT EXISTS idx_projects_owner ON projects(owner_id);
        CREATE INDEX IF NOT EXISTS idx_project_members_project ON project_members(project_id);
        CREATE INDEX IF NOT EXISTS idx_project_members_user ON project_members(user_id);
        CREATE INDEX IF NOT EXISTS idx_pages_project ON pages(project_id);
        CREATE INDEX IF NOT EXISTS idx_landings_project ON landings(project_id);
        CREATE INDEX IF NOT EXISTS idx_products_project ON products(project_id);
        CREATE INDEX IF NOT EXISTS idx_orders_project ON orders(project_id);
        CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);
        CREATE INDEX IF NOT EXISTS idx_submissions_project ON submissions(project_id);
        CREATE INDEX IF NOT EXISTS idx_activity_log_user ON activity_log(user_id);
        CREATE INDEX IF NOT EXISTS idx_activity_log_project ON activity_log(project_id);
    `);

    // Create CMS extension tables
    createCMSTables(db);

    console.log('Database initialized successfully');
}

// ============================================================
// CMS EXTENSION TABLES
// ============================================================
function createCMSTables(db) {
    // ============================================================
    // РАЗДЕЛ 1: САЙТ (расширение существующих таблиц)
    // ============================================================

    // Темы оформления
    db.exec(`
        CREATE TABLE IF NOT EXISTS themes (
            id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL,
            name TEXT NOT NULL,
            slug TEXT NOT NULL,
            description TEXT,
            colors TEXT DEFAULT '{}',
            fonts TEXT DEFAULT '{}',
            css_custom TEXT,
            is_active INTEGER DEFAULT 0,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
            UNIQUE(project_id, slug)
        )
    `);

    // Блоки контента страницы (конструктор)
    db.exec(`
        CREATE TABLE IF NOT EXISTS page_blocks (
            id TEXT PRIMARY KEY,
            page_id TEXT NOT NULL,
            block_type TEXT NOT NULL,
            title TEXT,
            content TEXT DEFAULT '{}',
            settings TEXT DEFAULT '{}',
            sort_order INTEGER DEFAULT 0,
            is_visible INTEGER DEFAULT 1,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (page_id) REFERENCES pages(id) ON DELETE CASCADE
        )
    `);

    // Меню навигации
    db.exec(`
        CREATE TABLE IF NOT EXISTS menus (
            id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL,
            name TEXT NOT NULL,
            slug TEXT NOT NULL,
            items TEXT DEFAULT '[]',
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
            UNIQUE(project_id, slug)
        )
    `);

    // Формы (конфигурация)
    db.exec(`
        CREATE TABLE IF NOT EXISTS forms (
            id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL,
            name TEXT NOT NULL,
            slug TEXT NOT NULL,
            fields TEXT DEFAULT '[]',
            settings TEXT DEFAULT '{}',
            success_message TEXT,
            notifications TEXT DEFAULT '[]',
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
            UNIQUE(project_id, slug)
        )
    `);

    // SEO редиректы
    db.exec(`
        CREATE TABLE IF NOT EXISTS redirects (
            id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL,
            from_url TEXT NOT NULL,
            to_url TEXT NOT NULL,
            type INTEGER DEFAULT 301,
            is_active INTEGER DEFAULT 1,
            hits INTEGER DEFAULT 0,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
        )
    `);

    // ============================================================
    // РАЗДЕЛ 2: КЛИЕНТЫ (CRM)
    // ============================================================

    // Клиенты
    db.exec(`
        CREATE TABLE IF NOT EXISTS clients (
            id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL,
            user_id TEXT,
            email TEXT,
            phone TEXT,
            first_name TEXT,
            last_name TEXT,
            middle_name TEXT,
            company TEXT,
            position TEXT,
            telegram_id TEXT,
            telegram_username TEXT,
            avatar_url TEXT,
            source TEXT,
            utm_source TEXT,
            utm_medium TEXT,
            utm_campaign TEXT,
            tags TEXT DEFAULT '[]',
            custom_fields TEXT DEFAULT '{}',
            notes TEXT,
            total_orders INTEGER DEFAULT 0,
            total_spent REAL DEFAULT 0,
            last_order_at TEXT,
            loyalty_points INTEGER DEFAULT 0,
            loyalty_level TEXT,
            is_subscribed INTEGER DEFAULT 1,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
        )
    `);

    // Сегменты клиентов
    db.exec(`
        CREATE TABLE IF NOT EXISTS client_segments (
            id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL,
            name TEXT NOT NULL,
            slug TEXT NOT NULL,
            description TEXT,
            conditions TEXT DEFAULT '[]',
            color TEXT,
            is_dynamic INTEGER DEFAULT 1,
            client_count INTEGER DEFAULT 0,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
            UNIQUE(project_id, slug)
        )
    `);

    // Связь клиент-сегмент
    db.exec(`
        CREATE TABLE IF NOT EXISTS client_segment_members (
            client_id TEXT NOT NULL,
            segment_id TEXT NOT NULL,
            added_at TEXT DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (client_id, segment_id),
            FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
            FOREIGN KEY (segment_id) REFERENCES client_segments(id) ON DELETE CASCADE
        )
    `);

    // История взаимодействий с клиентом
    db.exec(`
        CREATE TABLE IF NOT EXISTS client_interactions (
            id TEXT PRIMARY KEY,
            client_id TEXT NOT NULL,
            type TEXT NOT NULL,
            direction TEXT,
            subject TEXT,
            content TEXT,
            result TEXT,
            employee_id TEXT,
            deal_id TEXT,
            duration INTEGER,
            scheduled_at TEXT,
            completed_at TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
            FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE SET NULL,
            FOREIGN KEY (deal_id) REFERENCES deals(id) ON DELETE SET NULL
        )
    `);

    // Программа лояльности - транзакции баллов
    db.exec(`
        CREATE TABLE IF NOT EXISTS loyalty_transactions (
            id TEXT PRIMARY KEY,
            client_id TEXT NOT NULL,
            points INTEGER NOT NULL,
            type TEXT NOT NULL,
            description TEXT,
            order_id TEXT,
            employee_id TEXT,
            expires_at TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
            FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL,
            FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE SET NULL
        )
    `);

    // ============================================================
    // РАЗДЕЛ 3: КАТАЛОГ (расширение products)
    // ============================================================

    // Варианты товаров (размеры, цвета)
    db.exec(`
        CREATE TABLE IF NOT EXISTS product_variants (
            id TEXT PRIMARY KEY,
            product_id TEXT NOT NULL,
            sku TEXT,
            name TEXT,
            attributes TEXT DEFAULT '{}',
            price REAL,
            compare_price REAL,
            stock_quantity INTEGER DEFAULT 0,
            image_url TEXT,
            is_default INTEGER DEFAULT 0,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
        )
    `);

    // Услуги
    db.exec(`
        CREATE TABLE IF NOT EXISTS services (
            id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL,
            name TEXT NOT NULL,
            slug TEXT NOT NULL,
            description TEXT,
            short_description TEXT,
            price REAL,
            price_from REAL,
            price_to REAL,
            duration INTEGER,
            category_id TEXT,
            images TEXT DEFAULT '[]',
            features TEXT DEFAULT '[]',
            meta_title TEXT,
            meta_description TEXT,
            is_featured INTEGER DEFAULT 0,
            is_visible INTEGER DEFAULT 1,
            sort_order INTEGER DEFAULT 0,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
            FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
            UNIQUE(project_id, slug)
        )
    `);

    // Онлайн-курсы
    db.exec(`
        CREATE TABLE IF NOT EXISTS courses (
            id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL,
            name TEXT NOT NULL,
            slug TEXT NOT NULL,
            description TEXT,
            short_description TEXT,
            price REAL,
            compare_price REAL,
            category_id TEXT,
            instructor_id TEXT,
            cover_image TEXT,
            preview_video TEXT,
            duration_hours INTEGER,
            lessons_count INTEGER DEFAULT 0,
            level TEXT,
            language TEXT DEFAULT 'ru',
            certificate_template TEXT,
            what_you_learn TEXT DEFAULT '[]',
            requirements TEXT DEFAULT '[]',
            meta_title TEXT,
            meta_description TEXT,
            is_featured INTEGER DEFAULT 0,
            is_visible INTEGER DEFAULT 1,
            status TEXT DEFAULT 'draft',
            students_count INTEGER DEFAULT 0,
            rating REAL DEFAULT 0,
            reviews_count INTEGER DEFAULT 0,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
            published_at TEXT,
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
            FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
            FOREIGN KEY (instructor_id) REFERENCES employees(id) ON DELETE SET NULL,
            UNIQUE(project_id, slug)
        )
    `);

    // Модули курса
    db.exec(`
        CREATE TABLE IF NOT EXISTS course_modules (
            id TEXT PRIMARY KEY,
            course_id TEXT NOT NULL,
            title TEXT NOT NULL,
            description TEXT,
            sort_order INTEGER DEFAULT 0,
            is_free INTEGER DEFAULT 0,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
        )
    `);

    // Уроки курса
    db.exec(`
        CREATE TABLE IF NOT EXISTS course_lessons (
            id TEXT PRIMARY KEY,
            module_id TEXT NOT NULL,
            course_id TEXT NOT NULL,
            title TEXT NOT NULL,
            description TEXT,
            content_type TEXT,
            content TEXT,
            video_url TEXT,
            video_duration INTEGER,
            attachments TEXT DEFAULT '[]',
            sort_order INTEGER DEFAULT 0,
            is_free INTEGER DEFAULT 0,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (module_id) REFERENCES course_modules(id) ON DELETE CASCADE,
            FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
        )
    `);

    // Прогресс студента по курсу
    db.exec(`
        CREATE TABLE IF NOT EXISTS course_progress (
            id TEXT PRIMARY KEY,
            course_id TEXT NOT NULL,
            client_id TEXT NOT NULL,
            status TEXT DEFAULT 'not_started',
            progress_percent INTEGER DEFAULT 0,
            last_lesson_id TEXT,
            completed_lessons TEXT DEFAULT '[]',
            started_at TEXT,
            completed_at TEXT,
            certificate_issued INTEGER DEFAULT 0,
            certificate_url TEXT,
            FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
            FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
            FOREIGN KEY (last_lesson_id) REFERENCES course_lessons(id) ON DELETE SET NULL,
            UNIQUE(course_id, client_id)
        )
    `);

    // Отзывы (универсальные)
    db.exec(`
        CREATE TABLE IF NOT EXISTS reviews (
            id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL,
            entity_type TEXT NOT NULL,
            entity_id TEXT NOT NULL,
            client_id TEXT,
            rating INTEGER NOT NULL,
            title TEXT,
            content TEXT,
            pros TEXT,
            cons TEXT,
            images TEXT DEFAULT '[]',
            is_verified INTEGER DEFAULT 0,
            is_approved INTEGER DEFAULT 0,
            admin_reply TEXT,
            admin_reply_at TEXT,
            helpful_count INTEGER DEFAULT 0,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
            FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL
        )
    `);

    // ============================================================
    // РАЗДЕЛ 4: СОТРУДНИКИ
    // ============================================================

    // Сотрудники
    db.exec(`
        CREATE TABLE IF NOT EXISTS employees (
            id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL,
            user_id TEXT,
            email TEXT NOT NULL,
            first_name TEXT NOT NULL,
            last_name TEXT NOT NULL,
            middle_name TEXT,
            phone TEXT,
            avatar_url TEXT,
            position TEXT,
            department TEXT,
            role TEXT DEFAULT 'manager',
            permissions TEXT DEFAULT '{}',
            telegram_id TEXT,
            is_active INTEGER DEFAULT 1,
            last_login_at TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
        )
    `);

    // Задачи сотрудников
    db.exec(`
        CREATE TABLE IF NOT EXISTS tasks (
            id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL,
            title TEXT NOT NULL,
            description TEXT,
            assignee_id TEXT,
            creator_id TEXT,
            client_id TEXT,
            deal_id TEXT,
            order_id TEXT,
            priority TEXT DEFAULT 'normal',
            status TEXT DEFAULT 'pending',
            due_date TEXT,
            completed_at TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
            FOREIGN KEY (assignee_id) REFERENCES employees(id) ON DELETE SET NULL,
            FOREIGN KEY (creator_id) REFERENCES employees(id) ON DELETE SET NULL,
            FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL,
            FOREIGN KEY (deal_id) REFERENCES deals(id) ON DELETE SET NULL,
            FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL
        )
    `);

    // ============================================================
    // РАЗДЕЛ 5: CRM (Воронки и сделки)
    // ============================================================

    // Воронки продаж
    db.exec(`
        CREATE TABLE IF NOT EXISTS funnels (
            id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL,
            name TEXT NOT NULL,
            slug TEXT NOT NULL,
            description TEXT,
            is_default INTEGER DEFAULT 0,
            is_active INTEGER DEFAULT 1,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
            UNIQUE(project_id, slug)
        )
    `);

    // Этапы воронки
    db.exec(`
        CREATE TABLE IF NOT EXISTS funnel_stages (
            id TEXT PRIMARY KEY,
            funnel_id TEXT NOT NULL,
            name TEXT NOT NULL,
            color TEXT,
            sort_order INTEGER DEFAULT 0,
            is_won INTEGER DEFAULT 0,
            is_lost INTEGER DEFAULT 0,
            auto_actions TEXT DEFAULT '[]',
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (funnel_id) REFERENCES funnels(id) ON DELETE CASCADE
        )
    `);

    // Сделки
    db.exec(`
        CREATE TABLE IF NOT EXISTS deals (
            id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL,
            name TEXT NOT NULL,
            client_id TEXT,
            funnel_id TEXT,
            stage_id TEXT,
            amount REAL DEFAULT 0,
            currency TEXT DEFAULT 'RUB',
            probability INTEGER DEFAULT 50,
            expected_close_date TEXT,
            assigned_to TEXT,
            source TEXT,
            utm_source TEXT,
            utm_medium TEXT,
            utm_campaign TEXT,
            tags TEXT DEFAULT '[]',
            custom_fields TEXT DEFAULT '{}',
            notes TEXT,
            lost_reason TEXT,
            won_at TEXT,
            lost_at TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
            FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL,
            FOREIGN KEY (funnel_id) REFERENCES funnels(id) ON DELETE SET NULL,
            FOREIGN KEY (stage_id) REFERENCES funnel_stages(id) ON DELETE SET NULL,
            FOREIGN KEY (assigned_to) REFERENCES employees(id) ON DELETE SET NULL
        )
    `);

    // История перемещения сделки по этапам
    db.exec(`
        CREATE TABLE IF NOT EXISTS deal_stage_history (
            id TEXT PRIMARY KEY,
            deal_id TEXT NOT NULL,
            from_stage_id TEXT,
            to_stage_id TEXT,
            employee_id TEXT,
            comment TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (deal_id) REFERENCES deals(id) ON DELETE CASCADE,
            FOREIGN KEY (from_stage_id) REFERENCES funnel_stages(id) ON DELETE SET NULL,
            FOREIGN KEY (to_stage_id) REFERENCES funnel_stages(id) ON DELETE SET NULL,
            FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE SET NULL
        )
    `);

    // Автоматизации CRM
    db.exec(`
        CREATE TABLE IF NOT EXISTS automations (
            id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL,
            name TEXT NOT NULL,
            trigger_type TEXT NOT NULL,
            trigger_config TEXT DEFAULT '{}',
            action_type TEXT NOT NULL,
            action_config TEXT DEFAULT '{}',
            is_active INTEGER DEFAULT 1,
            executions_count INTEGER DEFAULT 0,
            last_executed_at TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
        )
    `);

    // ============================================================
    // РАЗДЕЛ 6: ЗАКАЗЫ (расширение orders)
    // ============================================================

    // Позиции заказа
    db.exec(`
        CREATE TABLE IF NOT EXISTS order_items (
            id TEXT PRIMARY KEY,
            order_id TEXT NOT NULL,
            item_type TEXT DEFAULT 'product',
            item_id TEXT,
            variant_id TEXT,
            name TEXT NOT NULL,
            sku TEXT,
            quantity INTEGER DEFAULT 1,
            price REAL NOT NULL,
            discount_amount REAL DEFAULT 0,
            total REAL NOT NULL,
            attributes TEXT DEFAULT '{}',
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
            FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE SET NULL
        )
    `);

    // История статусов заказа
    db.exec(`
        CREATE TABLE IF NOT EXISTS order_status_history (
            id TEXT PRIMARY KEY,
            order_id TEXT NOT NULL,
            from_status TEXT,
            to_status TEXT NOT NULL,
            employee_id TEXT,
            comment TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
            FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE SET NULL
        )
    `);

    // Платежи
    db.exec(`
        CREATE TABLE IF NOT EXISTS payments (
            id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL,
            order_id TEXT,
            client_id TEXT,
            amount REAL NOT NULL,
            currency TEXT DEFAULT 'RUB',
            method TEXT,
            status TEXT DEFAULT 'pending',
            external_id TEXT,
            external_data TEXT DEFAULT '{}',
            refunded_amount REAL DEFAULT 0,
            paid_at TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
            FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL,
            FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL
        )
    `);

    // Возвраты
    db.exec(`
        CREATE TABLE IF NOT EXISTS refunds (
            id TEXT PRIMARY KEY,
            order_id TEXT NOT NULL,
            payment_id TEXT,
            amount REAL NOT NULL,
            reason TEXT,
            status TEXT DEFAULT 'pending',
            items TEXT DEFAULT '[]',
            employee_id TEXT,
            approved_by TEXT,
            approved_at TEXT,
            completed_at TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
            FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE SET NULL,
            FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE SET NULL,
            FOREIGN KEY (approved_by) REFERENCES employees(id) ON DELETE SET NULL
        )
    `);

    // Способы доставки
    db.exec(`
        CREATE TABLE IF NOT EXISTS shipping_methods (
            id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL,
            name TEXT NOT NULL,
            slug TEXT NOT NULL,
            description TEXT,
            price REAL DEFAULT 0,
            free_from REAL,
            estimated_days TEXT,
            is_active INTEGER DEFAULT 1,
            sort_order INTEGER DEFAULT 0,
            settings TEXT DEFAULT '{}',
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
            UNIQUE(project_id, slug)
        )
    `);

    // Способы оплаты
    db.exec(`
        CREATE TABLE IF NOT EXISTS payment_methods (
            id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL,
            name TEXT NOT NULL,
            slug TEXT NOT NULL,
            description TEXT,
            type TEXT,
            provider TEXT,
            is_active INTEGER DEFAULT 1,
            sort_order INTEGER DEFAULT 0,
            settings TEXT DEFAULT '{}',
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
            UNIQUE(project_id, slug)
        )
    `);

    // ============================================================
    // ОБЩИЕ ТАБЛИЦЫ
    // ============================================================

    // Уведомления
    db.exec(`
        CREATE TABLE IF NOT EXISTS notifications (
            id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL,
            recipient_type TEXT NOT NULL,
            recipient_id TEXT NOT NULL,
            type TEXT NOT NULL,
            title TEXT NOT NULL,
            message TEXT,
            link TEXT,
            data TEXT DEFAULT '{}',
            is_read INTEGER DEFAULT 0,
            read_at TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
        )
    `);

    // Настройки проекта (расширенные)
    db.exec(`
        CREATE TABLE IF NOT EXISTS project_settings (
            id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL,
            key TEXT NOT NULL,
            value TEXT,
            type TEXT DEFAULT 'string',
            group_name TEXT DEFAULT 'general',
            description TEXT,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
            UNIQUE(project_id, key)
        )
    `);

    // Email шаблоны
    db.exec(`
        CREATE TABLE IF NOT EXISTS email_templates (
            id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL,
            name TEXT NOT NULL,
            slug TEXT NOT NULL,
            subject TEXT NOT NULL,
            body_html TEXT,
            body_text TEXT,
            variables TEXT DEFAULT '[]',
            is_active INTEGER DEFAULT 1,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
            UNIQUE(project_id, slug)
        )
    `);

    // ============================================================
    // E-COMMERCE EXTENSIONS (InSales-like features)
    // ============================================================

    // Бренды/производители
    db.exec(`
        CREATE TABLE IF NOT EXISTS brands (
            id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL,
            name TEXT NOT NULL,
            slug TEXT,
            logo TEXT,
            description TEXT,
            website TEXT,
            is_active INTEGER DEFAULT 1,
            sort_order INTEGER DEFAULT 0,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
        )
    `);

    // Промокоды и скидки
    db.exec(`
        CREATE TABLE IF NOT EXISTS promo_codes (
            id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL,
            code TEXT NOT NULL,
            type TEXT DEFAULT 'percent',
            value REAL NOT NULL,
            min_order_amount REAL DEFAULT 0,
            max_uses INTEGER,
            uses_count INTEGER DEFAULT 0,
            per_client_limit INTEGER DEFAULT 1,
            applies_to TEXT DEFAULT 'all',
            product_ids TEXT DEFAULT '[]',
            category_ids TEXT DEFAULT '[]',
            start_date TEXT,
            end_date TEXT,
            is_active INTEGER DEFAULT 1,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
            UNIQUE(project_id, code)
        )
    `);

    // Использование промокодов
    db.exec(`
        CREATE TABLE IF NOT EXISTS promo_code_uses (
            id TEXT PRIMARY KEY,
            promo_code_id TEXT NOT NULL,
            order_id TEXT,
            client_id TEXT,
            discount_amount REAL,
            used_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (promo_code_id) REFERENCES promo_codes(id) ON DELETE CASCADE
        )
    `);

    // Связанные товары (upsells, cross-sells)
    db.exec(`
        CREATE TABLE IF NOT EXISTS related_products (
            id TEXT PRIMARY KEY,
            product_id TEXT NOT NULL,
            related_product_id TEXT NOT NULL,
            relation_type TEXT DEFAULT 'related',
            sort_order INTEGER DEFAULT 0,
            FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
            FOREIGN KEY (related_product_id) REFERENCES products(id) ON DELETE CASCADE,
            UNIQUE(product_id, related_product_id, relation_type)
        )
    `);

    // Коллекции товаров (подборки)
    db.exec(`
        CREATE TABLE IF NOT EXISTS collections (
            id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL,
            name TEXT NOT NULL,
            slug TEXT,
            description TEXT,
            image TEXT,
            type TEXT DEFAULT 'manual',
            rules TEXT DEFAULT '[]',
            is_active INTEGER DEFAULT 1,
            sort_order INTEGER DEFAULT 0,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
        )
    `);

    // Товары в коллекциях
    db.exec(`
        CREATE TABLE IF NOT EXISTS collection_products (
            id TEXT PRIMARY KEY,
            collection_id TEXT NOT NULL,
            product_id TEXT NOT NULL,
            sort_order INTEGER DEFAULT 0,
            FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE,
            FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
            UNIQUE(collection_id, product_id)
        )
    `);

    // Уведомления о низком остатке
    db.exec(`
        CREATE TABLE IF NOT EXISTS stock_alerts (
            id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL,
            product_id TEXT NOT NULL,
            variant_id TEXT,
            threshold INTEGER DEFAULT 5,
            is_active INTEGER DEFAULT 1,
            last_alert_at TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
            FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
        )
    `);

    // ============================================================
    // BOOKING SYSTEM (YClients-like features)
    // ============================================================

    // Расписание сотрудников
    db.exec(`
        CREATE TABLE IF NOT EXISTS employee_schedules (
            id TEXT PRIMARY KEY,
            employee_id TEXT NOT NULL,
            day_of_week INTEGER NOT NULL,
            start_time TEXT NOT NULL,
            end_time TEXT NOT NULL,
            is_working INTEGER DEFAULT 1,
            break_start TEXT,
            break_end TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
            UNIQUE(employee_id, day_of_week)
        )
    `);

    // Записи на услуги
    db.exec(`
        CREATE TABLE IF NOT EXISTS bookings (
            id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL,
            client_id TEXT,
            employee_id TEXT,
            service_id TEXT NOT NULL,
            booking_date TEXT NOT NULL,
            start_time TEXT NOT NULL,
            end_time TEXT NOT NULL,
            status TEXT DEFAULT 'pending',
            client_name TEXT,
            client_phone TEXT,
            client_email TEXT,
            comment TEXT,
            source TEXT DEFAULT 'website',
            price REAL,
            paid_amount REAL DEFAULT 0,
            cancelled_reason TEXT,
            reminder_sent INTEGER DEFAULT 0,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
            FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL,
            FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE SET NULL,
            FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE
        )
    `);

    // Напоминания о записи
    db.exec(`
        CREATE TABLE IF NOT EXISTS booking_reminders (
            id TEXT PRIMARY KEY,
            booking_id TEXT NOT NULL,
            type TEXT DEFAULT 'sms',
            send_at TEXT NOT NULL,
            message TEXT,
            status TEXT DEFAULT 'pending',
            sent_at TEXT,
            error TEXT,
            FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE
        )
    `);

    // Исключения в расписании (отпуск, больничный)
    db.exec(`
        CREATE TABLE IF NOT EXISTS schedule_exceptions (
            id TEXT PRIMARY KEY,
            employee_id TEXT NOT NULL,
            date TEXT NOT NULL,
            type TEXT DEFAULT 'day_off',
            reason TEXT,
            start_time TEXT,
            end_time TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
        )
    `);

    // История посещений клиента
    db.exec(`
        CREATE TABLE IF NOT EXISTS client_visits (
            id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL,
            client_id TEXT NOT NULL,
            booking_id TEXT,
            service_id TEXT,
            employee_id TEXT,
            visit_date TEXT NOT NULL,
            status TEXT DEFAULT 'completed',
            notes TEXT,
            rating INTEGER,
            feedback TEXT,
            amount_paid REAL,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
            FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
        )
    `);

    // Расширение таблицы products (миграция)
    try {
        db.exec(`ALTER TABLE products ADD COLUMN brand_id TEXT`);
    } catch (e) { /* column exists */ }
    try {
        db.exec(`ALTER TABLE products ADD COLUMN meta_title TEXT`);
    } catch (e) { /* column exists */ }
    try {
        db.exec(`ALTER TABLE products ADD COLUMN meta_description TEXT`);
    } catch (e) { /* column exists */ }
    try {
        db.exec(`ALTER TABLE products ADD COLUMN url_slug TEXT`);
    } catch (e) { /* column exists */ }
    try {
        db.exec(`ALTER TABLE products ADD COLUMN weight REAL`);
    } catch (e) { /* column exists */ }
    try {
        db.exec(`ALTER TABLE products ADD COLUMN length REAL`);
    } catch (e) { /* column exists */ }
    try {
        db.exec(`ALTER TABLE products ADD COLUMN width REAL`);
    } catch (e) { /* column exists */ }
    try {
        db.exec(`ALTER TABLE products ADD COLUMN height REAL`);
    } catch (e) { /* column exists */ }
    try {
        db.exec(`ALTER TABLE products ADD COLUMN cost_price REAL`);
    } catch (e) { /* column exists */ }
    try {
        db.exec(`ALTER TABLE products ADD COLUMN barcode TEXT`);
    } catch (e) { /* column exists */ }
    try {
        db.exec(`ALTER TABLE products ADD COLUMN min_stock_alert INTEGER DEFAULT 5`);
    } catch (e) { /* column exists */ }

    // ============================================================
    // INDEXES FOR CMS TABLES
    // ============================================================
    db.exec(`
        CREATE INDEX IF NOT EXISTS idx_themes_project ON themes(project_id);
        CREATE INDEX IF NOT EXISTS idx_page_blocks_page ON page_blocks(page_id);
        CREATE INDEX IF NOT EXISTS idx_menus_project ON menus(project_id);
        CREATE INDEX IF NOT EXISTS idx_forms_project ON forms(project_id);
        CREATE INDEX IF NOT EXISTS idx_redirects_project ON redirects(project_id);

        CREATE INDEX IF NOT EXISTS idx_clients_project ON clients(project_id);
        CREATE INDEX IF NOT EXISTS idx_clients_email ON clients(email);
        CREATE INDEX IF NOT EXISTS idx_clients_phone ON clients(phone);
        CREATE INDEX IF NOT EXISTS idx_client_segments_project ON client_segments(project_id);
        CREATE INDEX IF NOT EXISTS idx_client_interactions_client ON client_interactions(client_id);
        CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_client ON loyalty_transactions(client_id);

        CREATE INDEX IF NOT EXISTS idx_product_variants_product ON product_variants(product_id);
        CREATE INDEX IF NOT EXISTS idx_services_project ON services(project_id);
        CREATE INDEX IF NOT EXISTS idx_services_category ON services(category_id);
        CREATE INDEX IF NOT EXISTS idx_courses_project ON courses(project_id);
        CREATE INDEX IF NOT EXISTS idx_courses_category ON courses(category_id);
        CREATE INDEX IF NOT EXISTS idx_course_modules_course ON course_modules(course_id);
        CREATE INDEX IF NOT EXISTS idx_course_lessons_module ON course_lessons(module_id);
        CREATE INDEX IF NOT EXISTS idx_course_lessons_course ON course_lessons(course_id);
        CREATE INDEX IF NOT EXISTS idx_course_progress_course ON course_progress(course_id);
        CREATE INDEX IF NOT EXISTS idx_course_progress_client ON course_progress(client_id);
        CREATE INDEX IF NOT EXISTS idx_reviews_project ON reviews(project_id);
        CREATE INDEX IF NOT EXISTS idx_reviews_entity ON reviews(entity_type, entity_id);

        CREATE INDEX IF NOT EXISTS idx_employees_project ON employees(project_id);
        CREATE INDEX IF NOT EXISTS idx_employees_email ON employees(email);
        CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id);
        CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON tasks(assignee_id);
        CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);

        CREATE INDEX IF NOT EXISTS idx_funnels_project ON funnels(project_id);
        CREATE INDEX IF NOT EXISTS idx_funnel_stages_funnel ON funnel_stages(funnel_id);
        CREATE INDEX IF NOT EXISTS idx_deals_project ON deals(project_id);
        CREATE INDEX IF NOT EXISTS idx_deals_client ON deals(client_id);
        CREATE INDEX IF NOT EXISTS idx_deals_funnel ON deals(funnel_id);
        CREATE INDEX IF NOT EXISTS idx_deals_stage ON deals(stage_id);
        CREATE INDEX IF NOT EXISTS idx_deals_assigned ON deals(assigned_to);
        CREATE INDEX IF NOT EXISTS idx_deal_stage_history_deal ON deal_stage_history(deal_id);
        CREATE INDEX IF NOT EXISTS idx_automations_project ON automations(project_id);

        CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
        CREATE INDEX IF NOT EXISTS idx_order_status_history_order ON order_status_history(order_id);
        CREATE INDEX IF NOT EXISTS idx_payments_project ON payments(project_id);
        CREATE INDEX IF NOT EXISTS idx_payments_order ON payments(order_id);
        CREATE INDEX IF NOT EXISTS idx_refunds_order ON refunds(order_id);
        CREATE INDEX IF NOT EXISTS idx_shipping_methods_project ON shipping_methods(project_id);
        CREATE INDEX IF NOT EXISTS idx_payment_methods_project ON payment_methods(project_id);

        CREATE INDEX IF NOT EXISTS idx_notifications_project ON notifications(project_id);
        CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications(recipient_type, recipient_id);
        CREATE INDEX IF NOT EXISTS idx_project_settings_project ON project_settings(project_id);
        CREATE INDEX IF NOT EXISTS idx_email_templates_project ON email_templates(project_id);
    `);

    console.log('CMS extension tables created');
}

module.exports = { getDb, initDatabase };

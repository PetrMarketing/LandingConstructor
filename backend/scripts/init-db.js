/**
 * Database initialization script
 * Creates tables and a default owner user
 */

const { initDatabase, getDb } = require('../config/database');
const User = require('../models/User');
const Project = require('../models/Project');

async function init() {
    console.log('Initializing database...');

    // Initialize tables
    initDatabase();

    // Check if owner exists
    const existingOwner = getDb().prepare("SELECT * FROM users WHERE role = 'owner' LIMIT 1").get();

    if (!existingOwner) {
        console.log('Creating default owner user...');

        // Create owner user
        const owner = await User.create({
            email: 'admin@example.com',
            password: 'admin123',
            name: 'Администратор',
            role: 'owner'
        });

        console.log('Owner created:');
        console.log('  Email: admin@example.com');
        console.log('  Password: admin123');
        console.log('  (Please change password after first login!)');

        // Create default project
        const project = Project.create({
            name: 'Мой проект',
            description: 'Основной проект',
            owner_id: owner.id
        });

        console.log(`Default project created: ${project.name}`);
    } else {
        console.log('Owner already exists:', existingOwner.email);
    }

    console.log('\nDatabase initialization complete!');
    console.log('\nYou can now start the server with: npm start');
}

init().catch(err => {
    console.error('Initialization failed:', err);
    process.exit(1);
});

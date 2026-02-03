const Page = require('../models/Page');
const Folder = require('../models/Folder');

// Pages
exports.getAll = (req, res) => {
    try {
        const { project_id, folder_id, status } = req.query;
        if (!project_id) {
            return res.status(400).json({ success: false, error: 'project_id is required' });
        }

        const options = {};
        if (folder_id !== undefined) options.folder_id = folder_id === 'null' ? null : folder_id;
        if (status) options.status = status;

        const pages = Page.findByProject(project_id, options);
        const total = Page.count(project_id);

        res.json({ success: true, data: pages, total });
    } catch (err) {
        console.error('Get pages error:', err);
        res.status(500).json({ success: false, error: 'Server error' });
    }
};

exports.getById = (req, res) => {
    try {
        const page = Page.findById(req.params.id);
        if (!page) return res.status(404).json({ success: false, error: 'Page not found' });

        // Parse JSON fields
        page.content = JSON.parse(page.content || '{}');
        page.meta = JSON.parse(page.meta || '{}');

        res.json({ success: true, data: page });
    } catch (err) {
        console.error('Get page error:', err);
        res.status(500).json({ success: false, error: 'Server error' });
    }
};

exports.create = (req, res) => {
    try {
        const { project_id, name, folder_id, template, content, meta, status } = req.body;
        if (!project_id || !name) {
            return res.status(400).json({ success: false, error: 'project_id and name are required' });
        }

        const page = Page.create({
            project_id,
            name,
            folder_id: folder_id || null,
            content: content || { template: template || 'blank', elements: [] },
            meta: meta || {},
            status: status || 'draft',
            created_by: req.userId
        });

        res.status(201).json({ success: true, data: page });
    } catch (err) {
        console.error('Create page error:', err);
        res.status(500).json({ success: false, error: 'Server error' });
    }
};

exports.update = (req, res) => {
    try {
        const page = Page.findById(req.params.id);
        if (!page) return res.status(404).json({ success: false, error: 'Page not found' });

        const updated = Page.update(req.params.id, {
            ...req.body,
            updated_by: req.userId
        });

        res.json({ success: true, data: updated });
    } catch (err) {
        console.error('Update page error:', err);
        res.status(500).json({ success: false, error: 'Server error' });
    }
};

exports.delete = (req, res) => {
    try {
        const page = Page.findById(req.params.id);
        if (!page) return res.status(404).json({ success: false, error: 'Page not found' });

        Page.delete(req.params.id);
        res.json({ success: true, message: 'Page deleted' });
    } catch (err) {
        console.error('Delete page error:', err);
        res.status(500).json({ success: false, error: 'Server error' });
    }
};

exports.duplicate = (req, res) => {
    try {
        const page = Page.findById(req.params.id);
        if (!page) return res.status(404).json({ success: false, error: 'Page not found' });

        const copy = Page.create({
            project_id: page.project_id,
            name: page.name + ' (копия)',
            folder_id: page.folder_id,
            content: JSON.parse(page.content || '{}'),
            meta: JSON.parse(page.meta || '{}'),
            status: 'draft',
            created_by: req.userId
        });

        res.status(201).json({ success: true, data: copy });
    } catch (err) {
        console.error('Duplicate page error:', err);
        res.status(500).json({ success: false, error: 'Server error' });
    }
};

// Folders
exports.getFolders = (req, res) => {
    try {
        const { project_id } = req.query;
        if (!project_id) {
            return res.status(400).json({ success: false, error: 'project_id is required' });
        }

        const folders = Folder.findByProject(project_id);
        res.json({ success: true, data: folders });
    } catch (err) {
        console.error('Get folders error:', err);
        res.status(500).json({ success: false, error: 'Server error' });
    }
};

exports.createFolder = (req, res) => {
    try {
        const { project_id, name, parent_id } = req.body;
        if (!project_id || !name) {
            return res.status(400).json({ success: false, error: 'project_id and name are required' });
        }

        const folder = Folder.create({ project_id, name, parent_id });
        res.status(201).json({ success: true, data: folder });
    } catch (err) {
        console.error('Create folder error:', err);
        res.status(500).json({ success: false, error: 'Server error' });
    }
};

exports.updateFolder = (req, res) => {
    try {
        const folder = Folder.findById(req.params.id);
        if (!folder) return res.status(404).json({ success: false, error: 'Folder not found' });

        const updated = Folder.update(req.params.id, req.body);
        res.json({ success: true, data: updated });
    } catch (err) {
        console.error('Update folder error:', err);
        res.status(500).json({ success: false, error: 'Server error' });
    }
};

exports.deleteFolder = (req, res) => {
    try {
        const folder = Folder.findById(req.params.id);
        if (!folder) return res.status(404).json({ success: false, error: 'Folder not found' });

        Folder.delete(req.params.id);
        res.json({ success: true, message: 'Folder deleted' });
    } catch (err) {
        console.error('Delete folder error:', err);
        res.status(500).json({ success: false, error: 'Server error' });
    }
};

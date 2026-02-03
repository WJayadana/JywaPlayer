const express = require('express');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const multer = require('multer');
require('dotenv').config();
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, x-private-password");
    res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PUT, DELETE");
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});
app.use(express.static(path.join(__dirname, 'public')));

// Define Roots and Auth
const ROOT_PUBLIC_DIR = path.resolve(__dirname, process.env.PUBLIC_DIR || 'video/public');
const ROOT_PRIVATE_DIR = path.resolve(__dirname, process.env.PRIVATE_DIR || 'video/private');
const PASS = process.env.PRIVATE_PASSWORD || 'admin123';

// Ensure directories exist
fs.ensureDirSync(ROOT_PUBLIC_DIR);
fs.ensureDirSync(ROOT_PRIVATE_DIR);

// Safe JSON Reader Helper
async function safeReadJson(file) {
    try {
        if (!(await fs.pathExists(file))) return {};
        const content = await fs.readFile(file, 'utf8');
        if (!content || content.trim() === '') return {};
        return JSON.parse(content);
    } catch (e) {
        console.error(`SafeReadJson Error (${file}):`, e);
        return {};
    }
}

app.use('/public-files', express.static(ROOT_PUBLIC_DIR));

// Embed Route (Secret)
app.get('/embed', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Middleware for Private Static Files (using query param for media compatibility)
app.use('/private-files', (req, res, next) => {
    const pw = req.query.p || req.headers['x-private-password'];
    if (pw !== PASS) return res.status(403).send('Forbidden');
    next();
}, express.static(ROOT_PRIVATE_DIR));

// Auth check helper for API
function checkAuth(req, res, rootType) {
    if (rootType === 'private') {
        const pw = req.headers['x-private-password'];
        if (pw !== PASS) {
            res.status(401).json({ error: 'Unauthorized' });
            return false;
        }
    }
    return true;
}

// Config API
app.get('/api/config', (req, res) => {
    res.json({
        appName: process.env.APP_NAME || 'MPlayer',
        footerText: process.env.FOOTER_TEXT || '© 2024 MPlayer',
        enableEmbed: true, // Force enable for this session
        accentColor: process.env.ACCENT_COLOR || '#6366f1',
        socialGithub: process.env.SOCIAL_GITHUB || '',
        socialTiktok: process.env.SOCIAL_TIKTOK || '',
        socialInstagram: process.env.SOCIAL_INSTAGRAM || '',
        copyrightText: process.env.COPYRIGHT_TEXT || '© 2026 Developer'
    });
});

// Embeds API
const EMBEDS_FILE = path.resolve(__dirname, 'embeds.json');

app.get('/api/embeds', async (req, res) => {
    const data = await safeReadJson(EMBEDS_FILE);
    res.json(data);
});

app.get('/api/embeds/:id', async (req, res) => {
    try {
        const data = await safeReadJson(EMBEDS_FILE);
        const item = data[req.params.id];
        if (item) {
            // Handle both string (direct mapping) and array (history)
            const list = Array.isArray(item) ? item : [{ url: item, title: 'External Video', time: Date.now() }];
            res.json({ id: req.params.id, history: list });
        } else {
            res.status(404).json({ error: 'Not found' });
        }
    } catch (e) {
        console.error('Embeds API Error:', e);
        res.status(500).json({ error: 'Server error', details: e.message });
    }
});

app.post('/api/embeds', async (req, res) => {
    const { id, url, title } = req.body;
    if (!id || !url) return res.status(400).json({ error: 'Missing params' });
    try {
        const data = await safeReadJson(EMBEDS_FILE);
        
        if (!Array.isArray(data[id])) {
            // Convert old string format or empty to new array format
            const oldUrl = typeof data[id] === 'string' ? data[id] : null;
            data[id] = oldUrl ? [{ url: oldUrl, title: 'Previous Video', time: Date.now() }] : [];
        }
        
        // Deduplicate and push to front
        data[id] = data[id].filter(h => h.url !== url);
        data[id].unshift({ url, title: title || 'External Video', time: Date.now() });
        
        // Limit history per ID
        if (data[id].length > 50) data[id].pop();
        
        await fs.writeJson(EMBEDS_FILE, data, { spaces: 2 });
        res.json({ success: true, history: data[id] });
    } catch (e) {
        console.error('Embeds POST Error:', e);
        res.status(500).json({ error: 'Server error', details: e.message });
    }
});

// API to browse directory
app.get('/api/browse', async (req, res) => {
    const relativePath = req.query.path || '';
    const rootType = req.query.root || 'public';
    
    if (!checkAuth(req, res, rootType)) return;

    const rootDir = rootType === 'private' ? ROOT_PRIVATE_DIR : ROOT_PUBLIC_DIR;
    const targetDir = path.join(rootDir, relativePath);

    if (!targetDir.startsWith(rootDir)) return res.status(403).json({ error: 'Access denied' });

    try {
        const files = await fs.readdir(targetDir, { withFileTypes: true });
        const videoExtensions = (process.env.VIDEO_EXTS || '.mp4,.mkv,.avi,.webm,.mov').split(',').map(e => e.trim());
        const imageExtensions = (process.env.IMAGE_EXTS || '.jpg,.jpeg,.png,.gif,.webp').split(',').map(e => e.trim());

        const result = await Promise.all(files.map(async file => {
            const isDirectory = file.isDirectory();
            const filePath = path.join(targetDir, file.name);
            const stats = await fs.stat(filePath);
            const ext = path.extname(file.name).toLowerCase();
            let type = 'file';
            
            if (isDirectory) type = 'directory';
            else if (videoExtensions.includes(ext)) type = 'video';
            else if (imageExtensions.includes(ext)) type = 'image';

            const itemPath = path.join(relativePath, file.name).replace(/\\/g, '/');
            const urlBase = rootType === 'private' ? '/private-files' : '/public-files';
            const authSuffix = rootType === 'private' ? `?p=${PASS}` : '';

            let itemCount = 0;
            if (isDirectory) {
                try {
                    const subitems = await fs.readdir(filePath);
                    itemCount = subitems.length;
                } catch (e) {}
            }

            return {
                name: file.name,
                type: type,
                size: stats.size,
                mtime: stats.mtime,
                itemCount: isDirectory ? itemCount : null,
                path: itemPath,
                url: type !== 'directory' ? `${urlBase}/${itemPath.split('/').map(s => encodeURIComponent(s)).join('/')}${authSuffix}` : null
            };
        }));
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: 'Failed' });
    }
});

async function searchRecursive(dir, query, rootDir, relativeBase = '') {
    let results = [];
    const files = await fs.readdir(dir, { withFileTypes: true });
    const videoExtensions = (process.env.VIDEO_EXTS || '.mp4,.mkv,.avi,.webm,.mov').split(',').map(e => e.trim());
    const imageExtensions = (process.env.IMAGE_EXTS || '.jpg,.jpeg,.png,.gif,.webp').split(',').map(e => e.trim());

    for (const file of files) {
        const filePath = path.join(dir, file.name);
        const relativePath = path.join(relativeBase, file.name).replace(/\\/g, '/');
        
        if (file.isDirectory()) {
            const subResults = await searchRecursive(filePath, query, rootDir, relativePath);
            results = results.concat(subResults);
        } else {
            if (file.name.toLowerCase().includes(query.toLowerCase())) {
                // Found match
                const stats = await fs.stat(filePath);
                const ext = path.extname(file.name).toLowerCase();
                let type = 'file';
                if (videoExtensions.includes(ext)) type = 'video';
                else if (imageExtensions.includes(ext)) type = 'image';

                // Determine URL base
                const isPrivate = rootDir.includes('private'); // Simple check based on path
                const urlBase = isPrivate ? '/private-files' : '/public-files';
                // Note: We need a better way to pass auth if needed, but url generation is standard
                // We'll fix the URL generation in the route handler or here if we pass the rootType
                
                results.push({
                    name: file.name,
                    type: type,
                    size: stats.size,
                    mtime: stats.mtime,
                    path: relativePath,
                    // URL construction will be handled by the caller or we make a guess here
                    // Let's return raw data and map URL in the route
                });
            }
        }
    }
    return results;
}

app.get('/', (req, res) => {
    res.send('MPlayer API is running');
});


// API Search Endpoint
app.get('/api/search', async (req, res) => {
    const { query, root } = req.query;
    if (!query) return res.json([]);
    if (!checkAuth(req, res, root)) return;

    const rootDir = root === 'private' ? ROOT_PRIVATE_DIR : ROOT_PUBLIC_DIR;
    const pass = process.env.PRIVATE_PASSWORD || 'admin123';

    try {
        const rawResults = await searchRecursive(rootDir, query, rootDir);
        
        // Map URLs
        const results = rawResults.map(item => {
            const urlBase = root === 'private' ? '/private-files' : '/public-files';
            const authSuffix = root === 'private' ? `?p=${pass}` : '';
            return {
                ...item,
                url: `${urlBase}/${item.path.split('/').map(s => encodeURIComponent(s)).join('/')}${authSuffix}`
            };
        });

        res.json(results);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Search failed' });
    }
});

// API for moving files between Public and Private
app.post('/api/cross-move', async (req, res) => {
    const { fromPath, fromRoot, toRoot, password } = req.body;
    
    if (password !== PASS) {
        return res.status(401).json({ error: 'Unauthorized: Invalid Password' });
    }

    const sourceBase = getBaseDir(fromRoot);
    const destBase = getBaseDir(toRoot);
    
    const source = path.join(sourceBase, fromPath);
    const dest = path.join(destBase, path.basename(fromPath));

    if (!source.startsWith(sourceBase) || !dest.startsWith(destBase)) {
        return res.status(403).send('Access denied');
    }

    try {
        await fs.move(source, dest, { overwrite: true });
        res.json({ success: true });
    } catch (err) {
        res.status(500).send('Error');
    }
});

// API to get detailed file info
app.get('/api/info', async (req, res) => {
    const { path: itemPath, root: rootType } = req.query;
    if (!checkAuth(req, res, rootType)) return;
    
    const base = getBaseDir(rootType);
    const target = path.join(base, itemPath);
    if (!target.startsWith(base)) return res.status(403).send('Access denied');

    try {
        const stats = await fs.stat(target);
        const ext = path.extname(target).toLowerCase();
        
        res.json({
            name: path.basename(target),
            size: stats.size,
            created: stats.birthtime,
            modified: stats.mtime,
            accessed: stats.atime,
            isDirectory: stats.isDirectory(),
            extension: ext,
            fullPath: target.replace(/\\/g, '/')
        });
    } catch (err) {
        res.status(500).send('Error');
    }
});

function getBaseDir(rootType) {
    return rootType === 'private' ? ROOT_PRIVATE_DIR : ROOT_PUBLIC_DIR;
}

app.post('/api/mkdir', async (req, res) => {
    const { path: dirPath, root: rootType } = req.body;
    if (!checkAuth(req, res, rootType)) return;
    const base = getBaseDir(rootType);
    const target = path.join(base, dirPath);
    if (!target.startsWith(base)) return res.status(403).send('Access denied');

    try {
        await fs.ensureDir(target);
        res.json({ success: true });
    } catch (err) { res.status(500).send('Error'); }
});

app.delete('/api/delete', async (req, res) => {
    const { paths, root: rootType } = req.body;
    if (!checkAuth(req, res, rootType)) return;
    const base = getBaseDir(rootType);
    const items = Array.isArray(paths) ? paths : [req.body.path];
    
    try {
        for (const itemPath of items) {
            const target = path.join(base, itemPath);
            if (!target.startsWith(base)) continue;
            await fs.remove(target);
        }
        res.json({ success: true });
    } catch (err) { res.status(500).send('Error'); }
});

app.post('/api/move', async (req, res) => {
    const { from, to, items, root: rootType } = req.body;
    if (!checkAuth(req, res, rootType)) return;
    const base = getBaseDir(rootType);
    
    try {
        if (items && Array.isArray(items)) {
            const destinationDir = path.join(base, to);
            if (!destinationDir.startsWith(base)) return res.status(403).send('Access denied');
            await fs.ensureDir(destinationDir);
            for (const item of items) {
                const source = path.join(base, item.from);
                const dest = path.join(destinationDir, path.basename(item.from));
                if (source.startsWith(base) && dest.startsWith(base)) {
                    await fs.move(source, dest, { overwrite: true });
                }
            }
        } else {
            const source = path.join(base, from);
            const destination = path.join(base, to);
            if (!source.startsWith(base) || !destination.startsWith(base)) return res.status(403).send('Access denied');
            await fs.move(source, destination, { overwrite: true });
        }
        res.json({ success: true });
    } catch (err) { res.status(500).send('Error'); }
});

// Upload Configuration
const maxFileSizeGB = parseInt(process.env.MAX_UPLOAD_SIZE_GB) || 2;
const upload = multer({ dest: os.tmpdir(), limits: { fileSize: maxFileSizeGB * 1024 * 1024 * 1024 } });

app.post('/api/upload', upload.array('files'), async (req, res) => {
    const { path: relativePath, root: rootType } = req.body;
    
    // Auth Check
    let isAuthorized = true;
    if (rootType === 'private') {
        // Multer handles body parsing, so req.body is available here
        const pw = req.headers['x-private-password'] || req.body.password;
        if (pw !== PASS) isAuthorized = false;
    }

    if (!isAuthorized) {
        // Cleanup temp files
        if (req.files) {
            for (const file of req.files) fs.remove(file.path);
        }
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const base = getBaseDir(rootType);
    const targetDir = path.join(base, relativePath);

    if (!targetDir.startsWith(base)) {
        if (req.files) {
            for (const file of req.files) fs.remove(file.path);
        }
        return res.status(403).send('Access denied');
    }

    try {
        await fs.ensureDir(targetDir);
        if (req.files) {
            for (const file of req.files) {
                // Decode original name to handle basic UTF-8 chars if needed
                // For now, use originalname directly which is usually safe in modern node
                const destPath = path.join(targetDir, file.originalname);
                await fs.move(file.path, destPath, { overwrite: true });
            }
        }
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).send('Upload failed');
    }
});

app.listen(PORT, '127.0.0.1', () => {
    console.log(`\n🚀 MPlayer is running!`);
    console.log(`   - Local:    http://localhost:${PORT}`);
    
    // Get Local IP
    const nets = os.networkInterfaces();
    for (const name of Object.keys(nets)) {
        for (const net of nets[name]) {
            if (net.family === 'IPv4' && !net.internal) {
                console.log(`   - Network:  http://${net.address}:${PORT}`);
            }
        }
    }
    console.log('\n');
});

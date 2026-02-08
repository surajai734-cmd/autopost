const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const axios = require('axios');
const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

// Database file
const DB_FILE = 'database.json';

// Load database
function loadDatabase() {
    try {
        if (fs.existsSync(DB_FILE)) {
            return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
        }
    } catch (error) {
        console.error('Error loading database:', error);
    }
    return { users: [], posts: [] };
}

// Save database
function saveDatabase(data) {
    try {
        fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
        return true;
    } catch (error) {
        console.error('Error saving database:', error);
        return false;
    }
}

// API Routes

// User registration
app.post('/api/register', (req, res) => {
    const { name, email, password } = req.body;
    
    if (!name || !email || !password) {
        return res.status(400).json({ error: 'All fields are required' });
    }
    
    const db = loadDatabase();
    
    // Check if user already exists
    if (db.users.find(user => user.email === email)) {
        return res.status(400).json({ error: 'User already exists' });
    }
    
    // Create new user
    const newUser = {
        id: Date.now(),
        name,
        email,
        password: Buffer.from(password).toString('base64'),
        createdAt: new Date().toISOString(),
        credentials: {},
        settings: {}
    };
    
    db.users.push(newUser);
    saveDatabase(db);
    
    res.json({ 
        success: true, 
        message: 'Registration successful',
        user: { id: newUser.id, name: newUser.name, email: newUser.email }
    });
});

// User login
app.post('/api/login', (req, res) => {
    const { email, password } = req.body;
    
    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
    }
    
    const db = loadDatabase();
    const user = db.users.find(u => u.email === email);
    
    if (!user) {
        return res.status(401).json({ error: 'User not found' });
    }
    
    const decodedPassword = Buffer.from(user.password, 'base64').toString();
    
    if (decodedPassword !== password) {
        return res.status(401).json({ error: 'Invalid password' });
    }
    
    res.json({ 
        success: true, 
        message: 'Login successful',
        user: { 
            id: user.id, 
            name: user.name, 
            email: user.email,
            credentials: user.credentials,
            settings: user.settings
        }
    });
});

// Save user credentials
app.post('/api/save-credentials', (req, res) => {
    const { userId, platform, credentials } = req.body;
    
    if (!userId || !platform || !credentials) {
        return res.status(400).json({ error: 'Invalid request' });
    }
    
    const db = loadDatabase();
    const userIndex = db.users.findIndex(u => u.id === userId);
    
    if (userIndex === -1) {
        return res.status(404).json({ error: 'User not found' });
    }
    
    // Save credentials
    db.users[userIndex].credentials[platform] = {
        ...credentials,
        connectedAt: new Date().toISOString()
    };
    
    saveDatabase(db);
    
    res.json({ 
        success: true, 
        message: `${platform} credentials saved successfully` 
    });
});

// Save auto-post settings
app.post('/api/save-settings', (req, res) => {
    const { userId, settings } = req.body;
    
    if (!userId || !settings) {
        return res.status(400).json({ error: 'Invalid request' });
    }
    
    const db = loadDatabase();
    const userIndex = db.users.findIndex(u => u.id === userId);
    
    if (userIndex === -1) {
        return res.status(404).json({ error: 'User not found' });
    }
    
    // Save settings
    db.users[userIndex].settings = settings;
    saveDatabase(db);
    
    res.json({ 
        success: true, 
        message: 'Settings saved successfully' 
    });
});

// Test Telegram connection
app.post('/api/test-telegram', async (req, res) => {
    const { botToken, channel } = req.body;
    
    if (!botToken || !channel) {
        return res.status(400).json({ error: 'Bot token and channel are required' });
    }
    
    try {
        const bot = new TelegramBot(botToken, { polling: false });
        
        // Try to get bot info
        const botInfo = await bot.getMe();
        
        res.json({
            success: true,
            message: 'Telegram connection successful',
            botInfo: {
                username: botInfo.username,
                firstName: botInfo.first_name,
                id: botInfo.id
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to connect to Telegram: ' + error.message
        });
    }
});

// Test Facebook connection
app.post('/api/test-facebook', async (req, res) => {
    const { accessToken, pageId } = req.body;
    
    if (!accessToken || !pageId) {
        return res.status(400).json({ error: 'Access token and page ID are required' });
    }
    
    try {
        // Test Facebook Graph API connection
        const response = await axios.get(
            `https://graph.facebook.com/v15.0/${pageId}`,
            {
                params: {
                    access_token: accessToken,
                    fields: 'name,id'
                }
            }
        );
        
        res.json({
            success: true,
            message: 'Facebook connection successful',
            pageInfo: response.data
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to connect to Facebook: ' + error.message
        });
    }
});

// Send test post
app.post('/api/send-test-post', async (req, res) => {
    const { userId, content, platforms } = req.body;
    
    if (!userId || !content) {
        return res.status(400).json({ error: 'User ID and content are required' });
    }
    
    const db = loadDatabase();
    const user = db.users.find(u => u.id === userId);
    
    if (!user) {
        return res.status(404).json({ error: 'User not found' });
    }
    
    // Save post to database
    const newPost = {
        id: Date.now(),
        userId,
        content,
        platforms: platforms || [],
        status: 'pending',
        createdAt: new Date().toISOString()
    };
    
    if (!db.posts) db.posts = [];
    db.posts.push(newPost);
    saveDatabase(db);
    
    // In a real implementation, here you would:
    // 1. Post to Telegram
    // 2. Cross-post to other platforms based on user settings
    // 3. Update post status
    
    res.json({
        success: true,
        message: 'Test post queued successfully',
        postId: newPost.id
    });
});

// Get user posts
app.get('/api/user-posts/:userId', (req, res) => {
    const { userId } = req.params;
    
    const db = loadDatabase();
    const userPosts = db.posts.filter(post => post.userId == userId);
    
    res.json({
        success: true,
        posts: userPosts
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Open http://localhost:${PORT} in your browser`);
});

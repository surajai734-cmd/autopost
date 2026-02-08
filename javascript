require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs-extra');
const { startTelegramBot } = require('./bot');
const { testAllConnections, postToAllPlatforms } = require('./social-apis');
const { saveUserConfig, getUserConfig, savePost, getPosts } = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname)));

// Serve HTML file
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// API: Save user configuration
app.post('/api/save-config', async (req, res) => {
    try {
        const { userId, platform, credentials } = req.body;
        
        await saveUserConfig(userId, platform, credentials);
        
        res.json({ 
            success: true, 
            message: `${platform} configuration saved successfully` 
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// API: Test platform connection
app.post('/api/test-connection', async (req, res) => {
    try {
        const { platform, credentials } = req.body;
        
        const result = await testAllConnections(platform, credentials);
        
        res.json(result);
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// API: Send test post
app.post('/api/send-post', async (req, res) => {
    try {
        const { content, imageUrl, platforms } = req.body;
        const userId = 'demo-user'; // In production, use actual user ID
        
        // Save post to database
        const postId = await savePost({
            userId,
            content,
            imageUrl,
            platforms,
            status: 'pending'
        });
        
        // Post to all platforms
        const results = await postToAllPlatforms(content, imageUrl, platforms);
        
        // Update post status
        await savePost({
            id: postId,
            status: 'posted',
            results
        });
        
        res.json({ 
            success: true, 
            message: 'Post sent successfully',
            postId,
            results
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// API: Get user posts
app.get('/api/posts/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const posts = await getPosts(userId);
        
        res.json({ 
            success: true, 
            posts 
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// API: Get system status
app.get('/api/status', async (req, res) => {
    try {
        // Check if all environment variables are set
        const envVars = {
            telegram: !!process.env.TELEGRAM_BOT_TOKEN,
            facebook: !!process.env.FB_ACCESS_TOKEN,
            instagram: !!process.env.INSTA_ACCESS_TOKEN,
            twitter: !!process.env.TWITTER_API_KEY,
            pinterest: !!process.env.PINTEREST_ACCESS_TOKEN
        };
        
        res.json({ 
            success: true, 
            status: 'System is running',
            envVars,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Server started on http://localhost:${PORT}`);
    console.log(`📱 Dashboard: http://localhost:${PORT}`);
    
    // Start Telegram bot
    if (process.env.TELEGRAM_BOT_TOKEN) {
        startTelegramBot();
        console.log(`🤖 Telegram bot started`);
    } else {
        console.log(`⚠️ Telegram bot token not found. Set TELEGRAM_BOT_TOKEN in .env file`);
    }
    
    console.log(`\n✅ AutoSocialSync is ready!`);
    console.log(`🔗 Configure your API keys in .env file`);
});

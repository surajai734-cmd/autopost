const fs = require('fs-extra');
const path = require('path');

const DB_FILE = path.join(__dirname, 'data', 'database.json');
const POSTS_FILE = path.join(__dirname, 'data', 'posts.json');

// Ensure data directory exists
fs.ensureDirSync(path.join(__dirname, 'data'));

// Initialize database files if they don't exist
if (!fs.existsSync(DB_FILE)) {
    fs.writeJsonSync(DB_FILE, { users: {}, configs: {} });
}

if (!fs.existsSync(POSTS_FILE)) {
    fs.writeJsonSync(POSTS_FILE, { posts: [], lastId: 0 });
}

class Database {
    constructor() {
        this.db = fs.readJsonSync(DB_FILE);
        this.postsData = fs.readJsonSync(POSTS_FILE);
    }
    
    // Save user configuration
    saveUserConfig(userId, platform, credentials) {
        try {
            if (!this.db.users[userId]) {
                this.db.users[userId] = {};
            }
            
            this.db.users[userId][platform] = {
                ...credentials,
                updatedAt: new Date().toISOString()
            };
            
            fs.writeJsonSync(DB_FILE, this.db, { spaces: 2 });
            
            return { success: true, message: 'Configuration saved' };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
    
    // Get user configuration
    getUserConfig(userId) {
        return this.db.users[userId] || {};
    }
    
    // Save post
    async savePost(postData) {
        try {
            const posts = this.postsData.posts;
            const lastId = this.postsData.lastId || 0;
            
            const newPost = {
                id: postData.id || lastId + 1,
                userId: postData.userId || 'system',
                source: postData.source || 'dashboard',
                telegramMessageId: postData.telegramMessageId,
                content: postData.content,
                imageUrl: postData.imageUrl,
                platforms: postData.platforms || [],
                status: postData.status || 'pending',
                results: postData.results || null,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            
            if (postData.id) {
                // Update existing post
                const index = posts.findIndex(p => p.id === postData.id);
                if (index !== -1) {
                    posts[index] = { ...posts[index], ...newPost };
                }
            } else {
                // Add new post
                posts.push(newPost);
                this.postsData.lastId = newPost.id;
            }
            
            await fs.writeJson(POSTS_FILE, this.postsData, { spaces: 2 });
            
            return { success: true, postId: newPost.id };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
    
    // Get posts by user
    getPosts(userId, limit = 50) {
        const posts = this.postsData.posts;
        
        if (userId === 'all') {
            return posts.slice(-limit).reverse();
        }
        
        return posts
            .filter(post => post.userId === userId)
            .slice(-limit)
            .reverse();
    }
    
    // Get post by ID
    getPostById(postId) {
        return this.postsData.posts.find(post => post.id === postId);
    }
    
    // Get statistics
    getStats() {
        const posts = this.postsData.posts;
        
        const stats = {
            totalPosts: posts.length,
            successfulPosts: posts.filter(p => p.status === 'posted').length,
            failedPosts: posts.filter(p => p.status === 'failed').length,
            byPlatform: {
                facebook: posts.filter(p => p.results?.some(r => r.platform === 'facebook' && r.success)).length,
                instagram: posts.filter(p => p.results?.some(r => r.platform === 'instagram' && r.success)).length,
                twitter: posts.filter(p => p.results?.some(r => r.platform === 'twitter' && r.success)).length,
                pinterest: posts.filter(p => p.results?.some(r => r.platform === 'pinterest' && r.success)).length
            }
        };
        
        return stats;
    }
}

const db = new Database();

module.exports = {
    saveUserConfig: (userId, platform, credentials) => db.saveUserConfig(userId, platform, credentials),
    getUserConfig: (userId) => db.getUserConfig(userId),
    savePost: (postData) => db.savePost(postData),
    getPosts: (userId, limit) => db.getPosts(userId, limit),
    getPostById: (postId) => db.getPostById(postId),
    getStats: () => db.getStats()
};

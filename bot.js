const TelegramBot = require('node-telegram-bot-api');
const { postToAllPlatforms } = require('./social-apis');
const { savePost } = require('./database');

class AutoPostBot {
    constructor() {
        this.bot = null;
        this.channelId = null;
        this.isConnected = false;
    }
    
    async initialize() {
        try {
            const token = process.env.TELEGRAM_BOT_TOKEN;
            const channel = process.env.TELEGRAM_CHANNEL;
            
            if (!token) {
                throw new Error('Telegram Bot Token not found in .env file');
            }
            
            // Initialize bot
            this.bot = new TelegramBot(token, { polling: true });
            
            console.log('🤖 Telegram Bot Initializing...');
            
            // Get bot info
            const botInfo = await this.bot.getMe();
            console.log(`✅ Bot started: @${botInfo.username}`);
            
            // Set up message handler
            this.setupMessageHandler();
            
            // Get channel info
            if (channel) {
                try {
                    const chat = await this.bot.getChat(channel);
                    this.channelId = chat.id;
                    console.log(`📢 Connected to channel: ${chat.title}`);
                    this.isConnected = true;
                } catch (error) {
                    console.log(`⚠️ Could not connect to channel ${channel}. Make sure bot is added as admin.`);
                }
            }
            
            return { success: true, botInfo };
            
        } catch (error) {
            console.error('❌ Telegram Bot Error:', error.message);
            return { success: false, error: error.message };
        }
    }
    
    setupMessageHandler() {
        // Listen for messages in channels/groups
        this.bot.on('message', async (msg) => {
            try {
                // Only process messages from configured channel
                if (msg.chat.username === process.env.TELEGRAM_CHANNEL?.replace('@', '') || 
                    msg.chat.id === this.channelId) {
                    
                    console.log(`📨 New message in channel: ${msg.text?.substring(0, 50)}...`);
                    
                    // Extract content
                    const content = msg.text || msg.caption || '';
                    let imageUrl = null;
                    
                    // Handle media
                    if (msg.photo) {
                        const photo = msg.photo[msg.photo.length - 1];
                        const file = await this.bot.getFile(photo.file_id);
                        imageUrl = `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${file.file_path}`;
                    }
                    
                    // Save to database
                    const postId = await savePost({
                        source: 'telegram',
                        telegramMessageId: msg.message_id,
                        content,
                        imageUrl,
                        status: 'processing'
                    });
                    
                    // Define which platforms to post to (from environment or database)
                    const platformsToPost = [];
                    if (process.env.FB_ACCESS_TOKEN) platformsToPost.push('facebook');
                    if (process.env.INSTA_ACCESS_TOKEN) platformsToPost.push('instagram');
                    if (process.env.TWITTER_API_KEY) platformsToPost.push('twitter');
                    if (process.env.PINTEREST_ACCESS_TOKEN) platformsToPost.push('pinterest');
                    
                    // Auto-post to all platforms
                    if (platformsToPost.length > 0) {
                        console.log(`🔄 Auto-posting to: ${platformsToPost.join(', ')}`);
                        
                        const results = await postToAllPlatforms(content, imageUrl, platformsToPost);
                        
                        // Update post status
                        await savePost({
                            id: postId,
                            status: 'posted',
                            results
                        });
                        
                        console.log(`✅ Auto-post completed for post ${postId}`);
                        
                        // Send confirmation to user
                        if (msg.from) {
                            const successCount = results.filter(r => r.success).length;
                            this.bot.sendMessage(
                                msg.from.id,
                                `✅ Your post has been auto-shared to ${successCount} platforms!`
                            );
                        }
                    }
                }
            } catch (error) {
                console.error('❌ Error processing Telegram message:', error);
            }
        });
        
        // Command handlers
        this.bot.onText(/\/start/, (msg) => {
            const chatId = msg.chat.id;
            this.bot.sendMessage(chatId, 
                `🤖 Welcome to AutoSocialSync Bot!\n\n` +
                `I will automatically post your Telegram channel messages to:\n` +
                `✅ Facebook\n✅ Instagram\n✅ Twitter\n✅ Pinterest\n\n` +
                `Make sure I'm added as admin to your channel: ${process.env.TELEGRAM_CHANNEL || 'Not configured'}`
            );
        });
        
        this.bot.onText(/\/status/, async (msg) => {
            const chatId = msg.chat.id;
            
            const status = {
                telegram: this.isConnected ? '✅ Connected' : '❌ Not Connected',
                facebook: process.env.FB_ACCESS_TOKEN ? '✅ Configured' : '❌ Not Configured',
                instagram: process.env.INSTA_ACCESS_TOKEN ? '✅ Configured' : '❌ Not Configured',
                twitter: process.env.TWITTER_API_KEY ? '✅ Configured' : '❌ Not Configured',
                pinterest: process.env.PINTEREST_ACCESS_TOKEN ? '✅ Configured' : '❌ Not Configured'
            };
            
            this.bot.sendMessage(chatId,
                `📊 AutoSocialSync Status:\n\n` +
                `Telegram: ${status.telegram}\n` +
                `Facebook: ${status.facebook}\n` +
                `Instagram: ${status.instagram}\n` +
                `Twitter: ${status.twitter}\n` +
                `Pinterest: ${status.pinterest}\n\n` +
                `Total posts auto-shared: 0` // You can fetch from database
            );
        });
        
        console.log('✅ Telegram Bot message handlers setup complete');
    }
    
    async sendTestPost(content, imageUrl = null) {
        try {
            if (!this.channelId) {
                throw new Error('Channel not configured');
            }
            
            let messageOptions = {};
            if (imageUrl) {
                messageOptions.caption = content;
                // In real implementation, download and send image
                await this.bot.sendPhoto(this.channelId, imageUrl, messageOptions);
            } else {
                await this.bot.sendMessage(this.channelId, content);
            }
            
            return { success: true, message: 'Test post sent to Telegram' };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
}

// Export singleton instance
const autoPostBot = new AutoPostBot();

async function startTelegramBot() {
    return await autoPostBot.initialize();
}

module.exports = {
    startTelegramBot,
    autoPostBot
};

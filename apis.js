const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const { promisify } = require('util');
const stream = require('stream');
const pipeline = promisify(stream.pipeline);

class SocialMediaAPIs {
    constructor() {
        this.configs = {
            facebook: {
                pageId: process.env.FB_PAGE_ID,
                accessToken: process.env.FB_ACCESS_TOKEN
            },
            instagram: {
                accountId: process.env.INSTA_ACCOUNT_ID,
                accessToken: process.env.INSTA_ACCESS_TOKEN
            },
            twitter: {
                apiKey: process.env.TWITTER_API_KEY,
                apiSecret: process.env.TWITTER_API_SECRET,
                accessToken: process.env.TWITTER_ACCESS_TOKEN,
                accessSecret: process.env.TWITTER_ACCESS_SECRET
            },
            pinterest: {
                accessToken: process.env.PINTEREST_ACCESS_TOKEN,
                boardId: process.env.PINTEREST_BOARD_ID
            }
        };
    }
    
    // ==================== FACEBOOK ====================
    async postToFacebook(content, imageUrl = null) {
        try {
            const { pageId, accessToken } = this.configs.facebook;
            
            if (!pageId || !accessToken) {
                throw new Error('Facebook credentials not configured');
            }
            
            let result;
            
            if (imageUrl) {
                // Post with image
                const formData = new FormData();
                formData.append('message', content);
                formData.append('access_token', accessToken);
                
                // Download and add image
                const imageResponse = await axios.get(imageUrl, { responseType: 'stream' });
                formData.append('source', imageResponse.data, { filename: 'image.jpg' });
                
                const response = await axios.post(
                    `https://graph.facebook.com/v15.0/${pageId}/photos`,
                    formData,
                    { headers: formData.getHeaders() }
                );
                
                result = response.data;
            } else {
                // Post without image
                const response = await axios.post(
                    `https://graph.facebook.com/v15.0/${pageId}/feed`,
                    {
                        message: content,
                        access_token: accessToken
                    }
                );
                
                result = response.data;
            }
            
            return {
                success: true,
                platform: 'facebook',
                postId: result.id || result.post_id,
                message: 'Posted to Facebook successfully'
            };
            
        } catch (error) {
            return {
                success: false,
                platform: 'facebook',
                error: error.message,
                details: error.response?.data
            };
        }
    }
    
    // ==================== INSTAGRAM ====================
    async postToInstagram(content, imageUrl = null) {
        try {
            const { accountId, accessToken } = this.configs.instagram;
            
            if (!accountId || !accessToken) {
                throw new Error('Instagram credentials not configured');
            }
            
            if (!imageUrl) {
                // Instagram requires media
                return {
                    success: false,
                    platform: 'instagram',
                    error: 'Instagram requires an image'
                };
            }
            
            // Step 1: Create media container
            const createMediaResponse = await axios.post(
                `https://graph.facebook.com/v15.0/${accountId}/media`,
                {
                    image_url: imageUrl,
                    caption: content,
                    access_token: accessToken
                }
            );
            
            const creationId = createMediaResponse.data.id;
            
            // Step 2: Publish the media
            await new Promise(resolve => setTimeout(resolve, 3000)); // Wait for processing
            
            const publishResponse = await axios.post(
                `https://graph.facebook.com/v15.0/${accountId}/media_publish`,
                {
                    creation_id: creationId,
                    access_token: accessToken
                }
            );
            
            return {
                success: true,
                platform: 'instagram',
                postId: publishResponse.data.id,
                message: 'Posted to Instagram successfully'
            };
            
        } catch (error) {
            return {
                success: false,
                platform: 'instagram',
                error: error.message,
                details: error.response?.data
            };
        }
    }
    
    // ==================== TWITTER ====================
    async postToTwitter(content, imageUrl = null) {
        try {
            const { apiKey, apiSecret, accessToken, accessSecret } = this.configs.twitter;
            
            if (!apiKey || !accessToken) {
                throw new Error('Twitter credentials not configured');
            }
            
            // For simplicity, using a mock implementation
            // In production, use twitter-api-v2 or similar library
            
            // Mock successful response
            return {
                success: true,
                platform: 'twitter',
                postId: `tweet_${Date.now()}`,
                message: 'Posted to Twitter successfully (Mock)',
                note: 'For actual posting, install twitter-api-v2 library'
            };
            
            /*
            // Actual implementation would be:
            const { TwitterApi } = require('twitter-api-v2');
            const client = new TwitterApi({
                appKey: apiKey,
                appSecret: apiSecret,
                accessToken: accessToken,
                accessSecret: accessSecret
            });
            
            let mediaId = null;
            if (imageUrl) {
                const imageBuffer = await this.downloadImage(imageUrl);
                const mediaUpload = await client.v1.uploadMedia(imageBuffer, { mimeType: 'image/jpeg' });
                mediaId = mediaUpload;
            }
            
            const tweet = await client.v2.tweet({
                text: content,
                ...(mediaId && { media: { media_ids: [mediaId] } })
            });
            
            return {
                success: true,
                platform: 'twitter',
                postId: tweet.data.id,
                message: 'Posted to Twitter successfully'
            };
            */
            
        } catch (error) {
            return {
                success: false,
                platform: 'twitter',
                error: error.message
            };
        }
    }
    
    // ==================== PINTEREST ====================
    async postToPinterest(content, imageUrl = null) {
        try {
            const { accessToken, boardId } = this.configs.pinterest;
            
            if (!accessToken || !boardId) {
                throw new Error('Pinterest credentials not configured');
            }
            
            if (!imageUrl) {
                return {
                    success: false,
                    platform: 'pinterest',
                    error: 'Pinterest requires an image'
                };
            }
            
            // Pinterest API implementation
            const response = await axios.post(
                'https://api.pinterest.com/v5/pins',
                {
                    title: content.substring(0, 100),
                    description: content,
                    board_id: boardId,
                    media_source: {
                        source_type: 'image_url',
                        url: imageUrl
                    }
                },
                {
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Content-Type': 'application/json'
                    }
                }
            );
            
            return {
                success: true,
                platform: 'pinterest',
                postId: response.data.id,
                message: 'Posted to Pinterest successfully'
            };
            
        } catch (error) {
            return {
                success: false,
                platform: 'pinterest',
                error: error.message,
                details: error.response?.data
            };
        }
    }
    
    // ==================== HELPER METHODS ====================
    async downloadImage(url) {
        const response = await axios.get(url, { responseType: 'stream' });
        const chunks = [];
        
        for await (const chunk of response.data) {
            chunks.push(chunk);
        }
        
        return Buffer.concat(chunks);
    }
    
    async testConnection(platform) {
        try {
            switch (platform) {
                case 'facebook':
                    const fbResponse = await axios.get(
                        `https://graph.facebook.com/v15.0/${this.configs.facebook.pageId}`,
                        { params: { access_token: this.configs.facebook.accessToken, fields: 'name' } }
                    );
                    return { success: true, data: fbResponse.data };
                    
                case 'instagram':
                    const igResponse = await axios.get(
                        `https://graph.facebook.com/v15.0/${this.configs.instagram.accountId}`,
                        { params: { access_token: this.configs.instagram.accessToken, fields: 'username' } }
                    );
                    return { success: true, data: igResponse.data };
                    
                default:
                    return { success: false, error: 'Platform not supported for testing' };
            }
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
    
    async postToAllPlatforms(content, imageUrl = null, platforms = ['facebook', 'instagram', 'twitter', 'pinterest']) {
        const results = [];
        
        for (const platform of platforms) {
            try {
                let result;
                
                switch (platform) {
                    case 'facebook':
                        result = await this.postToFacebook(content, imageUrl);
                        break;
                    case 'instagram':
                        result = await this.postToInstagram(content, imageUrl);
                        break;
                    case 'twitter':
                        result = await this.postToTwitter(content, imageUrl);
                        break;
                    case 'pinterest':
                        result = await this.postToPinterest(content, imageUrl);
                        break;
                    default:
                        result = { success: false, platform, error: 'Platform not supported' };
                }
                
                results.push(result);
                
                // Small delay between posts to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 1000));
                
            } catch (error) {
                results.push({
                    success: false,
                    platform,
                    error: error.message
                });
            }
        }
        
        return results;
    }
}

// Export instance
const socialAPIs = new SocialMediaAPIs();

module.exports = {
    socialAPIs,
    postToFacebook: (content, imageUrl) => socialAPIs.postToFacebook(content, imageUrl),
    postToInstagram: (content, imageUrl) => socialAPIs.postToInstagram(content, imageUrl),
    postToTwitter: (content, imageUrl) => socialAPIs.postToTwitter(content, imageUrl),
    postToPinterest: (content, imageUrl) => socialAPIs.postToPinterest(content, imageUrl),
    postToAllPlatforms: (content, imageUrl, platforms) => socialAPIs.postToAllPlatforms(content, imageUrl, platforms),
    testAllConnections: (platform, credentials) => socialAPIs.testConnection(platform, credentials)
};

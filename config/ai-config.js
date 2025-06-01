// AI service configuration
const aiConfig = {
  // Default values for development
  openai: {
    apiKey: process.env.OPENAI_API_KEY || '',
    defaultModel: process.env.AI_MODEL || 'gpt-3.5-turbo',
    temperature: parseFloat(process.env.AI_TEMPERATURE || '0.7'),
    maxTokens: parseInt(process.env.AI_MAX_TOKENS || '800', 10)
  },
  
  // Cache settings
  cache: {
    enabled: process.env.AI_CACHE_ENABLED === 'true',
    ttl: parseInt(process.env.AI_CACHE_TTL || '3600', 10) // Time to live in seconds
  }
};

module.exports = aiConfig; 
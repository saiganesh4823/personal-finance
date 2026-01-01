const DatabaseManager = require('./services/DatabaseManager');
require('dotenv').config();

async function setupSeparateDatabases() {
    console.log('🚀 Setting up separate database architecture...');
    
    try {
        // Initialize Database Manager
        const dbManager = new DatabaseManager();
        
        // Wait for master connection to be ready
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        console.log('✅ Master database initialized successfully');
        console.log('📊 Architecture: Separate database per user');
        console.log('🗄️ Master database: finance_tracker_master');
        console.log('👥 User databases: finance_[username]_[userid]');
        
        console.log('\n🎉 Setup complete!');
        console.log('\n📝 What happens now:');
        console.log('- Each new user gets their own database');
        console.log('- Complete data isolation between users');
        console.log('- Master database manages user accounts');
        console.log('- User databases store transactions & categories');
        
        console.log('\n🚀 Start your server with: npm start');
        
        // Close connections
        await dbManager.closeAllConnections();
        
    } catch (error) {
        console.error('❌ Setup failed:', error.message);
        process.exit(1);
    }
}

setupSeparateDatabases();
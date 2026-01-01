// Monthly report API endpoint for Vercel
const { createClient } = require('@supabase/supabase-js');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);

// Create email transporter
const createTransporter = () => {
    return nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.SMTP_EMAIL,
            pass: process.env.SMTP_PASSWORD
        }
    });
};

// Generate monthly report data
const generateMonthlyReport = async (userId, month, year) => {
    const startDate = new Date(year, month - 1, 1).toISOString().split('T')[0];
    const endDate = new Date(year, month, 0).toISOString().split('T')[0];
    
    // Get transactions for the month
    const { data: transactions, error: transError } = await supabase
        .from('transactions')
        .select(`
            *,
            categories (
                id,
                name,
                color,
                type
            )
        `)
        .eq('user_id', userId)
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: false });
    
    if (transError) {
        throw new Error('Failed to fetch transactions: ' + transError.message);
    }
    
    // Calculate summary statistics
    const income = transactions
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + parseFloat(t.amount), 0);
    
    const expenses = transactions
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + parseFloat(t.amount), 0);
    
    const netSavings = income - expenses;
    
    // Group by categories
    const categoryStats = {};
    transactions.forEach(transaction => {
        const categoryName = transaction.categories?.name || 'Unknown';
        const categoryType = transaction.type;
        
        if (!categoryStats[categoryName]) {
            categoryStats[categoryName] = {
                type: categoryType,
                amount: 0,
                count: 0,
                color: transaction.categories?.color || '#ccc'
            };
        }
        
        categoryStats[categoryName].amount += parseFloat(transaction.amount);
        categoryStats[categoryName].count += 1;
    });
    
    // Sort categories by amount
    const sortedCategories = Object.entries(categoryStats)
        .sort(([,a], [,b]) => b.amount - a.amount);
    
    return {
        month,
        year,
        monthName: new Date(year, month - 1).toLocaleString('default', { month: 'long' }),
        summary: {
            totalIncome: income,
            totalExpenses: expenses,
            netSavings: netSavings,
            transactionCount: transactions.length
        },
        categories: sortedCategories,
        transactions: transactions.slice(0, 10) // Top 10 recent transactions
    };
};

// Generate HTML email template
const generateEmailHTML = (reportData, userName) => {
    const { monthName, year, summary, categories } = reportData;
    const formatCurrency = (amount) => `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
    
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <title>Monthly Financial Report - ${monthName} ${year}</title>
        <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px; margin-bottom: 30px; }
            .summary { background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 30px; }
            .summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; }
            .summary-item { text-align: center; padding: 15px; background: white; border-radius: 6px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
            .summary-value { font-size: 24px; font-weight: bold; margin-bottom: 5px; }
            .income { color: #27ae60; }
            .expense { color: #e74c3c; }
            .savings { color: #3498db; }
            .category-item { display: flex; justify-content: space-between; align-items: center; padding: 12px; margin-bottom: 8px; background: #f8f9fa; border-radius: 6px; border-left: 4px solid; }
            .category-name { font-weight: 500; }
            .category-amount { font-weight: bold; }
            .footer { text-align: center; margin-top: 30px; padding: 20px; background: #f8f9fa; border-radius: 8px; color: #666; }
            .btn { display: inline-block; padding: 12px 24px; background: #667eea; color: white; text-decoration: none; border-radius: 6px; margin-top: 15px; }
        </style>
    </head>
    <body>
        <div class="header">
            <h1>💰 Monthly Financial Report</h1>
            <h2>${monthName} ${year}</h2>
            <p>Hello ${userName}! Here's your financial summary for the month.</p>
        </div>
        
        <div class="summary">
            <h3>📊 Monthly Summary</h3>
            <div class="summary-grid">
                <div class="summary-item">
                    <div class="summary-value income">${formatCurrency(summary.totalIncome)}</div>
                    <div>Total Income</div>
                </div>
                <div class="summary-item">
                    <div class="summary-value expense">${formatCurrency(summary.totalExpenses)}</div>
                    <div>Total Expenses</div>
                </div>
                <div class="summary-item">
                    <div class="summary-value savings">${formatCurrency(summary.netSavings)}</div>
                    <div>Net Savings</div>
                </div>
                <div class="summary-item">
                    <div class="summary-value">${summary.transactionCount}</div>
                    <div>Transactions</div>
                </div>
            </div>
        </div>
        
        <div class="categories">
            <h3>📈 Top Categories</h3>
            ${categories.slice(0, 8).map(([name, data]) => `
                <div class="category-item" style="border-left-color: ${data.color}">
                    <div class="category-name">${name} (${data.count} transactions)</div>
                    <div class="category-amount ${data.type}">${formatCurrency(data.amount)}</div>
                </div>
            `).join('')}
        </div>
        
        <div class="footer">
            <p>This is an automated monthly report from your Personal Finance Tracker.</p>
            <a href="${process.env.FRONTEND_URL}" class="btn">View Full Dashboard</a>
            <p style="margin-top: 20px; font-size: 12px;">
                To stop receiving these reports, please update your preferences in the app settings.
            </p>
        </div>
    </body>
    </html>
    `;
};

export default async function handler(req, res) {
    console.log('Monthly reports API called:', {
        method: req.method,
        url: req.url,
        headers: req.headers.authorization ? 'Bearer token present' : 'No auth header'
    });
    
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', process.env.FRONTEND_URL || '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    try {
        if (req.method === 'POST') {
            // Manual report generation (for testing or user request)
            const authHeader = req.headers.authorization;
            if (!authHeader || !authHeader.startsWith('Bearer ')) {
                return res.status(401).json({ error: 'No token provided' });
            }
            
            const token = authHeader.substring(7);
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const userId = decoded.userId;
            
            const { month, year } = req.body;
            const currentDate = new Date();
            const reportMonth = month || currentDate.getMonth() + 1;
            const reportYear = year || currentDate.getFullYear();
            
            // Get user info
            const { data: user, error: userError } = await supabase
                .from('users')
                .select('first_name, last_name, email')
                .eq('id', userId)
                .single();
            
            if (userError || !user) {
                console.error('User lookup error:', userError);
                return res.status(404).json({ error: 'User not found' });
            }
            
            // Generate report
            const userName = `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'User';
            const reportData = await generateMonthlyReport(userId, reportMonth, reportYear);
            const emailHTML = generateEmailHTML(reportData, userName);
            
            // Send email
            const transporter = createTransporter();
            const mailOptions = {
                from: `"Personal Finance Tracker" <${process.env.SMTP_EMAIL}>`,
                to: user.email,
                subject: `Monthly Financial Report - ${reportData.monthName} ${reportData.year}`,
                html: emailHTML
            };
            
            await transporter.sendMail(mailOptions);
            
            res.json({ 
                message: 'Monthly report sent successfully',
                reportData: {
                    month: reportData.monthName,
                    year: reportData.year,
                    summary: reportData.summary
                }
            });
            
        } else if (req.method === 'GET') {
            // Automated monthly report generation (called by cron job)
            const cronSecret = req.headers['x-cron-secret'];
            if (cronSecret !== process.env.CRON_SECRET) {
                return res.status(401).json({ error: 'Unauthorized cron request' });
            }
            
            // Get all users who have email notifications enabled
            const { data: users, error: usersError } = await supabase
                .from('users')
                .select('id, first_name, last_name, email')
                .eq('email_notifications', true);
            
            if (usersError) {
                return res.status(500).json({ error: 'Failed to fetch users' });
            }
            
            const currentDate = new Date();
            const lastMonth = currentDate.getMonth() === 0 ? 12 : currentDate.getMonth();
            const reportYear = currentDate.getMonth() === 0 ? currentDate.getFullYear() - 1 : currentDate.getFullYear();
            
            const results = [];
            const transporter = createTransporter();
            
            for (const user of users) {
                try {
                    const reportData = await generateMonthlyReport(user.id, lastMonth, reportYear);
                    
                    // Only send if user had transactions in the month
                    if (reportData.summary.transactionCount > 0) {
                        const userName = `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'User';
                        const emailHTML = generateEmailHTML(reportData, userName);
                        
                        const mailOptions = {
                            from: `"Personal Finance Tracker" <${process.env.SMTP_EMAIL}>`,
                            to: user.email,
                            subject: `Monthly Financial Report - ${reportData.monthName} ${reportData.year}`,
                            html: emailHTML
                        };
                        
                        await transporter.sendMail(mailOptions);
                        results.push({ userId: user.id, status: 'sent', email: user.email });
                    } else {
                        results.push({ userId: user.id, status: 'skipped', reason: 'no_transactions' });
                    }
                } catch (error) {
                    console.error(`Failed to send report to user ${user.id}:`, error);
                    results.push({ userId: user.id, status: 'failed', error: error.message });
                }
            }
            
            res.json({ 
                message: 'Monthly reports processed',
                results,
                totalUsers: users.length,
                sentCount: results.filter(r => r.status === 'sent').length
            });
            
        } else {
            res.status(405).json({ error: 'Method not allowed' });
        }
        
    } catch (error) {
        console.error('Monthly report error:', error);
        res.status(500).json({ error: 'Internal server error: ' + error.message });
    }
}
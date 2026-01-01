/**
 * Personal Finance Tracker - Analytics Engine
 * Handles financial calculations and data analysis
 */

class AnalyticsEngine {
    constructor() {
        // Analytics engine initialization
    }

    /**
     * Calculate totals for income and expenses
     * @param {Array} transactions - Array of transactions
     * @returns {Object} Object with totalIncome and totalExpenses
     */
    calculateTotals(transactions) {
        if (!Array.isArray(transactions)) {
            console.warn('Invalid transactions array provided to calculateTotals');
            return { totalIncome: 0, totalExpenses: 0 };
        }

        const totals = transactions.reduce((acc, transaction) => {
            const amount = parseFloat(transaction.amount) || 0;
            
            if (transaction.type === 'income') {
                acc.totalIncome += amount;
            } else if (transaction.type === 'expense') {
                acc.totalExpenses += amount;
            }
            
            return acc;
        }, { totalIncome: 0, totalExpenses: 0 });

        return {
            totalIncome: Math.round(totals.totalIncome * 100) / 100,
            totalExpenses: Math.round(totals.totalExpenses * 100) / 100
        };
    }

    /**
     * Calculate net balance
     * @param {Array} transactions - Array of transactions
     * @returns {number} Net balance (income - expenses)
     */
    calculateBalance(transactions) {
        const totals = this.calculateTotals(transactions);
        const balance = totals.totalIncome - totals.totalExpenses;
        return Math.round(balance * 100) / 100;
    }

    /**
     * Get category breakdown
     * @param {Array} transactions - Array of transactions
     * @param {Array} categories - Array of categories for reference
     * @returns {Object} Category breakdown with amounts and percentages
     */
    getCategoryBreakdown(transactions, categories = []) {
        if (!Array.isArray(transactions)) {
            return {};
        }

        // Create category map for easy lookup
        const categoryMap = {};
        categories.forEach(cat => {
            categoryMap[cat.id] = cat;
        });

        // Group transactions by category
        const categoryTotals = {};
        let grandTotal = 0;

        transactions.forEach(transaction => {
            const categoryId = transaction.category_id || transaction.categoryId;
            const amount = parseFloat(transaction.amount) || 0;
            
            if (!categoryTotals[categoryId]) {
                const category = categoryMap[categoryId];
                categoryTotals[categoryId] = {
                    categoryId: categoryId,
                    categoryName: category ? category.name : 'Unknown',
                    categoryColor: category ? category.color : '#cccccc',
                    type: transaction.type,
                    amount: 0,
                    transactionCount: 0
                };
            }
            
            categoryTotals[categoryId].amount += amount;
            categoryTotals[categoryId].transactionCount += 1;
            grandTotal += amount;
        });

        // Calculate percentages and round amounts
        Object.keys(categoryTotals).forEach(categoryId => {
            const category = categoryTotals[categoryId];
            category.amount = Math.round(category.amount * 100) / 100;
            category.percentage = grandTotal > 0 ? Math.round((category.amount / grandTotal) * 100) : 0;
        });

        return categoryTotals;
    }

    /**
     * Get time series data for charts
     * @param {Array} transactions - Array of transactions
     * @param {string} period - Time period ('daily', 'weekly', 'monthly')
     * @param {Date} startDate - Start date for analysis
     * @param {Date} endDate - End date for analysis
     * @returns {Array} Time series data points
     */
    getTimeSeriesData(transactions, period = 'daily', startDate = null, endDate = null) {
        if (!Array.isArray(transactions)) {
            return [];
        }

        // Filter transactions by date range if provided
        let filteredTransactions = transactions;
        if (startDate || endDate) {
            filteredTransactions = transactions.filter(t => {
                const transactionDate = new Date(t.date);
                if (startDate && transactionDate < startDate) return false;
                if (endDate && transactionDate > endDate) return false;
                return true;
            });
        }

        // Group transactions by time period
        const timeGroups = {};
        
        filteredTransactions.forEach(transaction => {
            const date = new Date(transaction.date);
            let timeKey;
            
            switch (period) {
                case 'weekly':
                    // Get start of week (Sunday)
                    const weekStart = new Date(date);
                    weekStart.setDate(date.getDate() - date.getDay());
                    timeKey = weekStart.toISOString().split('T')[0];
                    break;
                case 'monthly':
                    timeKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                    break;
                case 'daily':
                default:
                    timeKey = date.toISOString().split('T')[0];
                    break;
            }
            
            if (!timeGroups[timeKey]) {
                timeGroups[timeKey] = {
                    date: timeKey,
                    income: 0,
                    expenses: 0,
                    transactionCount: 0
                };
            }
            
            const amount = parseFloat(transaction.amount) || 0;
            if (transaction.type === 'income') {
                timeGroups[timeKey].income += amount;
            } else if (transaction.type === 'expense') {
                timeGroups[timeKey].expenses += amount;
            }
            timeGroups[timeKey].transactionCount += 1;
        });

        // Convert to array and sort by date
        const timeSeriesData = Object.values(timeGroups).map(group => ({
            ...group,
            income: Math.round(group.income * 100) / 100,
            expenses: Math.round(group.expenses * 100) / 100,
            balance: Math.round((group.income - group.expenses) * 100) / 100
        }));

        return timeSeriesData.sort((a, b) => a.date.localeCompare(b.date));
    }

    /**
     * Get running balance over time
     * @param {Array} transactions - Array of transactions (should be sorted by date)
     * @returns {Array} Running balance data points
     */
    getRunningBalance(transactions) {
        if (!Array.isArray(transactions)) {
            return [];
        }

        // Sort transactions by date
        const sortedTransactions = [...transactions].sort((a, b) => 
            new Date(a.date) - new Date(b.date)
        );

        let runningBalance = 0;
        const balanceData = [];

        sortedTransactions.forEach(transaction => {
            const amount = parseFloat(transaction.amount) || 0;
            
            if (transaction.type === 'income') {
                runningBalance += amount;
            } else if (transaction.type === 'expense') {
                runningBalance -= amount;
            }
            
            balanceData.push({
                date: transaction.date,
                balance: Math.round(runningBalance * 100) / 100,
                transactionId: transaction.id,
                transactionType: transaction.type,
                transactionAmount: amount
            });
        });

        return balanceData;
    }

    /**
     * Get spending trends analysis
     * @param {Array} transactions - Array of transactions
     * @param {number} days - Number of days to analyze (default: 30)
     * @returns {Object} Spending trends analysis
     */
    getSpendingTrends(transactions, days = 30) {
        if (!Array.isArray(transactions)) {
            return { trend: 'stable', change: 0, analysis: 'No data available' };
        }

        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);

        const recentTransactions = transactions.filter(t => 
            new Date(t.date) >= cutoffDate && t.type === 'expense'
        );

        if (recentTransactions.length < 2) {
            return { trend: 'stable', change: 0, analysis: 'Insufficient data for trend analysis' };
        }

        // Split into two halves for comparison
        const midPoint = Math.floor(recentTransactions.length / 2);
        const firstHalf = recentTransactions.slice(0, midPoint);
        const secondHalf = recentTransactions.slice(midPoint);

        const firstHalfTotal = firstHalf.reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);
        const secondHalfTotal = secondHalf.reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);

        const firstHalfAvg = firstHalfTotal / firstHalf.length;
        const secondHalfAvg = secondHalfTotal / secondHalf.length;

        const change = ((secondHalfAvg - firstHalfAvg) / firstHalfAvg) * 100;
        const roundedChange = Math.round(change * 100) / 100;

        let trend, analysis;
        if (Math.abs(roundedChange) < 5) {
            trend = 'stable';
            analysis = 'Your spending has remained relatively stable';
        } else if (roundedChange > 0) {
            trend = 'increasing';
            analysis = `Your spending has increased by ${Math.abs(roundedChange)}%`;
        } else {
            trend = 'decreasing';
            analysis = `Your spending has decreased by ${Math.abs(roundedChange)}%`;
        }

        return { trend, change: roundedChange, analysis };
    }

    /**
     * Get monthly comparison
     * @param {Array} transactions - Array of transactions
     * @param {number} monthsBack - Number of months to compare (default: 2)
     * @returns {Object} Monthly comparison data
     */
    getMonthlyComparison(transactions, monthsBack = 2) {
        if (!Array.isArray(transactions)) {
            return {};
        }

        const now = new Date();
        const monthlyData = {};

        for (let i = 0; i < monthsBack; i++) {
            const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const monthKey = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}`;
            const monthName = monthDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
            
            const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
            const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);
            
            const monthTransactions = transactions.filter(t => {
                const transactionDate = new Date(t.date);
                return transactionDate >= monthStart && transactionDate <= monthEnd;
            });

            const totals = this.calculateTotals(monthTransactions);
            
            monthlyData[monthKey] = {
                month: monthName,
                monthKey: monthKey,
                income: totals.totalIncome,
                expenses: totals.totalExpenses,
                balance: totals.totalIncome - totals.totalExpenses,
                transactionCount: monthTransactions.length
            };
        }

        return monthlyData;
    }

    /**
     * Get top spending categories
     * @param {Array} transactions - Array of transactions
     * @param {Array} categories - Array of categories
     * @param {number} limit - Number of top categories to return
     * @returns {Array} Top spending categories
     */
    getTopSpendingCategories(transactions, categories = [], limit = 5) {
        const expenseTransactions = transactions.filter(t => t.type === 'expense');
        const categoryBreakdown = this.getCategoryBreakdown(expenseTransactions, categories);
        
        return Object.values(categoryBreakdown)
            .sort((a, b) => b.amount - a.amount)
            .slice(0, limit);
    }

    /**
     * Get financial health score
     * @param {Array} transactions - Array of transactions
     * @returns {Object} Financial health analysis
     */
    getFinancialHealthScore(transactions) {
        if (!Array.isArray(transactions) || transactions.length === 0) {
            return { score: 0, rating: 'No Data', factors: [] };
        }

        const totals = this.calculateTotals(transactions);
        const factors = [];
        let score = 0;

        // Factor 1: Positive balance (40 points)
        if (totals.totalIncome > totals.totalExpenses) {
            score += 40;
            factors.push('✅ Positive cash flow');
        } else {
            factors.push('❌ Negative cash flow');
        }

        // Factor 2: Income vs expenses ratio (30 points)
        if (totals.totalIncome > 0) {
            const savingsRate = (totals.totalIncome - totals.totalExpenses) / totals.totalIncome;
            if (savingsRate >= 0.2) {
                score += 30;
                factors.push('✅ Good savings rate (20%+)');
            } else if (savingsRate >= 0.1) {
                score += 20;
                factors.push('⚠️ Moderate savings rate (10-20%)');
            } else if (savingsRate >= 0) {
                score += 10;
                factors.push('⚠️ Low savings rate (<10%)');
            } else {
                factors.push('❌ Spending exceeds income');
            }
        }

        // Factor 3: Transaction consistency (30 points)
        const recentTransactions = transactions.filter(t => {
            const transactionDate = new Date(t.date);
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            return transactionDate >= thirtyDaysAgo;
        });

        if (recentTransactions.length >= 10) {
            score += 30;
            factors.push('✅ Regular transaction tracking');
        } else if (recentTransactions.length >= 5) {
            score += 20;
            factors.push('⚠️ Some transaction tracking');
        } else {
            score += 10;
            factors.push('❌ Limited transaction tracking');
        }

        // Determine rating
        let rating;
        if (score >= 80) rating = 'Excellent';
        else if (score >= 60) rating = 'Good';
        else if (score >= 40) rating = 'Fair';
        else if (score >= 20) rating = 'Poor';
        else rating = 'Very Poor';

        return { score, rating, factors };
    }
}

// Export for use in other modules
window.AnalyticsEngine = AnalyticsEngine;
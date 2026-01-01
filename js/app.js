/**
 * Personal Finance Tracker - Main Application
 * Initializes and coordinates all application components
 */

class FinanceTrackerApp {
    constructor() {
        this.currentTab = 'dashboard';
        this.isInitialized = false;
        
        // Component instances will be initialized later
        this.database = null;
        this.transactionManager = null;
        this.categoryManager = null;
        this.analytics = null;
    }

    /**
     * Handle OAuth callback with token
     */
    async handleOAuthCallback() {
        // Create persistent debug display
        const debugDiv = document.createElement('div');
        debugDiv.id = 'oauth-debug';
        debugDiv.style.cssText = `
            position: fixed; top: 10px; left: 10px; 
            background: black; color: white; 
            padding: 10px; font-size: 12px; 
            z-index: 99999; max-width: 400px;
            border-radius: 5px;
        `;
        document.body.appendChild(debugDiv);
        
        const log = (msg) => {
            console.log(msg);
            debugDiv.innerHTML += msg + '<br>';
        };
        
        log('=== OAUTH CALLBACK CHECK ===');
        log('Current URL: ' + window.location.href);
        
        const urlParams = new URLSearchParams(window.location.search);
        const token = urlParams.get('token');
        const loginSuccess = urlParams.get('login');
        
        log('Token present: ' + (token ? 'YES' : 'NO'));
        log('Login success: ' + loginSuccess);
        
        if (token && loginSuccess === 'success') {
            log('Processing OAuth token...');
            
            // Store the JWT token with the key AuthManager expects
            localStorage.setItem('accessToken', token);
            log('Token stored in localStorage as accessToken');
            
            // Decode and store user info
            try {
                const payload = JSON.parse(atob(token.split('.')[1]));
                const userInfo = {
                    userId: payload.userId,
                    username: payload.username,
                    email: payload.email
                };
                // Store user info with the key AuthManager expects
                localStorage.setItem('user', JSON.stringify(userInfo));
                log('User info stored: ' + userInfo.username);
                
                // IMPORTANT: Force AuthManager to reload from storage immediately
                if (window.AuthManager) {
                    window.AuthManager.loadFromStorage();
                    log('AuthManager reloaded from storage');
                }
                
                // Update UI with user info
                this.updateUserDisplay(userInfo);
                
                Utils.showToast('Login successful! Welcome back!', 'success');
                log('Success toast shown');
            } catch (error) {
                log('Error decoding token: ' + error.message);
            }
            
            // Clean up URL parameters
            const cleanUrl = window.location.origin + window.location.pathname;
            window.history.replaceState({}, document.title, cleanUrl);
            log('URL cleaned up');
            
            // Remove debug display after 5 seconds
            setTimeout(() => {
                if (debugDiv.parentNode) {
                    debugDiv.parentNode.removeChild(debugDiv);
                }
            }, 5000);
        } else {
            log('No OAuth callback detected');
            // Remove debug display after 2 seconds if no OAuth
            setTimeout(() => {
                if (debugDiv.parentNode) {
                    debugDiv.parentNode.removeChild(debugDiv);
                }
            }, 2000);
        }
    }

    /**
     * Update user display in navigation
     */
    updateUserDisplay(userInfo) {
        const userNameElement = document.getElementById('user-name');
        const userEmailElement = document.getElementById('user-email');
        const userDisplayNameElement = document.getElementById('user-display-name');
        
        if (userNameElement) userNameElement.textContent = userInfo.username;
        if (userEmailElement) userEmailElement.textContent = userInfo.email;
        if (userDisplayNameElement) userDisplayNameElement.textContent = userInfo.username;
    }

    /**
     * Initialize the application
     */
    async init() {
        try {
            Utils.showLoading();
            
            // Check for OAuth success token first
            await this.handleOAuthCallback();
            
            // TEMPORARY: Force authentication for testing
            const urlParams = new URLSearchParams(window.location.search);
            if (urlParams.get('token')) {
                console.log('OAuth token detected, processing...');
                // Process OAuth but continue with normal app initialization
                Utils.showToast('OAuth Success! Initializing app...', 'success');
                
                // Update URL to remove token
                const cleanUrl = window.location.origin + window.location.pathname;
                window.history.replaceState({}, document.title, cleanUrl);
                
                // Show user info in UI
                const userInfo = JSON.parse(localStorage.getItem('user') || '{}');
                if (userInfo.username) {
                    this.updateUserDisplay(userInfo);
                }
                
                // Continue with normal initialization instead of returning
            }
            
            // Initialize database first
            this.database = new DatabaseService();
            await this.database.initializeDB();
            
            // Initialize managers
            this.categoryManager = new CategoryManager(this.database);
            this.transactionManager = new TransactionManager(this.database);
            this.analytics = new AnalyticsEngine();
            
            // Set up event listeners
            this.setupEventListeners();
            
            // Initialize default categories if needed
            await this.initializeDefaultCategories();
            
            // Load initial data
            await this.loadDashboard();
            
            // Set current date as default in transaction form
            this.setDefaultTransactionDate();
            
            this.isInitialized = true;
            Utils.hideLoading();
            
            Utils.showToast('Finance Tracker loaded successfully!', 'success');
            
        } catch (error) {
            console.error('Failed to initialize app:', error);
            Utils.hideLoading();
            Utils.showToast('Failed to initialize application. Please refresh the page.', 'error');
        }
    }

    /**
     * Set up all event listeners
     */
    setupEventListeners() {
        // Navigation
        this.setupNavigationListeners();
        
        // Transaction form
        this.setupTransactionFormListeners();
        
        // Category management
        this.setupCategoryListeners();
        
        // History and filters
        this.setupHistoryListeners();
        
        // Analytics
        this.setupAnalyticsListeners();
        
        // Import/Export
        this.setupImportExportListeners();
        
        // Mobile navigation
        this.setupMobileNavigation();
    }

    /**
     * Set up navigation event listeners
     */
    setupNavigationListeners() {
        const navTabs = document.querySelectorAll('.nav-tab');
        navTabs.forEach(tab => {
            tab.addEventListener('click', (e) => {
                const tabName = e.target.dataset.tab;
                this.switchTab(tabName);
            });
        });

        // Quick action buttons
        const quickAddExpense = document.getElementById('quick-add-expense');
        const quickAddIncome = document.getElementById('quick-add-income');
        
        if (quickAddExpense) {
            quickAddExpense.addEventListener('click', () => {
                this.switchTab('transactions');
                document.getElementById('transaction-type').value = 'expense';
            });
        }
        
        if (quickAddIncome) {
            quickAddIncome.addEventListener('click', () => {
                this.switchTab('transactions');
                document.getElementById('transaction-type').value = 'income';
            });
        }
    }

    /**
     * Set up transaction form event listeners
     */
    setupTransactionFormListeners() {
        const form = document.getElementById('transaction-form');
        if (form) {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.handleTransactionSubmit(e);
            });
        }

        // Type change handler to update categories
        const typeSelect = document.getElementById('transaction-type');
        if (typeSelect) {
            typeSelect.addEventListener('change', () => {
                this.updateCategoryOptions();
            });
        }

        // Real-time validation
        const amountInput = document.getElementById('transaction-amount');
        if (amountInput) {
            amountInput.addEventListener('input', this.validateTransactionForm.bind(this));
        }

        const categorySelect = document.getElementById('transaction-category');
        if (categorySelect) {
            categorySelect.addEventListener('change', this.validateTransactionForm.bind(this));
        }
    }

    /**
     * Validate transaction form in real-time
     */
    validateTransactionForm() {
        const form = document.getElementById('transaction-form');
        const amountInput = document.getElementById('transaction-amount');
        const typeSelect = document.getElementById('transaction-type');
        const categorySelect = document.getElementById('transaction-category');
        const submitBtn = form.querySelector('button[type="submit"]');

        let isValid = true;
        
        // Clear previous errors
        form.querySelectorAll('.form-error').forEach(error => error.remove());
        form.querySelectorAll('.form-group').forEach(group => group.classList.remove('error'));

        // Validate amount
        const amount = parseFloat(amountInput.value);
        if (!amount || amount <= 0) {
            this.showFieldError(amountInput, 'Amount must be greater than 0');
            isValid = false;
        }

        // Validate type
        if (!typeSelect.value) {
            this.showFieldError(typeSelect, 'Please select a transaction type');
            isValid = false;
        }

        // Validate category
        if (!categorySelect.value) {
            this.showFieldError(categorySelect, 'Please select a category');
            isValid = false;
        }

        // Enable/disable submit button
        submitBtn.disabled = !isValid;
    }

    /**
     * Show field validation error
     * @param {HTMLElement} field - Form field element
     * @param {string} message - Error message
     */
    showFieldError(field, message) {
        const formGroup = field.closest('.form-group');
        formGroup.classList.add('error');
        
        const errorElement = document.createElement('div');
        errorElement.className = 'form-error';
        errorElement.textContent = message;
        formGroup.appendChild(errorElement);
    }

    /**
     * Set up category management listeners
     */
    setupCategoryListeners() {
        const addCategoryBtn = document.getElementById('add-category-btn');
        if (addCategoryBtn) {
            addCategoryBtn.addEventListener('click', () => {
                this.showCategoryModal();
            });
        }

        // Modal listeners
        const modal = document.getElementById('category-modal');
        const closeBtn = modal?.querySelector('.modal-close');
        const cancelBtn = modal?.querySelector('.modal-cancel');
        const form = document.getElementById('category-form');

        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                this.hideCategoryModal();
            });
        }

        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                this.hideCategoryModal();
            });
        }

        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.hideCategoryModal();
                }
            });
        }

        if (form) {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.handleCategorySubmit(e);
            });
        }
    }

    /**
     * Set up history and filter listeners
     */
    setupHistoryListeners() {
        const applyFiltersBtn = document.getElementById('apply-filters');
        const clearFiltersBtn = document.getElementById('clear-filters');

        if (applyFiltersBtn) {
            applyFiltersBtn.addEventListener('click', () => {
                this.applyTransactionFilters();
            });
        }

        if (clearFiltersBtn) {
            clearFiltersBtn.addEventListener('click', () => {
                this.clearTransactionFilters();
            });
        }
    }

    /**
     * Set up analytics listeners
     */
    setupAnalyticsListeners() {
        const periodBtns = document.querySelectorAll('.period-btn');
        periodBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const period = e.target.dataset.period;
                this.updateAnalyticsPeriod(period);
            });
        });
    }

    /**
     * Set up import/export listeners
     */
    setupImportExportListeners() {
        const exportBtn = document.getElementById('export-data');
        const importBtn = document.getElementById('import-data');
        const fileInput = document.getElementById('import-file-input');

        if (exportBtn) {
            exportBtn.addEventListener('click', () => {
                this.exportData();
            });
        }

        if (importBtn) {
            importBtn.addEventListener('click', () => {
                fileInput?.click();
            });
        }

        if (fileInput) {
            fileInput.addEventListener('change', async (e) => {
                const file = e.target.files[0];
                if (file) {
                    await this.importData(file);
                    e.target.value = ''; // Reset file input
                }
            });
        }
    }

    /**
     * Set up mobile navigation
     */
    setupMobileNavigation() {
        const hamburger = document.querySelector('.hamburger-menu');
        const navTabs = document.querySelector('.nav-tabs');

        if (hamburger && navTabs) {
            hamburger.addEventListener('click', () => {
                navTabs.classList.toggle('mobile-open');
            });

            // Close mobile menu when tab is clicked
            navTabs.addEventListener('click', (e) => {
                if (e.target.classList.contains('nav-tab')) {
                    navTabs.classList.remove('mobile-open');
                }
            });
        }
    }

    /**
     * Switch between application tabs
     * @param {string} tabName - Name of the tab to switch to
     */
    switchTab(tabName) {
        // Update navigation
        document.querySelectorAll('.nav-tab').forEach(tab => {
            tab.classList.remove('active');
        });
        document.querySelector(`[data-tab="${tabName}"]`)?.classList.add('active');

        // Update content sections
        document.querySelectorAll('.content-section').forEach(section => {
            section.classList.remove('active');
        });
        document.getElementById(tabName)?.classList.add('active');

        this.currentTab = tabName;

        // Load tab-specific data
        this.loadTabData(tabName);
    }

    /**
     * Load data for specific tab
     * @param {string} tabName - Name of the tab
     */
    async loadTabData(tabName) {
        if (!this.database) return;

        try {
            switch (tabName) {
                case 'dashboard':
                    await this.loadDashboard();
                    break;
                case 'transactions':
                    await this.loadTransactionForm();
                    break;
                case 'history':
                    await this.loadTransactionHistory();
                    break;
                case 'analytics':
                    await this.loadAnalytics();
                    break;
                case 'categories':
                    await this.loadCategories();
                    break;
            }
        } catch (error) {
            console.error(`Failed to load ${tabName} data:`, error);
            Utils.showToast(`Failed to load ${tabName} data`, 'error');
        }
    }

    /**
     * Load dashboard data
     */
    async loadDashboard() {
        // Allow loading during initialization or when fully initialized
        if (!this.database) return;
        
        try {
            console.log('Loading dashboard data...');
            
            // Get current month date range - Properly fixed
            const now = new Date();
            const year = now.getFullYear();
            const month = now.getMonth(); // 0-based (December = 11)
            
            // First day of current month
            const startDate = `${year}-${String(month + 1).padStart(2, '0')}-01`;
            
            // Last day of current month - use proper calculation
            const lastDayOfMonth = new Date(year, month + 1, 0).getDate();
            const endDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDayOfMonth).padStart(2, '0')}`;
            
            console.log(`Current date: ${now.toISOString()}`);
            console.log(`Month: ${month + 1} (${now.toLocaleString('default', { month: 'long' })})`);
            console.log(`Fetching analytics for ${startDate} to ${endDate}`);
            
            // Get analytics data using authenticated DatabaseService
            const analytics = await this.database.getAnalytics({
                start_date: startDate,
                end_date: endDate
            });
            
            const stats = analytics.stats;
            console.log('Analytics data received:', stats);
            
            // Update summary cards with proper null handling
            const totalIncome = parseFloat(stats.total_income) || 0;
            const totalExpenses = parseFloat(stats.total_expenses) || 0;
            const balance = totalIncome - totalExpenses;
            
            console.log(`Updating dashboard: Income=${totalIncome}, Expenses=${totalExpenses}, Balance=${balance}`);
            
            // Add debugging for DOM elements
            const incomeElement = document.getElementById('total-income');
            const expensesElement = document.getElementById('total-expenses');
            const balanceElement = document.getElementById('net-balance');
            
            console.log('DOM elements found:', {
                income: !!incomeElement,
                expenses: !!expensesElement,
                balance: !!balanceElement
            });
            
            if (incomeElement) {
                incomeElement.textContent = Utils.formatCurrency(totalIncome);
                console.log('Updated income element:', incomeElement.textContent);
            } else {
                console.error('total-income element not found!');
            }
            
            if (expensesElement) {
                expensesElement.textContent = Utils.formatCurrency(totalExpenses);
                console.log('Updated expenses element:', expensesElement.textContent);
            } else {
                console.error('total-expenses element not found!');
            }
            
            if (balanceElement) {
                balanceElement.textContent = Utils.formatCurrency(balance);
                console.log('Updated balance element:', balanceElement.textContent);
            } else {
                console.error('net-balance element not found!');
            }
            
            // Update balance color based on positive/negative
            if (balanceElement) {
                if (balance >= 0) {
                    balanceElement.className = 'amount text-success';
                } else {
                    balanceElement.className = 'amount text-danger';
                }
                console.log('Updated balance color:', balanceElement.className);
            }
            
            // Load recent transactions
            await this.loadRecentTransactions();
            
            console.log('Dashboard loaded successfully');
            
        } catch (error) {
            console.error('Failed to load dashboard:', error);
            Utils.showToast('Failed to load dashboard data: ' + error.message, 'error');
        }
    }

    /**
     * Load recent transactions for dashboard
     */
    async loadRecentTransactions() {
        try {
            // Get recent transactions using DatabaseService
            const recentTransactions = await this.database.getTransactions({ limit: 5 });
            const container = document.getElementById('recent-transactions-list');
            
            if (recentTransactions.length === 0) {
                container.innerHTML = `
                    <div class="empty-state">
                        <div class="empty-state-icon">📝</div>
                        <h3>No transactions yet</h3>
                        <p>Add your first transaction to get started!</p>
                        <button class="btn btn-primary" onclick="FinanceApp.switchTab('transactions')">Add Transaction</button>
                    </div>
                `;
                return;
            }
            
            // Get categories for display
            const categories = await this.database.getCategories();
            const categoryMap = {};
            categories.forEach(cat => {
                categoryMap[cat.id] = cat;
            });
            
            container.innerHTML = recentTransactions.map(transaction => {
                const category = categoryMap[transaction.category_id];
                const categoryName = category ? category.name : 'Unknown';
                const categoryColor = category ? category.color : '#ccc';
                
                return `
                    <div class="transaction-item">
                        <div class="transaction-icon ${transaction.type}" style="background-color: ${categoryColor}">
                            ${transaction.type === 'income' ? '+' : '-'}
                        </div>
                        <div class="transaction-details">
                            <div class="transaction-info">
                                <h4>${categoryName}</h4>
                                <div class="transaction-meta">
                                    <span>${Utils.formatDate(transaction.date)}</span>
                                    ${transaction.note ? `<span>${transaction.note}</span>` : ''}
                                </div>
                            </div>
                            <div class="transaction-amount ${transaction.type}">
                                ${transaction.type === 'income' ? '+' : '-'}${Utils.formatCurrency(parseFloat(transaction.amount))}
                            </div>
                        </div>
                    </div>
                `;
            }).join('');
            
        } catch (error) {
            console.error('Failed to load recent transactions:', error);
        }
    }

    /**
     * Load transaction form
     */
    async loadTransactionForm() {
        await this.updateCategoryOptions();
        this.setDefaultTransactionDate();
    }

    /**
     * Load transaction history
     */
    async loadTransactionHistory() {
        if (!this.database) return;
        
        try {
            const transactions = await this.transactionManager.getTransactions();
            const categories = await this.categoryManager.getCategories();
            
            this.displayTransactionHistory(transactions, categories);
            
        } catch (error) {
            console.error('Failed to load transaction history:', error);
            Utils.showToast('Failed to load transaction history', 'error');
        }
    }

    /**
     * Display transaction history
     * @param {Array} transactions - Array of transactions
     * @param {Array} categories - Array of categories
     */
    displayTransactionHistory(transactions, categories) {
        const container = document.getElementById('transaction-history');
        
        if (transactions.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">📝</div>
                    <h3>No transactions found</h3>
                    <p>Add your first transaction to get started!</p>
                    <button class="btn btn-primary" onclick="FinanceApp.switchTab('transactions')">Add Transaction</button>
                </div>
            `;
            return;
        }
        
        // Create category map for quick lookup
        const categoryMap = {};
        categories.forEach(cat => {
            categoryMap[cat.id] = cat;
        });
        
        container.innerHTML = `
            <div class="transaction-list">
                ${transactions.map(transaction => {
                    const category = categoryMap[transaction.category_id || transaction.categoryId]; // Handle both field names
                    const categoryName = category ? category.name : 'Unknown';
                    const categoryColor = category ? category.color : '#ccc';
                    
                    return `
                        <div class="transaction-item">
                            <div class="transaction-icon ${transaction.type}" style="background-color: ${categoryColor}">
                                ${transaction.type === 'income' ? '+' : '-'}
                            </div>
                            <div class="transaction-details">
                                <div class="transaction-info">
                                    <h4>${categoryName}</h4>
                                    <div class="transaction-meta">
                                        <span>${Utils.formatDate(transaction.date)}</span>
                                        ${transaction.note ? `<span>${transaction.note}</span>` : ''}
                                    </div>
                                </div>
                                <div class="transaction-amount ${transaction.type}">
                                    ${transaction.type === 'income' ? '+' : '-'}${Utils.formatCurrency(transaction.amount)}
                                </div>
                            </div>
                            <div class="transaction-actions">
                                <button class="btn btn-secondary" onclick="FinanceApp.editTransaction('${transaction.id}')">Edit</button>
                                <button class="btn btn-danger" onclick="FinanceApp.deleteTransaction('${transaction.id}')">Delete</button>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    }

    /**
     * Apply transaction filters
     */
    async applyTransactionFilters() {
        if (!this.database) return;
        
        try {
            const filters = {
                type: document.getElementById('filter-type').value || undefined,
                categoryId: document.getElementById('filter-category').value || undefined,
                startDate: document.getElementById('filter-date-from').value ? new Date(document.getElementById('filter-date-from').value) : undefined,
                endDate: document.getElementById('filter-date-to').value ? new Date(document.getElementById('filter-date-to').value) : undefined
            };
            
            // Remove undefined values
            Object.keys(filters).forEach(key => {
                if (filters[key] === undefined) {
                    delete filters[key];
                }
            });
            
            const transactions = await this.transactionManager.getTransactions(filters);
            const categories = await this.categoryManager.getCategories();
            
            this.displayTransactionHistory(transactions, categories);
            
        } catch (error) {
            console.error('Failed to apply filters:', error);
            Utils.showToast('Failed to apply filters', 'error');
        }
    }

    /**
     * Edit transaction
     * @param {string} transactionId - Transaction ID
     */
    async editTransaction(transactionId) {
        try {
            const transaction = await this.transactionManager.getTransaction(transactionId);
            if (!transaction) {
                Utils.showToast('Transaction not found', 'error');
                return;
            }
            
            // Switch to transaction form and populate with data
            this.switchTab('transactions');
            
            // Populate form
            document.getElementById('transaction-type').value = transaction.type;
            document.getElementById('transaction-amount').value = transaction.amount;
            document.getElementById('transaction-date').value = Utils.formatDate(transaction.date, 'input');
            document.getElementById('transaction-note').value = transaction.note || '';
            
            // Update categories and set selected
            await this.updateCategoryOptions();
            document.getElementById('transaction-category').value = transaction.category_id || transaction.categoryId;
            
            // Store transaction ID for update
            const form = document.getElementById('transaction-form');
            form.dataset.transactionId = transactionId;
            
            // Change submit button text
            const submitBtn = form.querySelector('button[type="submit"]');
            submitBtn.textContent = 'Update Transaction';
            
        } catch (error) {
            console.error('Failed to edit transaction:', error);
            Utils.showToast('Failed to load transaction for editing', 'error');
        }
    }

    /**
     * Delete transaction with confirmation
     * @param {string} transactionId - Transaction ID
     */
    async deleteTransaction(transactionId) {
        try {
            const transaction = await this.transactionManager.getTransaction(transactionId);
            if (!transaction) {
                Utils.showToast('Transaction not found', 'error');
                return;
            }

            const confirmMessage = `Are you sure you want to delete this ${transaction.type} of ${Utils.formatCurrency(transaction.amount)}?`;
            
            Utils.showConfirmDialog(confirmMessage, async () => {
                try {
                    Utils.showLoading();
                    await this.transactionManager.deleteTransaction(transactionId);
                    await this.loadTransactionHistory();
                    await this.loadDashboard();
                    Utils.hideLoading();
                    Utils.showToast('Transaction deleted successfully!', 'success');
                } catch (error) {
                    console.error('Failed to delete transaction:', error);
                    Utils.hideLoading();
                    Utils.showToast('Failed to delete transaction: ' + error.message, 'error');
                }
            });
            
        } catch (error) {
            console.error('Failed to delete transaction:', error);
            Utils.showToast('Failed to delete transaction: ' + error.message, 'error');
        }
    }

    /**
     * Load analytics
     */
    async loadAnalytics() {
        try {
            console.log('Loading analytics...');
            
            // Get current period (default to month)
            const period = document.querySelector('.period-btn.active')?.dataset.period || 'month';
            const dateRange = Utils.getDateRange(period);
            
            // Get transactions for the selected period
            const transactions = await this.database.getTransactionsByDateRange(
                dateRange.startDate, 
                dateRange.endDate
            );
            
            // Get categories for reference
            const categories = await this.database.getRecords('categories');
            
            // Create charts
            await this.createAnalyticsCharts(transactions, categories, period);
            
            // Set up period selector event listeners
            this.setupPeriodSelector();
            
        } catch (error) {
            console.error('Failed to load analytics:', error);
            Utils.showToast('Failed to load analytics', 'error');
        }
    }

    /**
     * Create analytics charts
     */
    async createAnalyticsCharts(transactions, categories, period) {
        // Clear existing charts
        this.destroyExistingCharts();
        
        // 1. Category Distribution Pie Chart
        this.createCategoryPieChart(transactions, categories);
        
        // 2. Income vs Expenses Bar Chart
        this.createIncomeExpenseChart(transactions, period);
        
        // 3. Balance Over Time Line Chart
        this.createBalanceLineChart(transactions, period);
    }

    /**
     * Create category distribution pie chart
     */
    createCategoryPieChart(transactions, categories) {
        const expenseTransactions = transactions.filter(t => t.type === 'expense');
        const categoryBreakdown = this.analytics.getCategoryBreakdown(expenseTransactions, categories);
        
        const ctx = document.getElementById('category-pie-chart');
        if (!ctx) return;
        
        const data = Object.values(categoryBreakdown);
        
        if (data.length === 0) {
            ctx.getContext('2d').clearRect(0, 0, ctx.width, ctx.height);
            const context = ctx.getContext('2d');
            context.font = '16px Arial';
            context.fillStyle = '#666';
            context.textAlign = 'center';
            context.fillText('No expense data available', ctx.width / 2, ctx.height / 2);
            return;
        }
        
        this.categoryChart = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: data.map(d => d.categoryName),
                datasets: [{
                    data: data.map(d => d.amount),
                    backgroundColor: data.map(d => d.categoryColor),
                    borderWidth: 2,
                    borderColor: '#fff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom'
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const label = context.label || '';
                                const value = context.parsed;
                                const percentage = data[context.dataIndex].percentage;
                                return `${label}: ₹${value.toFixed(2)} (${percentage}%)`;
                            }
                        }
                    }
                }
            }
        });
    }

    /**
     * Create income vs expenses bar chart
     */
    createIncomeExpenseChart(transactions, period) {
        const timeSeriesData = this.analytics.getTimeSeriesData(transactions, period === 'year' ? 'monthly' : 'daily');
        
        const ctx = document.getElementById('income-expense-chart');
        if (!ctx) return;
        
        if (timeSeriesData.length === 0) {
            ctx.getContext('2d').clearRect(0, 0, ctx.width, ctx.height);
            const context = ctx.getContext('2d');
            context.font = '16px Arial';
            context.fillStyle = '#666';
            context.textAlign = 'center';
            context.fillText('No transaction data available', ctx.width / 2, ctx.height / 2);
            return;
        }
        
        this.incomeExpenseChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: timeSeriesData.map(d => {
                    const date = new Date(d.date);
                    return period === 'year' ? 
                        date.toLocaleDateString('en-US', { month: 'short' }) :
                        date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                }),
                datasets: [
                    {
                        label: 'Income',
                        data: timeSeriesData.map(d => d.income),
                        backgroundColor: '#28a745',
                        borderColor: '#28a745',
                        borderWidth: 1
                    },
                    {
                        label: 'Expenses',
                        data: timeSeriesData.map(d => d.expenses),
                        backgroundColor: '#dc3545',
                        borderColor: '#dc3545',
                        borderWidth: 1
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                return '₹' + value.toFixed(0);
                            }
                        }
                    }
                },
                plugins: {
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return `${context.dataset.label}: ₹${context.parsed.y.toFixed(2)}`;
                            }
                        }
                    }
                }
            }
        });
    }

    /**
     * Create balance over time line chart
     */
    createBalanceLineChart(transactions, period) {
        const runningBalance = this.analytics.getRunningBalance(transactions);
        
        const ctx = document.getElementById('balance-line-chart');
        if (!ctx) return;
        
        if (runningBalance.length === 0) {
            ctx.getContext('2d').clearRect(0, 0, ctx.width, ctx.height);
            const context = ctx.getContext('2d');
            context.font = '16px Arial';
            context.fillStyle = '#666';
            context.textAlign = 'center';
            context.fillText('No transaction data available', ctx.width / 2, ctx.height / 2);
            return;
        }
        
        this.balanceChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: runningBalance.map(d => {
                    const date = new Date(d.date);
                    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                }),
                datasets: [{
                    label: 'Balance',
                    data: runningBalance.map(d => d.balance),
                    borderColor: '#007bff',
                    backgroundColor: 'rgba(0, 123, 255, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        ticks: {
                            callback: function(value) {
                                return '₹' + value.toFixed(0);
                            }
                        }
                    }
                },
                plugins: {
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return `Balance: ₹${context.parsed.y.toFixed(2)}`;
                            }
                        }
                    }
                }
            }
        });
    }

    /**
     * Setup period selector event listeners
     */
    setupPeriodSelector() {
        const periodButtons = document.querySelectorAll('.period-btn');
        periodButtons.forEach(btn => {
            btn.addEventListener('click', async (e) => {
                // Update active button
                periodButtons.forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                
                // Reload analytics with new period
                await this.loadAnalytics();
            });
        });
    }

    /**
     * Destroy existing charts to prevent memory leaks
     */
    destroyExistingCharts() {
        if (this.categoryChart) {
            this.categoryChart.destroy();
            this.categoryChart = null;
        }
        if (this.incomeExpenseChart) {
            this.incomeExpenseChart.destroy();
            this.incomeExpenseChart = null;
        }
        if (this.balanceChart) {
            this.balanceChart.destroy();
            this.balanceChart = null;
        }
    }

    /**
     * Load categories
     */
    async loadCategories() {
        if (!this.database) return;
        
        try {
            const categories = await this.categoryManager.getCategories();
            const container = document.getElementById('categories-list');
            
            if (categories.length === 0) {
                container.innerHTML = `
                    <div class="empty-state">
                        <div class="empty-state-icon">🏷️</div>
                        <h3>No categories found</h3>
                        <p>Create your first category to get started!</p>
                        <button class="btn btn-primary" onclick="FinanceApp.showCategoryModal()">Add Category</button>
                    </div>
                `;
                return;
            }
            
            container.innerHTML = categories.map(category => `
                <div class="category-card" data-category-id="${category.id}">
                    <div class="category-info">
                        <div class="category-color" style="background-color: ${category.color}"></div>
                        <div>
                            <div class="category-name">${category.name}</div>
                            <div class="category-type">${category.type}${(category.is_default || category.isDefault) ? ' (Default)' : ''}</div>
                        </div>
                    </div>
                    <div class="category-actions">
                        ${!(category.is_default || category.isDefault) ? `
                            <button class="btn btn-secondary" onclick="FinanceApp.editCategory('${category.id}')">Edit</button>
                            <button class="btn btn-danger" onclick="FinanceApp.deleteCategory('${category.id}')">Delete</button>
                        ` : `
                            <button class="btn btn-secondary" onclick="FinanceApp.editCategory('${category.id}')">Edit Color</button>
                        `}
                    </div>
                </div>
            `).join('');
            
        } catch (error) {
            console.error('Failed to load categories:', error);
            Utils.showToast('Failed to load categories', 'error');
        }
    }

    /**
     * Initialize default categories if none exist
     */
    async initializeDefaultCategories() {
        try {
            if (this.categoryManager) {
                const categories = await this.categoryManager.getCategories();
                console.log(`Found ${categories.length} existing categories`);
                
                // Only create defaults if truly no categories exist
                if (categories.length === 0) {
                    console.log('No categories found, creating defaults...');
                    await this.categoryManager.createDefaultCategories();
                } else {
                    console.log('Categories already exist, skipping default creation');
                }
            }
        } catch (error) {
            console.error('Error initializing default categories:', error);
            // Don't throw error - continue with app initialization
        }
    }

    /**
     * Update category options in select elements
     */
    async updateCategoryOptions() {
        if (!this.categoryManager) return;

        const transactionType = document.getElementById('transaction-type')?.value;
        const categorySelects = [
            document.getElementById('transaction-category'),
            document.getElementById('filter-category')
        ];

        try {
            const categories = await this.categoryManager.getCategories();
            const filteredCategories = categories.filter(cat => 
                !transactionType || cat.type === 'both' || cat.type === transactionType
            );

            categorySelects.forEach(select => {
                if (!select) return;

                // Store current value
                const currentValue = select.value;

                // Clear existing options (except first one)
                while (select.children.length > 1) {
                    select.removeChild(select.lastChild);
                }

                // Add category options
                filteredCategories.forEach(category => {
                    const option = document.createElement('option');
                    option.value = category.id;
                    option.textContent = category.name;
                    option.style.color = category.color;
                    select.appendChild(option);
                });

                // Restore previous value if still valid
                if (currentValue && filteredCategories.find(cat => cat.id === currentValue)) {
                    select.value = currentValue;
                }
            });
        } catch (error) {
            console.error('Failed to update category options:', error);
        }
    }

    /**
     * Set default transaction date to today
     */
    setDefaultTransactionDate() {
        const dateInput = document.getElementById('transaction-date');
        if (dateInput && !dateInput.value) {
            dateInput.value = Utils.getCurrentDateInput();
        }
    }

    /**
     * Handle transaction form submission
     * @param {Event} event - Form submit event
     */
    async handleTransactionSubmit(event) {
        try {
            Utils.showLoading();
            
            // Get form data
            const formData = new FormData(event.target);
            const transactionData = {
                amount: parseFloat(formData.get('amount')),
                type: formData.get('type'),
                category_id: formData.get('category'), // Use category_id for MySQL backend
                date: formData.get('date'), // Send as string for MySQL DATE format
                note: formData.get('note') || ''
            };

            const transactionId = event.target.dataset.transactionId;
            
            if (transactionId) {
                // Update existing transaction
                await this.transactionManager.updateTransaction(transactionId, transactionData);
                Utils.showToast('Transaction updated successfully!', 'success');
                
                // Reset form state
                delete event.target.dataset.transactionId;
                const submitBtn = event.target.querySelector('button[type="submit"]');
                submitBtn.textContent = 'Add Transaction';
            } else {
                // Add new transaction
                await this.transactionManager.addTransaction(transactionData);
                Utils.showToast('Transaction added successfully!', 'success');
            }
            
            // Reset form
            event.target.reset();
            this.setDefaultTransactionDate();
            
            // Refresh data
            await this.loadDashboard();
            if (this.currentTab === 'history') {
                await this.loadTransactionHistory();
            }
            
            Utils.hideLoading();
            
        } catch (error) {
            console.error('Failed to save transaction:', error);
            Utils.hideLoading();
            Utils.showToast('Failed to save transaction: ' + error.message, 'error');
        }
    }

    /**
     * Handle category form submission
     * @param {Event} event - Form submit event
     */
    async handleCategorySubmit(event) {
        try {
            Utils.showLoading();
            
            // Get form data
            const formData = new FormData(event.target);
            const categoryData = {
                name: formData.get('name'),
                color: formData.get('color'),
                type: formData.get('type')
            };

            const categoryId = event.target.dataset.categoryId;
            
            if (categoryId) {
                // Update existing category
                await this.categoryManager.updateCategory(categoryId, categoryData);
                Utils.showToast('Category updated successfully!', 'success');
            } else {
                // Add new category
                await this.categoryManager.addCategory(categoryData);
                Utils.showToast('Category added successfully!', 'success');
            }
            
            // Hide modal and refresh data
            this.hideCategoryModal();
            await this.loadCategories();
            await this.updateCategoryOptions();
            
            Utils.hideLoading();
            
        } catch (error) {
            console.error('Failed to save category:', error);
            Utils.hideLoading();
            Utils.showToast('Failed to save category: ' + error.message, 'error');
        }
    }

    /**
     * Show category modal
     * @param {string} categoryId - Category ID for editing (optional)
     */
    showCategoryModal(categoryId = null) {
        const modal = document.getElementById('category-modal');
        const form = document.getElementById('category-form');
        const title = document.getElementById('category-modal-title');
        
        if (categoryId) {
            // Edit mode
            title.textContent = 'Edit Category';
            form.dataset.categoryId = categoryId;
            this.loadCategoryForEdit(categoryId);
        } else {
            // Add mode
            title.textContent = 'Add Category';
            form.removeAttribute('data-category-id');
            form.reset();
            document.getElementById('category-color').value = '#3498db';
        }
        
        if (modal) {
            modal.classList.add('show');
        }
    }

    /**
     * Load category data for editing
     * @param {string} categoryId - Category ID
     */
    async loadCategoryForEdit(categoryId) {
        try {
            const category = await this.categoryManager.getCategory(categoryId);
            if (category) {
                document.getElementById('category-name').value = category.name;
                document.getElementById('category-color').value = category.color;
                document.getElementById('category-type').value = category.type;
                
                // Disable name and type for default categories
                if (category.is_default || category.isDefault) {
                    document.getElementById('category-name').disabled = true;
                    document.getElementById('category-type').disabled = true;
                } else {
                    document.getElementById('category-name').disabled = false;
                    document.getElementById('category-type').disabled = false;
                }
            }
        } catch (error) {
            console.error('Failed to load category for edit:', error);
            Utils.showToast('Failed to load category data', 'error');
        }
    }

    /**
     * Edit category
     * @param {string} categoryId - Category ID
     */
    editCategory(categoryId) {
        this.showCategoryModal(categoryId);
    }

    /**
     * Delete category with confirmation
     * @param {string} categoryId - Category ID
     */
    async deleteCategory(categoryId) {
        try {
            const category = await this.categoryManager.getCategory(categoryId);
            if (!category) {
                Utils.showToast('Category not found', 'error');
                return;
            }

            const confirmMessage = `Are you sure you want to delete "${category.name}"? Any transactions using this category will be moved to a default category.`;
            
            Utils.showConfirmDialog(confirmMessage, async () => {
                try {
                    Utils.showLoading();
                    await this.categoryManager.deleteCategory(categoryId);
                    await this.loadCategories();
                    await this.updateCategoryOptions();
                    Utils.hideLoading();
                    Utils.showToast('Category deleted successfully!', 'success');
                } catch (error) {
                    console.error('Failed to delete category:', error);
                    Utils.hideLoading();
                    Utils.showToast('Failed to delete category: ' + error.message, 'error');
                }
            });
            
        } catch (error) {
            console.error('Failed to delete category:', error);
            Utils.showToast('Failed to delete category: ' + error.message, 'error');
        }
    }

    /**
     * Hide category modal
     */
    hideCategoryModal() {
        const modal = document.getElementById('category-modal');
        if (modal) {
            modal.classList.remove('show');
        }
        
        // Reset form
        const form = document.getElementById('category-form');
        if (form) {
            form.reset();
        }
    }

    /**
     * Apply transaction filters
     */
    applyTransactionFilters() {
        // This will be implemented when we have the transaction manager
        console.log('Applying transaction filters');
    }

    /**
     * Clear transaction filters
     */
    clearTransactionFilters() {
        const filterInputs = [
            'filter-type',
            'filter-category',
            'filter-date-from',
            'filter-date-to'
        ];

        filterInputs.forEach(id => {
            const input = document.getElementById(id);
            if (input) {
                input.value = '';
            }
        });

        this.applyTransactionFilters();
    }

    /**
     * Update analytics period
     * @param {string} period - Period to display
     */
    updateAnalyticsPeriod(period) {
        // Update active button
        document.querySelectorAll('.period-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-period="${period}"]`)?.classList.add('active');

        // This will be implemented when we have the analytics engine
        console.log(`Updating analytics for period: ${period}`);
    }

    /**
     * Export application data
     */
    async exportData() {
        try {
            Utils.showLoading();
            
            const exportData = await this.database.exportAllData();
            
            const filename = `finance-tracker-backup-${Utils.formatDate(new Date(), 'input')}.json`;
            Utils.exportToJSON(exportData, filename);
            
            Utils.hideLoading();
            Utils.showToast('Data exported successfully!', 'success');
            
        } catch (error) {
            console.error('Export failed:', error);
            Utils.hideLoading();
            Utils.showToast('Failed to export data: ' + error.message, 'error');
        }
    }

    /**
     * Import application data
     * @param {File} file - File to import
     */
    async importData(file) {
        try {
            Utils.showLoading();
            
            const data = await Utils.parseJSONFile(file);
            
            // Validate import data structure
            if (!data.version || !data.exportDate) {
                throw new Error('Invalid backup file format');
            }
            
            // Confirm import (will clear existing data)
            const confirmMessage = 'This will replace all existing data. Are you sure you want to continue?';
            
            Utils.showConfirmDialog(confirmMessage, async () => {
                try {
                    await this.database.importData(data);
                    
                    // Refresh all data
                    await this.loadDashboard();
                    await this.loadCategories();
                    await this.loadTransactionHistory();
                    await this.updateCategoryOptions();
                    
                    Utils.hideLoading();
                    Utils.showToast('Data imported successfully!', 'success');
                } catch (importError) {
                    console.error('Import failed:', importError);
                    Utils.hideLoading();
                    Utils.showToast('Failed to import data: ' + importError.message, 'error');
                }
            }, () => {
                Utils.hideLoading();
            });
            
        } catch (error) {
            console.error('Import failed:', error);
            Utils.hideLoading();
            Utils.showToast('Failed to import data: ' + error.message, 'error');
        }
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Wait a bit to ensure all scripts are loaded
        if (!window.AuthManager) {
            console.error('AuthManager not available');
            return;
        }
        
        // Initialize authentication first and wait for it to complete
        await window.AuthManager.initialize();
        
        // Check for OAuth token first (before auth check)
        const urlParams = new URLSearchParams(window.location.search);
        const hasOAuthToken = urlParams.get('token') && urlParams.get('login') === 'success';
        
        if (!hasOAuthToken && !window.AuthManager.isAuthenticated()) {
            // Only redirect if no OAuth token and not authenticated
            console.log('No OAuth token and not authenticated, redirecting to login');
            window.location.href = 'login.html';
            return;
        }
        
        // Initialize user interface
        initializeUserInterface();
        
        // Initialize main application
        const app = new FinanceTrackerApp();
        await app.init();
        
        // Make app globally available for debugging and UI interactions
    window.FinanceApp = app;
    
    // Make category methods globally accessible for HTML onclick handlers
    window.FinanceApp.editCategory = app.editCategory.bind(app);
    window.FinanceApp.deleteCategory = app.deleteCategory.bind(app);
    window.FinanceApp.showCategoryModal = app.showCategoryModal.bind(app);
    
    // Make transaction methods globally accessible for HTML onclick handlers
    window.FinanceApp.editTransaction = app.editTransaction.bind(app);
    window.FinanceApp.deleteTransaction = app.deleteTransaction.bind(app);
    
    } catch (error) {
        console.error('App initialization error:', error);
        // If there's an authentication error, redirect to login (unless OAuth token present)
        const urlParams = new URLSearchParams(window.location.search);
        const hasOAuthToken = urlParams.get('token') && urlParams.get('login') === 'success';
        
        if (!hasOAuthToken && error.message && (error.message.includes('Authentication') || error.message.includes('Token'))) {
            window.location.href = 'login.html';
        } else {
            Utils.showToast('Failed to initialize application', 'error');
        }
    }
});

/**
 * Initialize user interface with authentication
 */
function initializeUserInterface() {
    const user = window.AuthManager.getUser();
    
    if (user) {
        // Update user menu
        document.getElementById('user-name').textContent = user.firstName || user.username;
        document.getElementById('user-display-name').textContent = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username;
        document.getElementById('user-email').textContent = user.email;
        
        // Set up user menu interactions
        setupUserMenu();
    }
}

/**
 * Set up user menu interactions
 */
function setupUserMenu() {
    const userMenuToggle = document.getElementById('user-menu-toggle');
    const userDropdown = document.getElementById('user-dropdown');
    const logoutLink = document.getElementById('logout-link');
    const profileLink = document.getElementById('profile-link');
    const exportDataLink = document.getElementById('export-data-link');
    
    // Toggle user menu
    userMenuToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        userDropdown.classList.toggle('show');
    });
    
    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
        if (!userMenuToggle.contains(e.target) && !userDropdown.contains(e.target)) {
            userDropdown.classList.remove('show');
        }
    });
    
    // Handle logout
    logoutLink.addEventListener('click', async (e) => {
        e.preventDefault();
        
        const confirmLogout = confirm('Are you sure you want to sign out?');
        if (confirmLogout) {
            try {
                await window.AuthManager.logout();
                // Redirect will be handled by AuthGuard
            } catch (error) {
                console.error('Logout error:', error);
                // Force redirect even if logout API fails
                window.location.href = 'login.html';
            }
        }
    });
    
    // Handle profile link
    profileLink.addEventListener('click', (e) => {
        e.preventDefault();
        showProfileModal();
    });
    
    // Handle export data
    exportDataLink.addEventListener('click', async (e) => {
        e.preventDefault();
        userDropdown.classList.remove('show');
        
        try {
            const response = await window.AuthManager.authenticatedFetch('/user/export');
            const data = await response.json();
            
            if (data.success) {
                const filename = `finance-tracker-backup-${new Date().toISOString().split('T')[0]}.json`;
                Utils.exportToJSON(data.data, filename);
                Utils.showToast('Data exported successfully!', 'success');
            } else {
                throw new Error('Export failed');
            }
        } catch (error) {
            console.error('Export error:', error);
            Utils.showToast('Failed to export data', 'error');
        }
    });
}

/**
 * Show profile modal
 */
function showProfileModal() {
    // This will be implemented in the profile management task
    Utils.showToast('Profile management coming soon!', 'info');
}
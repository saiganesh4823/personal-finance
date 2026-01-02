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
        const urlParams = new URLSearchParams(window.location.search);
        const token = urlParams.get('token');
        const loginSuccess = urlParams.get('login');
        
        if (token && loginSuccess === 'success') {
            // Store the JWT token with the key AuthManager expects
            localStorage.setItem('accessToken', token);
            
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
                
                // Force AuthManager to reload from storage immediately
                if (window.AuthManager) {
                    window.AuthManager.loadFromStorage();
                }
                
                // Update UI with user info
                this.updateUserDisplay(userInfo);
                
                Utils.showToast('Login successful! Welcome back!', 'success');
            } catch (error) {
                console.error('Error decoding token:', error);
            }
            
            // Clean up URL parameters
            const cleanUrl = window.location.origin + window.location.pathname;
            window.history.replaceState({}, document.title, cleanUrl);
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
            
            // Initialize settings if on settings tab
            if (window.location.hash === '#settings') {
                await this.loadSettings();
            }
            
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
        
        // Settings
        this.setupSettingsListeners();
        
        // Recurring transactions
        this.setupRecurringListeners();
        
        // Investment portfolio
        this.setupInvestmentListeners();
        
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

        // Type button selection
        this.setupTypeButtons();
        
        // Category button selection will be set up when categories are loaded
        
        // Real-time validation
        const amountInput = document.getElementById('transaction-amount');
        if (amountInput) {
            amountInput.addEventListener('input', this.validateTransactionForm.bind(this));
        }
    }

    /**
     * Set up transaction type button listeners
     */
    setupTypeButtons() {
        const typeButtons = document.querySelectorAll('#type-buttons .btn-option');
        const hiddenTypeInput = document.getElementById('transaction-type');
        
        typeButtons.forEach(button => {
            button.addEventListener('click', () => {
                // Remove selected class from all buttons
                typeButtons.forEach(btn => btn.classList.remove('selected'));
                
                // Add selected class to clicked button
                button.classList.add('selected');
                
                // Update hidden input value
                const type = button.dataset.type;
                hiddenTypeInput.value = type;
                
                // Update categories based on selected type
                this.updateCategoryButtons(type);
                
                // Validate form
                this.validateTransactionForm();
            });
        });
    }

    /**
     * Set up category button listeners
     */
    setupCategoryButtons() {
        const categoryButtons = document.querySelectorAll('#category-buttons .category-btn');
        const hiddenCategoryInput = document.getElementById('transaction-category');
        
        categoryButtons.forEach(button => {
            button.addEventListener('click', () => {
                // Remove selected class from all category buttons
                categoryButtons.forEach(btn => btn.classList.remove('selected'));
                
                // Add selected class to clicked button
                button.classList.add('selected');
                
                // Update hidden input value
                hiddenCategoryInput.value = button.dataset.categoryId;
                
                // Validate form
                this.validateTransactionForm();
            });
        });
    }

    /**
     * Validate transaction form in real-time
     */
    validateTransactionForm() {
        const form = document.getElementById('transaction-form');
        const amountInput = document.getElementById('transaction-amount');
        const hiddenTypeInput = document.getElementById('transaction-type');
        const hiddenCategoryInput = document.getElementById('transaction-category');
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
        if (!hiddenTypeInput.value) {
            const typeGroup = document.querySelector('#type-buttons').closest('.form-group');
            this.showFieldError(typeGroup, 'Please select a transaction type');
            isValid = false;
        }

        // Validate category
        if (!hiddenCategoryInput.value) {
            const categoryGroup = document.querySelector('#category-buttons').closest('.form-group');
            this.showFieldError(categoryGroup, 'Please select a category');
            isValid = false;
        }

        // Enable/disable submit button
        submitBtn.disabled = !isValid;
    }

    /**
     * Show field validation error
     * @param {HTMLElement} field - Form field element or form group
     * @param {string} message - Error message
     */
    showFieldError(field, message) {
        let formGroup;
        if (field.classList.contains('form-group')) {
            formGroup = field;
        } else {
            formGroup = field.closest('.form-group');
        }
        
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
     * Set up settings event listeners
     */
    setupSettingsListeners() {
        // Email notifications toggle
        const emailToggle = document.getElementById('email-notifications-toggle');
        if (emailToggle) {
            emailToggle.addEventListener('change', (e) => {
                this.updateEmailNotifications(e.target.checked);
            });
        }

        // Send test report button
        const testReportBtn = document.getElementById('send-test-report');
        if (testReportBtn) {
            testReportBtn.addEventListener('click', () => {
                this.sendTestReport();
            });
        }

        // Generate report button
        const generateReportBtn = document.getElementById('generate-report');
        if (generateReportBtn) {
            generateReportBtn.addEventListener('click', () => {
                this.generateMonthlyReport();
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
                case 'settings':
                    await this.loadSettings();
                    break;
                case 'recurring':
                    await this.loadRecurringTransactions();
                    break;
                case 'investments':
                    await this.loadInvestments();
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
            // Get current month date range
            const now = new Date();
            const year = now.getFullYear();
            const month = now.getMonth(); // 0-based (December = 11)
            
            // First day of current month
            const startDate = `${year}-${String(month + 1).padStart(2, '0')}-01`;
            
            // Last day of current month
            const lastDayOfMonth = new Date(year, month + 1, 0).getDate();
            const endDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDayOfMonth).padStart(2, '0')}`;
            
            // Get analytics data using authenticated DatabaseService
            const analytics = await this.database.getAnalytics({
                start_date: startDate,
                end_date: endDate
            });
            
            const stats = analytics.stats;
            
            // Update summary cards with proper null handling
            const totalIncome = parseFloat(stats.totalIncome) || 0;
            const totalExpenses = parseFloat(stats.totalExpenses) || 0;
            const balance = totalIncome - totalExpenses;
            
            // Update DOM elements
            const incomeElement = document.getElementById('total-income');
            const expensesElement = document.getElementById('total-expenses');
            const balanceElement = document.getElementById('net-balance');
            
            if (incomeElement) {
                incomeElement.textContent = Utils.formatCurrency(totalIncome);
            }
            
            if (expensesElement) {
                expensesElement.textContent = Utils.formatCurrency(totalExpenses);
            }
            
            if (balanceElement) {
                balanceElement.textContent = Utils.formatCurrency(balance);
                
                // Update balance color based on positive/negative
                if (balance >= 0) {
                    balanceElement.className = 'amount text-success';
                } else {
                    balanceElement.className = 'amount text-danger';
                }
            }
            
            // Load recent transactions
            await this.loadRecentTransactions();
            
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
        // Initialize with expense type by default
        const expenseButton = document.querySelector('#type-buttons [data-type="expense"]');
        if (expenseButton) {
            expenseButton.click(); // This will trigger the type selection and load categories
        }
        
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
                
                // Temporarily disable automatic category creation due to API issues
                if (categories.length === 0) {
                    console.log('No categories found. Categories should be added via SQL script.');
                    console.log('Please run the database/CHECK-AND-FIX.sql script in Supabase.');
                    // await this.categoryManager.createDefaultCategories();
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
     * Update category buttons based on selected transaction type
     * @param {string} type - Transaction type ('income' or 'expense')
     */
    async updateCategoryButtons(type) {
        if (!this.categoryManager) return;
        
        try {
            const categories = await this.categoryManager.getCategories();
            const categoryGrid = document.getElementById('category-buttons');
            
            if (!categoryGrid) return;
            
            // Filter categories by type
            const filteredCategories = categories.filter(category => 
                category.type === type || category.type === 'both'
            );
            
            // Clear existing buttons
            categoryGrid.innerHTML = '';
            
            // Create category buttons
            filteredCategories.forEach(category => {
                const button = document.createElement('button');
                button.type = 'button';
                button.className = 'category-btn';
                button.dataset.categoryId = category.id;
                button.style.setProperty('--category-color', category.color);
                
                button.innerHTML = `
                    <div class="category-icon">${this.getCategoryIcon(category.name)}</div>
                    <div class="category-name">${category.name}</div>
                `;
                
                categoryGrid.appendChild(button);
            });
            
            // Set up event listeners for new buttons
            this.setupCategoryButtons();
            
        } catch (error) {
            console.error('Failed to update category buttons:', error);
        }
    }

    /**
     * Get icon for category
     * @param {string} categoryName - Category name
     * @returns {string} Icon character
     */
    getCategoryIcon(categoryName) {
        const iconMap = {
            'Food & Dining': '🍽️',
            'Bills & Utilities': '💡',
            'Shopping': '🛍️',
            'Transportation': '🚗',
            'Entertainment': '🎬',
            'Healthcare': '🏥',
            'Education': '📚',
            'Travel': '✈️',
            'Personal Care': '💄',
            'Other Expenses': '📦',
            'Salary': '💼',
            'Freelance': '💻',
            'Investment': '📈',
            'Other Income': '💰'
        };
        
        return iconMap[categoryName] || '📋';
    }

    /**
     * Update category options in select elements (for filters)
     */
    async updateCategoryOptions() {
        if (!this.categoryManager) return;

        const categorySelect = document.getElementById('filter-category');

        try {
            const categories = await this.categoryManager.getCategories();

            if (categorySelect) {
                // Store current value
                const currentValue = categorySelect.value;

                // Clear existing options (except first one)
                while (categorySelect.children.length > 1) {
                    categorySelect.removeChild(categorySelect.lastChild);
                }

                // Add category options
                categories.forEach(category => {
                    const option = document.createElement('option');
                    option.value = category.id;
                    option.textContent = category.name;
                    option.style.color = category.color;
                    categorySelect.appendChild(option);
                });

                // Restore previous value if still valid
                if (currentValue && categories.find(cat => cat.id === currentValue)) {
                    categorySelect.value = currentValue;
                }
            }
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

    /**
     * Load settings page
     */
    async loadSettings() {
        try {
            // Load user settings
            const response = await this.database.authenticatedRequest('/user/settings');
            if (!response.ok) {
                throw new Error('Failed to load settings');
            }
            
            const settings = await response.json();
            
            // Update UI with settings
            document.getElementById('email-notifications-toggle').checked = settings.emailNotifications;
            document.getElementById('user-email-display').textContent = settings.email;
            document.getElementById('profile-name').textContent = `${settings.firstName || ''} ${settings.lastName || ''}`.trim() || 'Not set';
            document.getElementById('profile-email').textContent = settings.email;
            
            // Populate year dropdown
            this.populateYearDropdown();
            
            // Set current month as default
            const currentMonth = new Date().getMonth() + 1;
            document.getElementById('report-month').value = currentMonth;
            
        } catch (error) {
            console.error('Failed to load settings:', error);
            Utils.showToast('Failed to load settings: ' + error.message, 'error');
        }
    }

    /**
     * Populate year dropdown for reports
     */
    populateYearDropdown() {
        const yearSelect = document.getElementById('report-year');
        const currentYear = new Date().getFullYear();
        
        yearSelect.innerHTML = '';
        
        // Add years from 2020 to current year + 1
        for (let year = 2020; year <= currentYear + 1; year++) {
            const option = document.createElement('option');
            option.value = year;
            option.textContent = year;
            if (year === currentYear) {
                option.selected = true;
            }
            yearSelect.appendChild(option);
        }
    }

    /**
     * Update email notification settings
     */
    async updateEmailNotifications(enabled) {
        try {
            const response = await this.database.authenticatedRequest('/user/settings', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    emailNotifications: enabled
                })
            });

            if (!response.ok) {
                throw new Error('Failed to update settings');
            }

            const result = await response.json();
            Utils.showToast(
                enabled ? 'Email notifications enabled' : 'Email notifications disabled', 
                'success'
            );
            
        } catch (error) {
            console.error('Failed to update email notifications:', error);
            Utils.showToast('Failed to update settings: ' + error.message, 'error');
            
            // Revert toggle state
            document.getElementById('email-notifications-toggle').checked = !enabled;
        }
    }

    /**
     * Send test monthly report
     */
    async sendTestReport() {
        try {
            Utils.showLoading();
            
            const response = await this.database.authenticatedRequest('/reports/monthly', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    month: new Date().getMonth() + 1,
                    year: new Date().getFullYear()
                })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to send test report');
            }

            const result = await response.json();
            Utils.hideLoading();
            Utils.showToast('Test report sent successfully!', 'success');
            
        } catch (error) {
            console.error('Failed to send test report:', error);
            Utils.hideLoading();
            Utils.showToast('Failed to send test report: ' + error.message, 'error');
        }
    }

    /**
     * Generate monthly report for specific month/year
     */
    async generateMonthlyReport() {
        try {
            const month = parseInt(document.getElementById('report-month').value);
            const year = parseInt(document.getElementById('report-year').value);
            
            Utils.showLoading();
            
            const response = await this.database.authenticatedRequest('/reports/monthly', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ month, year })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to generate report');
            }

            const result = await response.json();
            Utils.hideLoading();
            
            const monthName = new Date(year, month - 1).toLocaleString('default', { month: 'long' });
            Utils.showToast(`Monthly report for ${monthName} ${year} sent successfully!`, 'success');
            
        } catch (error) {
            console.error('Failed to generate monthly report:', error);
            Utils.hideLoading();
            Utils.showToast('Failed to generate report: ' + error.message, 'error');
        }
    }

    /**
     * Set up recurring transactions event listeners
     */
    setupRecurringListeners() {
        // Add recurring transaction button
        const addRecurringBtn = document.getElementById('add-recurring-btn');
        if (addRecurringBtn) {
            addRecurringBtn.addEventListener('click', () => {
                this.showRecurringModal();
            });
        }

        // Process recurring transactions button
        const processRecurringBtn = document.getElementById('process-recurring-btn');
        if (processRecurringBtn) {
            processRecurringBtn.addEventListener('click', () => {
                this.processRecurringTransactions();
            });
        }

        // Recurring modal listeners
        const recurringModal = document.getElementById('recurring-modal');
        const recurringCloseBtn = recurringModal?.querySelector('.modal-close');
        const recurringCancelBtn = recurringModal?.querySelector('.modal-cancel');
        const recurringForm = document.getElementById('recurring-form');

        if (recurringCloseBtn) {
            recurringCloseBtn.addEventListener('click', () => {
                this.hideRecurringModal();
            });
        }

        if (recurringCancelBtn) {
            recurringCancelBtn.addEventListener('click', () => {
                this.hideRecurringModal();
            });
        }

        if (recurringModal) {
            recurringModal.addEventListener('click', (e) => {
                if (e.target === recurringModal) {
                    this.hideRecurringModal();
                }
            });
        }

        if (recurringForm) {
            recurringForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.saveRecurringTransaction();
            });
        }

        // Frequency change listener
        const frequencySelect = document.getElementById('recurring-frequency');
        if (frequencySelect) {
            frequencySelect.addEventListener('change', (e) => {
                this.toggleDayOfMonthField(e.target.value);
            });
        }
    }

    /**
     * Load recurring transactions
     */
    async loadRecurringTransactions() {
        try {
            const response = await this.database.authenticatedRequest('/recurring');
            if (!response.ok) {
                throw new Error('Failed to load recurring transactions');
            }

            const recurringTransactions = await response.json();
            this.displayRecurringTransactions(recurringTransactions);

        } catch (error) {
            console.error('Failed to load recurring transactions:', error);
            Utils.showToast('Failed to load recurring transactions: ' + error.message, 'error');
        }
    }

    /**
     * Display recurring transactions
     */
    displayRecurringTransactions(recurringTransactions) {
        const container = document.getElementById('recurring-list');
        if (!container) return;

        if (recurringTransactions.length === 0) {
            container.innerHTML = `
                <div class="recurring-empty-state">
                    <h3>No recurring transactions yet</h3>
                    <p>Set up automatic transactions like SIP, EMI, rent, or salary to save time!</p>
                    <button class="btn btn-primary" onclick="FinanceApp.showRecurringModal()">Add Your First Recurring Transaction</button>
                </div>
            `;
            return;
        }

        container.innerHTML = recurringTransactions.map(recurring => {
            const nextDate = this.calculateNextDate(recurring);
            return `
                <div class="recurring-item ${recurring.is_active ? 'active' : 'inactive'}">
                    <div class="recurring-header">
                        <h3 class="recurring-name">${recurring.name}</h3>
                        <div class="recurring-status">
                            <span class="status-badge ${recurring.is_active ? 'active' : 'inactive'}">
                                ${recurring.is_active ? 'Active' : 'Inactive'}
                            </span>
                        </div>
                    </div>
                    <div class="recurring-details">
                        <div class="recurring-detail">
                            <span class="recurring-detail-label">Amount</span>
                            <span class="recurring-detail-value recurring-amount ${recurring.type}">
                                ${recurring.type === 'income' ? '+' : '-'}${Utils.formatCurrency(parseFloat(recurring.amount))}
                            </span>
                        </div>
                        <div class="recurring-detail">
                            <span class="recurring-detail-label">Category</span>
                            <span class="recurring-detail-value">${recurring.categories?.name || 'No Category'}</span>
                        </div>
                        <div class="recurring-detail">
                            <span class="recurring-detail-label">Frequency</span>
                            <span class="recurring-detail-value">
                                <span class="recurring-frequency">${recurring.frequency}</span>
                            </span>
                        </div>
                        <div class="recurring-detail">
                            <span class="recurring-detail-label">Next Due</span>
                            <span class="recurring-detail-value">${nextDate}</span>
                        </div>
                        <div class="recurring-detail">
                            <span class="recurring-detail-label">Start Date</span>
                            <span class="recurring-detail-value">${Utils.formatDate(recurring.start_date)}</span>
                        </div>
                        ${recurring.end_date ? `
                        <div class="recurring-detail">
                            <span class="recurring-detail-label">End Date</span>
                            <span class="recurring-detail-value">${Utils.formatDate(recurring.end_date)}</span>
                        </div>
                        ` : ''}
                    </div>
                    ${recurring.note ? `<p style="margin: 0.5rem 0; color: var(--text-secondary); font-size: 14px;">${recurring.note}</p>` : ''}
                    <div class="recurring-actions">
                        <button class="btn btn-secondary btn-sm" onclick="FinanceApp.editRecurringTransaction('${recurring.id}')">Edit</button>
                        <button class="btn btn-${recurring.is_active ? 'warning' : 'success'} btn-sm" onclick="FinanceApp.toggleRecurringTransaction('${recurring.id}', ${!recurring.is_active})">
                            ${recurring.is_active ? 'Pause' : 'Resume'}
                        </button>
                        <button class="btn btn-danger btn-sm" onclick="FinanceApp.deleteRecurringTransaction('${recurring.id}')">Delete</button>
                    </div>
                </div>
            `;
        }).join('');
    }

    /**
     * Calculate next due date for recurring transaction
     */
    calculateNextDate(recurring) {
        const today = new Date();
        const startDate = new Date(recurring.start_date);
        const lastProcessed = recurring.last_processed_date ? new Date(recurring.last_processed_date) : null;
        
        let nextDate = lastProcessed || startDate;
        
        switch (recurring.frequency) {
            case 'daily':
                nextDate = new Date(nextDate.getTime() + 24 * 60 * 60 * 1000);
                break;
            case 'weekly':
                nextDate = new Date(nextDate.getTime() + 7 * 24 * 60 * 60 * 1000);
                break;
            case 'monthly':
                nextDate = new Date(nextDate.getFullYear(), nextDate.getMonth() + 1, recurring.day_of_month || startDate.getDate());
                break;
            case 'yearly':
                nextDate = new Date(nextDate.getFullYear() + 1, nextDate.getMonth(), nextDate.getDate());
                break;
        }
        
        return Utils.formatDate(nextDate.toISOString().split('T')[0]);
    }

    /**
     * Show recurring transaction modal
     */
    async showRecurringModal(recurringId = null) {
        const modal = document.getElementById('recurring-modal');
        const form = document.getElementById('recurring-form');
        const title = document.getElementById('recurring-modal-title');
        
        // Reset form
        form.reset();
        
        // Populate categories
        await this.populateRecurringCategories();
        
        if (recurringId) {
            title.textContent = 'Edit Recurring Transaction';
            // Load recurring transaction data
            await this.loadRecurringTransactionData(recurringId);
        } else {
            title.textContent = 'Add Recurring Transaction';
            // Set default date to today
            document.getElementById('recurring-start-date').value = new Date().toISOString().split('T')[0];
        }
        
        if (modal) {
            modal.classList.add('show');
        }
    }

    /**
     * Hide recurring transaction modal
     */
    hideRecurringModal() {
        const modal = document.getElementById('recurring-modal');
        if (modal) {
            modal.classList.remove('show');
        }
    }

    /**
     * Populate categories in recurring modal
     */
    async populateRecurringCategories() {
        try {
            const categories = await this.categoryManager.getCategories();
            const categorySelect = document.getElementById('recurring-category');
            
            if (categorySelect) {
                categorySelect.innerHTML = '<option value="">Select Category</option>' +
                    categories.map(category => 
                        `<option value="${category.id}">${category.name}</option>`
                    ).join('');
            }
        } catch (error) {
            console.error('Failed to load categories:', error);
        }
    }

    /**
     * Toggle day of month field based on frequency
     */
    toggleDayOfMonthField(frequency) {
        const dayOfMonthGroup = document.getElementById('day-of-month-group');
        if (dayOfMonthGroup) {
            dayOfMonthGroup.style.display = frequency === 'monthly' ? 'block' : 'none';
        }
    }

    /**
     * Save recurring transaction
     */
    async saveRecurringTransaction() {
        try {
            const form = document.getElementById('recurring-form');
            const formData = new FormData(form);
            
            const recurringData = {
                name: formData.get('name'),
                type: formData.get('type'),
                amount: parseFloat(formData.get('amount')),
                category_id: formData.get('category_id') || null,
                frequency: formData.get('frequency'),
                start_date: formData.get('start_date'),
                end_date: formData.get('end_date') || null,
                day_of_month: formData.get('day_of_month') || null,
                note: formData.get('note') || null
            };

            const response = await this.database.authenticatedRequest('/recurring', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(recurringData)
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to save recurring transaction');
            }

            this.hideRecurringModal();
            await this.loadRecurringTransactions();
            Utils.showToast('Recurring transaction saved successfully!', 'success');

        } catch (error) {
            console.error('Failed to save recurring transaction:', error);
            Utils.showToast('Failed to save recurring transaction: ' + error.message, 'error');
        }
    }

    /**
     * Process recurring transactions
     */
    async processRecurringTransactions() {
        try {
            Utils.showLoading();
            
            const response = await this.database.authenticatedRequest('/recurring/process', {
                method: 'POST'
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to process recurring transactions');
            }

            const result = await response.json();
            Utils.hideLoading();
            
            if (result.transactionsCreated > 0) {
                Utils.showToast(`${result.transactionsCreated} transactions created successfully!`, 'success');
                // Refresh dashboard and history
                await this.loadDashboard();
                if (this.currentTab === 'history') {
                    await this.loadTransactionHistory();
                }
            } else {
                Utils.showToast('No due transactions found to process.', 'info');
            }

        } catch (error) {
            console.error('Failed to process recurring transactions:', error);
            Utils.hideLoading();
            Utils.showToast('Failed to process recurring transactions: ' + error.message, 'error');
        }
    }

    /**
     * Edit recurring transaction
     */
    async editRecurringTransaction(recurringId) {
        await this.showRecurringModal(recurringId);
    }

    /**
     * Toggle recurring transaction active status
     */
    async toggleRecurringTransaction(recurringId, isActive) {
        try {
            const response = await this.database.authenticatedRequest(`/recurring?id=${recurringId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ is_active: isActive })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to update recurring transaction');
            }

            await this.loadRecurringTransactions();
            Utils.showToast(`Recurring transaction ${isActive ? 'resumed' : 'paused'} successfully!`, 'success');

        } catch (error) {
            console.error('Failed to toggle recurring transaction:', error);
            Utils.showToast('Failed to update recurring transaction: ' + error.message, 'error');
        }
    }

    /**
     * Delete recurring transaction
     */
    async deleteRecurringTransaction(recurringId) {
        const confirmMessage = 'Are you sure you want to delete this recurring transaction? This action cannot be undone.';
        
        Utils.showConfirmDialog(confirmMessage, async () => {
            try {
                Utils.showLoading();
                
                const response = await this.database.authenticatedRequest(`/recurring?id=${recurringId}`, {
                    method: 'DELETE'
                });

                if (!response.ok) {
                    const error = await response.json();
                    throw new Error(error.error || 'Failed to delete recurring transaction');
                }

                await this.loadRecurringTransactions();
                Utils.hideLoading();
                Utils.showToast('Recurring transaction deleted successfully!', 'success');

            } catch (error) {
                console.error('Failed to delete recurring transaction:', error);
                Utils.hideLoading();
                Utils.showToast('Failed to delete recurring transaction: ' + error.message, 'error');
            }
        });
    }

    /**
     * Set up investment portfolio event listeners
     */
    setupInvestmentListeners() {
        const addInvestmentBtn = document.getElementById('add-investment-btn');
        if (addInvestmentBtn) {
            addInvestmentBtn.addEventListener('click', () => {
                this.showInvestmentModal();
            });
        }

        const investmentModal = document.getElementById('investment-modal');
        const investmentCloseBtn = investmentModal?.querySelector('.modal-close');
        const investmentCancelBtn = investmentModal?.querySelector('.modal-cancel');
        const investmentForm = document.getElementById('investment-form');

        if (investmentCloseBtn) {
            investmentCloseBtn.addEventListener('click', () => {
                this.hideInvestmentModal();
            });
        }

        if (investmentCancelBtn) {
            investmentCancelBtn.addEventListener('click', () => {
                this.hideInvestmentModal();
            });
        }

        if (investmentModal) {
            investmentModal.addEventListener('click', (e) => {
                if (e.target === investmentModal) {
                    this.hideInvestmentModal();
                }
            });
        }

        if (investmentForm) {
            investmentForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.saveInvestment();
            });
        }

        const investmentTypeFilter = document.getElementById('investment-type-filter');
        if (investmentTypeFilter) {
            investmentTypeFilter.addEventListener('change', () => {
                this.loadInvestments();
            });
        }

        // Recurring investment toggle
        const recurringCheckbox = document.getElementById('investment-is-recurring');
        if (recurringCheckbox) {
            recurringCheckbox.addEventListener('change', (e) => {
                const recurringOptions = document.getElementById('recurring-investment-options');
                if (recurringOptions) {
                    recurringOptions.style.display = e.target.checked ? 'block' : 'none';
                }
            });
        }

        // Auto-check recurring for SIP type
        const investmentTypeSelect = document.getElementById('investment-type');
        if (investmentTypeSelect) {
            investmentTypeSelect.addEventListener('change', (e) => {
                const recurringCheckbox = document.getElementById('investment-is-recurring');
                const recurringOptions = document.getElementById('recurring-investment-options');
                if (e.target.value === 'sip' && recurringCheckbox) {
                    recurringCheckbox.checked = true;
                    if (recurringOptions) recurringOptions.style.display = 'block';
                }
            });
        }
    }

    /**
     * Show investment modal
     */
    showInvestmentModal() {
        const modal = document.getElementById('investment-modal');
        const form = document.getElementById('investment-form');
        const recurringOptions = document.getElementById('recurring-investment-options');
        
        if (form) {
            form.reset();
            document.getElementById('investment-date').value = new Date().toISOString().split('T')[0];
        }
        
        // Hide recurring options by default
        if (recurringOptions) {
            recurringOptions.style.display = 'none';
        }
        
        if (modal) {
            modal.classList.add('show');
        }
    }

    /**
     * Hide investment modal
     */
    hideInvestmentModal() {
        const modal = document.getElementById('investment-modal');
        const form = document.getElementById('investment-form');
        const title = document.getElementById('investment-modal-title');
        
        if (modal) {
            modal.classList.remove('show');
        }
        
        // Reset form and clear edit state
        if (form) {
            form.reset();
            delete form.dataset.editId;
        }
        
        if (title) {
            title.textContent = 'Add Investment';
        }
    }

    /**
     * Save investment
     */
    async saveInvestment() {
        try {
            Utils.showLoading();
            
            const form = document.getElementById('investment-form');
            const formData = new FormData(form);
            const editId = form.dataset.editId;
            const isRecurring = document.getElementById('investment-is-recurring')?.checked;
            
            // Check if this is an edit or new investment
            if (editId) {
                // Update existing investment
                const updateData = {
                    investment_name: formData.get('investment_name'),
                    category: formData.get('category') || null,
                    total_invested: parseFloat(formData.get('amount')) || 0,
                    current_value: parseFloat(formData.get('current_value')) || 0,
                    units_quantity: parseFloat(formData.get('units')) || 0,
                    average_price: parseFloat(formData.get('price_per_unit')) || 0,
                    notes: formData.get('notes') || null
                };
                
                await this.updateInvestment(editId, updateData);
                
                // Clear edit ID
                delete form.dataset.editId;
                document.getElementById('investment-modal-title').textContent = 'Add Investment';
            } else {
                // Create new investment
                const investmentData = {
                    investment_type: formData.get('investment_type'),
                    investment_name: formData.get('investment_name'),
                    category: formData.get('category') || null,
                    transaction_type: 'buy',
                    amount: parseFloat(formData.get('amount')),
                    units: parseFloat(formData.get('units')) || 0,
                    price_per_unit: parseFloat(formData.get('price_per_unit')) || 0,
                    transaction_date: formData.get('transaction_date'),
                    notes: formData.get('notes') || null
                };

                const response = await this.database.authenticatedRequest('/investments?action=add-transaction', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(investmentData)
                });

                if (!response.ok) {
                    const error = await response.json();
                    throw new Error(error.error || 'Failed to add investment');
                }

                // If recurring is enabled, create a recurring transaction for this investment
                if (isRecurring) {
                    await this.createRecurringInvestment(formData);
                }

                this.hideInvestmentModal();
                await this.loadInvestments();
                Utils.hideLoading();
                
                const successMsg = isRecurring 
                    ? 'Investment added with recurring SIP!' 
                    : 'Investment added successfully!';
                Utils.showToast(successMsg, 'success');
            }

        } catch (error) {
            console.error('Failed to save investment:', error);
            Utils.hideLoading();
            Utils.showToast('Failed to save investment: ' + error.message, 'error');
        }
    }

    /**
     * Create recurring investment (SIP)
     */
    async createRecurringInvestment(formData) {
        try {
            const frequency = formData.get('frequency') || 'monthly';
            const sipDay = parseInt(formData.get('sip_day')) || 1;
            const endDate = formData.get('end_date') || null;
            
            const recurringData = {
                name: `SIP - ${formData.get('investment_name')}`,
                type: 'expense',
                amount: parseFloat(formData.get('amount')),
                frequency: frequency,
                start_date: formData.get('transaction_date'),
                end_date: endDate,
                day_of_month: sipDay,
                note: `Recurring investment: ${formData.get('investment_type')} - ${formData.get('investment_name')}`
            };

            const response = await this.database.authenticatedRequest('/recurring', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(recurringData)
            });

            if (!response.ok) {
                console.error('Failed to create recurring investment');
            }
        } catch (error) {
            console.error('Error creating recurring investment:', error);
        }
    }

    /**
     * Load investments
     */
    async loadInvestments() {
        try {
            const typeFilter = document.getElementById('investment-type-filter')?.value || 'all';
            const url = typeFilter === 'all' ? '/investments' : `/investments?type=${typeFilter}`;
            
            const response = await this.database.authenticatedRequest(url);
            if (!response.ok) {
                throw new Error('Failed to load investments');
            }

            const investments = await response.json();
            this.displayInvestments(investments);
            this.loadInvestmentSummary();

        } catch (error) {
            console.error('Failed to load investments:', error);
        }
    }

    /**
     * Load investment summary
     */
    async loadInvestmentSummary() {
        try {
            const response = await this.database.authenticatedRequest('/investments?type=summary');
            if (!response.ok) return;

            const summary = await response.json();
            const summaryContainer = document.getElementById('investment-summary');
            
            if (summaryContainer && summary.length > 0) {
                const totalInvested = summary.reduce((sum, s) => sum + parseFloat(s.total_invested || 0), 0);
                const totalValue = summary.reduce((sum, s) => sum + parseFloat(s.current_value || 0), 0);
                const totalGain = totalValue - totalInvested;
                const returnPercent = totalInvested > 0 ? ((totalGain / totalInvested) * 100).toFixed(2) : 0;

                summaryContainer.innerHTML = `
                    <div class="summary-card">
                        <h4>Total Invested</h4>
                        <p class="amount">₹${totalInvested.toLocaleString('en-IN')}</p>
                    </div>
                    <div class="summary-card">
                        <h4>Current Value</h4>
                        <p class="amount">₹${totalValue.toLocaleString('en-IN')}</p>
                    </div>
                    <div class="summary-card ${totalGain >= 0 ? 'positive' : 'negative'}">
                        <h4>Total Gain/Loss</h4>
                        <p class="amount">${totalGain >= 0 ? '+' : ''}₹${totalGain.toLocaleString('en-IN')} (${returnPercent}%)</p>
                    </div>
                `;
            }
        } catch (error) {
            console.error('Failed to load investment summary:', error);
        }
    }

    /**
     * Display investments
     */
    displayInvestments(investments) {
        const container = document.getElementById('investments-list');
        if (!container) return;

        if (investments.length === 0) {
            container.innerHTML = '<p class="no-data">No investments found. Add your first investment!</p>';
            return;
        }

        container.innerHTML = investments.map(inv => {
            const gainLoss = (inv.current_value || 0) - (inv.total_invested || 0);
            const returnPercent = inv.total_invested > 0 ? ((gainLoss / inv.total_invested) * 100).toFixed(2) : 0;
            const isPositive = gainLoss >= 0;

            return `
                <div class="investment-card">
                    <div class="investment-header">
                        <h4>${inv.investment_name}</h4>
                        <span class="investment-type">${inv.investment_type}</span>
                    </div>
                    <div class="investment-details">
                        <div class="detail-row">
                            <span>Invested:</span>
                            <span>₹${parseFloat(inv.total_invested || 0).toLocaleString('en-IN')}</span>
                        </div>
                        <div class="detail-row">
                            <span>Current Value:</span>
                            <span>₹${parseFloat(inv.current_value || 0).toLocaleString('en-IN')}</span>
                        </div>
                        <div class="detail-row">
                            <span>Units:</span>
                            <span>${parseFloat(inv.units_quantity || 0).toFixed(4)}</span>
                        </div>
                        <div class="detail-row ${isPositive ? 'positive' : 'negative'}">
                            <span>Gain/Loss:</span>
                            <span>${isPositive ? '+' : ''}₹${gainLoss.toLocaleString('en-IN')} (${returnPercent}%)</span>
                        </div>
                    </div>
                    <div class="investment-actions">
                        <button class="btn btn-sm btn-secondary" onclick="app.editInvestment('${inv.id}')">Edit</button>
                        <button class="btn btn-sm btn-danger" onclick="app.deleteInvestment('${inv.id}')">Delete</button>
                    </div>
                </div>
            `;
        }).join('');
    }

    /**
     * Delete investment
     */
    async deleteInvestment(investmentId) {
        Utils.showConfirmDialog('Are you sure you want to delete this investment?', async () => {
            try {
                Utils.showLoading();
                const response = await this.database.authenticatedRequest(`/investments?id=${investmentId}`, {
                    method: 'DELETE'
                });

                if (!response.ok) {
                    throw new Error('Failed to delete investment');
                }

                await this.loadInvestments();
                Utils.hideLoading();
                Utils.showToast('Investment deleted successfully!', 'success');
            } catch (error) {
                Utils.hideLoading();
                Utils.showToast('Failed to delete investment: ' + error.message, 'error');
            }
        });
    }

    /**
     * Edit investment
     */
    async editInvestment(investmentId) {
        try {
            // Fetch the investment data
            const response = await this.database.authenticatedRequest('/investments');
            if (!response.ok) {
                throw new Error('Failed to load investment');
            }
            
            const investments = await response.json();
            const investment = investments.find(inv => inv.id === investmentId);
            
            if (!investment) {
                Utils.showToast('Investment not found', 'error');
                return;
            }
            
            // Show modal and populate form
            const modal = document.getElementById('investment-modal');
            const form = document.getElementById('investment-form');
            const title = document.getElementById('investment-modal-title');
            
            if (title) title.textContent = 'Edit Investment';
            
            // Populate form fields
            document.getElementById('investment-type').value = investment.investment_type || '';
            document.getElementById('investment-name').value = investment.investment_name || '';
            document.getElementById('investment-category').value = investment.category || '';
            document.getElementById('investment-amount').value = investment.total_invested || '';
            document.getElementById('investment-units').value = investment.units_quantity || '';
            document.getElementById('investment-price').value = investment.average_price || '';
            document.getElementById('investment-current-value').value = investment.current_value || '';
            document.getElementById('investment-notes').value = investment.notes || '';
            document.getElementById('investment-date').value = investment.last_updated_date || new Date().toISOString().split('T')[0];
            
            // Store the investment ID for update
            form.dataset.editId = investmentId;
            
            if (modal) {
                modal.classList.add('show');
            }
        } catch (error) {
            console.error('Failed to load investment for editing:', error);
            Utils.showToast('Failed to load investment: ' + error.message, 'error');
        }
    }

    /**
     * Update existing investment
     */
    async updateInvestment(investmentId, investmentData) {
        try {
            Utils.showLoading();
            
            const response = await this.database.authenticatedRequest(`/investments?id=${investmentId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(investmentData)
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to update investment');
            }

            this.hideInvestmentModal();
            await this.loadInvestments();
            Utils.hideLoading();
            Utils.showToast('Investment updated successfully!', 'success');

        } catch (error) {
            console.error('Failed to update investment:', error);
            Utils.hideLoading();
            Utils.showToast('Failed to update investment: ' + error.message, 'error');
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
    
    // Make recurring transaction methods globally accessible for HTML onclick handlers
    window.FinanceApp.showRecurringModal = app.showRecurringModal.bind(app);
    window.FinanceApp.editRecurringTransaction = app.editRecurringTransaction.bind(app);
    window.FinanceApp.toggleRecurringTransaction = app.toggleRecurringTransaction.bind(app);
    window.FinanceApp.deleteRecurringTransaction = app.deleteRecurringTransaction.bind(app);
    
    // Make investment methods globally accessible for HTML onclick handlers
    window.FinanceApp.editInvestment = app.editInvestment.bind(app);
    window.FinanceApp.deleteInvestment = app.deleteInvestment.bind(app);
    
    // Also expose as window.app for simpler onclick handlers
    window.app = app;
    
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
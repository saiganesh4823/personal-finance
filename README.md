# 💰 Personal Finance Tracker

A comprehensive personal finance management application with transaction tracking, recurring payments, investment portfolio management, and detailed analytics. Built with vanilla JavaScript frontend and serverless API backend, deployed on Vercel with Supabase PostgreSQL database.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)
![Vercel](https://img.shields.io/badge/deployed%20on-Vercel-black)

## ✨ Features

### 📊 Dashboard
- Real-time financial overview with monthly income, expenses, and balance
- Recent transactions display
- Quick action buttons for adding transactions

### 💳 Transaction Management
- Add income and expense transactions
- Categorize with 34+ default categories (Indian context)
- Edit and delete transactions
- Filter by type, category, and date range

### 🔄 Recurring Transactions
- Set up automatic recurring transactions (SIP, EMI, rent, salary)
- Support for daily, weekly, monthly, and yearly frequencies
- Custom day-of-month selection for monthly transactions
- **Partial debit support** - debit only part of the amount (e.g., ₹5k debit for ₹15k SIP)
- Automatic processing via daily cron job at 6 AM
- Manual processing with "Process Due Transactions" button
- Pause/resume functionality

### 📈 Investment Portfolio
- Track multiple investment types (SIP, Mutual Funds, Stocks, Gold, Silver, FD, Bonds, Crypto)
- Record buy/sell transactions with fees and taxes
- Portfolio summary with total invested, current value, and returns
- Support for recurring investments

### 📉 Analytics
- Category-wise expense distribution (pie chart)
- Income vs Expenses comparison (bar chart)
- Balance trend over time (line chart)
- Period selection (Month/Quarter/Year)

### 🔐 Authentication
- Google OAuth 2.0 login
- JWT-based session management
- Secure API endpoints

### 📧 Email Reports
- Monthly financial report generation
- Email notifications (configurable)

## 🛠️ Tech Stack

### Frontend
- **HTML5/CSS3** - Semantic markup with responsive design
- **Vanilla JavaScript** - No frameworks, pure ES6+
- **Chart.js** - Interactive charts and visualizations

### Backend (Serverless)
- **Vercel Functions** - Serverless API endpoints
- **Supabase** - PostgreSQL database with real-time capabilities
- **JWT** - Authentication tokens
- **Google OAuth 2.0** - Social login

### Database
- **PostgreSQL** (Supabase) - Primary data store
- 7 tables: users, categories, transactions, recurring_transactions, investment_portfolio, investment_transactions, user_sessions

## 📁 Project Structure

```
personal-finance-tracker/
├── api/                      # Vercel serverless functions
│   ├── auth/                 # Authentication endpoints
│   │   ├── google.js         # Google OAuth initiation
│   │   └── google/callback.js # OAuth callback handler
│   ├── reports/              # Report generation
│   │   └── monthly.js        # Monthly report endpoint
│   ├── transactions/         # Transaction CRUD
│   │   └── [id].js           # Single transaction operations
│   ├── user/                 # User settings
│   │   └── settings.js       # User preferences
│   ├── analytics.js          # Analytics data
│   ├── auth.js               # Auth utilities
│   ├── categories.js         # Category CRUD
│   ├── health.js             # Health check
│   ├── investments.js        # Investment CRUD
│   ├── recurring.js          # Recurring transactions
│   └── transactions.js       # Transaction list/create
├── css/
│   ├── main.css              # Core styles
│   ├── components.css        # UI components
│   └── responsive.css        # Mobile responsiveness
├── database/
│   ├── schema.sql            # Main database schema
│   ├── add-investment-functions.sql  # Investment PostgreSQL functions
│   └── add-categories-existing-user.sql  # Category seeding
├── js/
│   ├── app.js                # Main application logic
│   ├── auth-manager.js       # Authentication handling
│   ├── auth-guard.js         # Route protection
│   ├── database.js           # API service layer
│   ├── analytics.js          # Analytics engine
│   ├── category-manager.js   # Category operations
│   ├── transaction-manager.js # Transaction operations
│   └── utils.js              # Utility functions
├── lib/
│   └── dexie.min.js          # IndexedDB wrapper (legacy)
├── backend/                  # Legacy Express backend (optional)
│   ├── middleware/
│   ├── routes/
│   ├── services/
│   └── server.js
├── index.html                # Main application
├── login.html                # Login page
├── register.html             # Registration page
├── vercel.json               # Vercel configuration
└── package.json
```

## 🚀 Deployment

### Prerequisites
- [Vercel Account](https://vercel.com)
- [Supabase Account](https://supabase.com)
- [Google Cloud Console](https://console.cloud.google.com) (for OAuth)

### 1. Database Setup (Supabase)

1. Create a new Supabase project
2. Go to SQL Editor and run `database/schema.sql`
3. Run `database/add-investment-functions.sql` for investment features
4. Copy your project URL and anon key from Settings > API

### 2. Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project or select existing
3. Enable Google+ API
4. Create OAuth 2.0 credentials (Web application)
5. Add authorized redirect URI: `https://your-domain.vercel.app/api/auth/google/callback`
6. Copy Client ID and Client Secret

### 3. Vercel Deployment

1. Fork/clone this repository
2. Import to Vercel
3. Add environment variables:

```env
# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key

# JWT
JWT_SECRET=your-super-secret-jwt-key-min-32-chars

# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# App URLs
FRONTEND_URL=https://your-domain.vercel.app
BACKEND_URL=https://your-domain.vercel.app

# Optional: Email Reports (Resend)
RESEND_API_KEY=your-resend-api-key
```

4. Deploy!

### 4. Add Categories for Existing Users

After first login, run `database/add-categories-existing-user.sql` in Supabase SQL Editor, replacing the user ID placeholder with your actual user ID.

## 💻 Local Development

```bash
# Clone the repository
git clone https://github.com/yourusername/personal-finance-tracker.git
cd personal-finance-tracker

# Install dependencies
npm install

# Create .env file with your credentials (see above)

# Run with Vercel CLI
npm install -g vercel
vercel dev
```

## 📱 API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/auth/google` | Initiate Google OAuth |
| GET | `/api/auth/google/callback` | OAuth callback |

### Transactions
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/transactions` | List transactions |
| POST | `/api/transactions` | Create transaction |
| PUT | `/api/transactions/[id]` | Update transaction |
| DELETE | `/api/transactions/[id]` | Delete transaction |

### Categories
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/categories` | List categories |
| POST | `/api/categories` | Create category |
| PUT | `/api/categories?id=` | Update category |
| DELETE | `/api/categories?id=` | Delete category |

### Recurring Transactions
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/recurring` | List recurring |
| POST | `/api/recurring` | Create recurring |
| PUT | `/api/recurring?id=` | Update recurring |
| DELETE | `/api/recurring?id=` | Delete recurring |
| POST | `/api/recurring?action=process` | Process due transactions |

### Investments
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/investments` | List investments |
| POST | `/api/investments` | Create investment |
| PUT | `/api/investments?id=` | Update investment |
| DELETE | `/api/investments?id=` | Delete investment |
| POST | `/api/investments?action=transaction` | Add investment transaction |
| GET | `/api/investments?action=summary` | Get portfolio summary |

### Analytics
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/analytics` | Get financial analytics |

## 🔒 Security Features

- JWT authentication with secure token handling
- Google OAuth 2.0 for secure login
- Row-level security in Supabase
- CORS protection
- Input validation and sanitization
- SQL injection protection via parameterized queries

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Chart.js](https://www.chartjs.org/) for beautiful charts
- [Supabase](https://supabase.com/) for the backend infrastructure
- [Vercel](https://vercel.com/) for seamless deployment
- [Google](https://developers.google.com/) for OAuth services

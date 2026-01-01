# Personal Finance Tracker

A comprehensive web-based personal finance management application built with vanilla JavaScript, Node.js, and MySQL. Track your income, expenses, and analyze your financial data with beautiful interactive charts.

## Features

### 🏠 Dashboard
- Real-time financial overview
- Monthly income, expenses, and balance summary
- Recent transactions display
- Quick financial insights

### 💰 Transaction Management
- Add income and expense transactions
- Categorize transactions with custom categories
- Edit and delete existing transactions
- Transaction history with filtering options

### 📊 Analytics & Reports
- Interactive pie chart for category distribution
- Income vs expenses bar chart
- Balance over time line chart
- Period selection (Month/Quarter/Year)

### 🏷️ Category Management
- Create custom expense and income categories
- Color-coded categories for better visualization
- Default categories included
- Edit and delete categories

### 🔐 User Authentication
- Secure user registration and login
- JWT-based authentication
- Individual user databases for complete data isolation
- Password hashing with bcrypt

## Technology Stack

### Frontend
- **HTML5** - Semantic markup
- **CSS3** - Modern styling with Flexbox/Grid
- **Vanilla JavaScript** - No frameworks, pure JS
- **Chart.js** - Interactive charts and visualizations

### Backend
- **Node.js** - Server runtime
- **Express.js** - Web framework
- **MySQL** - Database
- **JWT** - Authentication tokens
- **bcrypt** - Password hashing

### Architecture
- **Separate Database Per User** - Complete data isolation
- **RESTful API** - Clean API design
- **Responsive Design** - Works on all devices

## Installation & Setup

### Prerequisites
- Node.js (v14 or higher)
- MySQL (v8.0 or higher)
- npm or yarn

### 1. Clone the Repository
```bash
git clone https://github.com/yourusername/personal-finance-tracker.git
cd personal-finance-tracker
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Database Setup
```bash
# Create the main authentication database
mysql -u root -p < database/auth-schema.sql

# The application will automatically create individual user databases
```

### 4. Environment Configuration
Create a `.env` file in the `backend` directory:
```env
# Database Configuration
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=finance_auth

# JWT Configuration
JWT_SECRET=your_super_secret_jwt_key_here
JWT_EXPIRES_IN=24h
JWT_REFRESH_EXPIRES_IN=7d

# Server Configuration
PORT=3001
NODE_ENV=development
```

### 5. Start the Application
```bash
# Start the backend server
npm start

# Or for development with auto-reload
npm run dev
```

### 6. Access the Application
Open your browser and navigate to:
```
http://localhost:3001
```

## Project Structure

```
personal-finance-tracker/
├── backend/
│   ├── routes/          # API routes
│   ├── middleware/      # Authentication middleware
│   ├── services/        # Business logic
│   └── server.js        # Main server file
├── css/
│   ├── main.css         # Main styles
│   ├── components.css   # Component styles
│   └── responsive.css   # Responsive design
├── js/
│   ├── app.js           # Main application logic
│   ├── auth-manager.js  # Authentication handling
│   ├── database.js      # Database service
│   ├── analytics.js     # Analytics engine
│   └── ...              # Other modules
├── database/
│   └── auth-schema.sql  # Database schema
├── index.html           # Main application page
├── login.html           # Login page
├── register.html        # Registration page
└── README.md
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `POST /api/auth/refresh` - Refresh JWT token

### Transactions
- `GET /api/transactions` - Get user transactions
- `POST /api/transactions` - Create new transaction
- `PUT /api/transactions/:id` - Update transaction
- `DELETE /api/transactions/:id` - Delete transaction

### Categories
- `GET /api/categories` - Get user categories
- `POST /api/categories` - Create new category
- `PUT /api/categories/:id` - Update category
- `DELETE /api/categories/:id` - Delete category

### Analytics
- `GET /api/analytics/stats` - Get financial statistics
- `GET /api/analytics/categories` - Get category breakdown

## Features in Detail

### Security
- Individual MySQL database per user
- JWT authentication with refresh tokens
- Password hashing with bcrypt
- SQL injection protection
- XSS protection

### Data Management
- Complete data isolation between users
- Automatic database creation for new users
- Transaction categorization
- Date-based filtering and analysis

### User Experience
- Responsive design for all devices
- Interactive charts and visualizations
- Real-time data updates
- Intuitive user interface

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

If you encounter any issues or have questions, please open an issue on GitHub.

## Acknowledgments

- Chart.js for beautiful charts
- Express.js for the robust backend framework
- MySQL for reliable data storage
- All contributors who helped improve this project
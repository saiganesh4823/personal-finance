# Vercel Deployment Guide

This guide will help you deploy your Personal Finance Tracker to Vercel.

## 🚀 **Deployment Options**

### **Option 1: Vercel with External Database (Recommended)**

Since Vercel doesn't support MySQL databases directly, you'll need an external database service.

#### **Database Options:**
1. **PlanetScale** (MySQL-compatible, free tier)
2. **Railway** (MySQL hosting)
3. **AWS RDS** (MySQL)
4. **Google Cloud SQL** (MySQL)

### **Step-by-Step Deployment:**

#### **1. Prepare Database**
Choose a cloud MySQL provider (PlanetScale recommended):

**PlanetScale Setup:**
1. Go to [planetscale.com](https://planetscale.com)
2. Create account and new database
3. Get connection string
4. Run your schema:
   ```sql
   -- Copy content from database/auth-schema.sql
   ```

#### **2. Deploy to Vercel**
1. Push your code to GitHub
2. Go to [vercel.com](https://vercel.com)
3. Import your GitHub repository
4. Configure environment variables:

**Environment Variables in Vercel:**
```
DB_HOST=your_planetscale_host
DB_USER=your_planetscale_user
DB_PASSWORD=your_planetscale_password
DB_NAME=your_database_name
JWT_SECRET=your_super_secret_jwt_key
NODE_ENV=production
FRONTEND_URL=https://your-app.vercel.app
```

#### **3. Deploy**
- Vercel will automatically deploy
- Your app will be available at `https://your-app.vercel.app`

---

## 🔧 **Alternative: Split Deployment**

### **Option 2: Frontend on Vercel + Backend on Railway**

#### **Frontend (Vercel):**
1. Create separate repo with just frontend files:
   - `index.html`, `login.html`, `register.html`
   - `js/`, `css/`, `lib/` folders
2. Deploy to Vercel as static site
3. Update API URLs in JavaScript files

#### **Backend (Railway):**
1. Create separate repo with just backend files
2. Deploy to Railway with MySQL database
3. Update CORS settings for Vercel domain

---

## 📋 **Files Added for Vercel:**

- `vercel.json` - Vercel configuration
- `api/index.js` - Serverless function entry point
- Modified `backend/server.js` - Added module export

## 🌐 **Environment Variables Needed:**

```env
DB_HOST=your_database_host
DB_USER=your_database_user  
DB_PASSWORD=your_database_password
DB_NAME=your_database_name
JWT_SECRET=your_jwt_secret_key
NODE_ENV=production
FRONTEND_URL=https://your-vercel-app.vercel.app
```

## ⚠️ **Important Notes:**

1. **Database**: You need external MySQL hosting
2. **Environment Variables**: Set in Vercel dashboard
3. **CORS**: Update frontend URL in environment
4. **File Paths**: Vercel uses serverless functions

## 🚀 **Quick Deploy Commands:**

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Set environment variables
vercel env add DB_HOST
vercel env add DB_USER
vercel env add DB_PASSWORD
vercel env add DB_NAME
vercel env add JWT_SECRET
vercel env add NODE_ENV
vercel env add FRONTEND_URL
```

## 🔍 **Testing Deployment:**

1. Visit your Vercel URL
2. Register a new user
3. Login and test features
4. Check Vercel function logs for errors

## 💡 **Cost Considerations:**

- **Vercel**: Free tier (hobby projects)
- **PlanetScale**: Free tier (1 database)
- **Total**: Free for small projects

Your Personal Finance Tracker will be live and accessible worldwide! 🌍
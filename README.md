# HCC Backend API

## Overview
Express.js backend API connected to MySQL database "hcc" for the HCC system.

## Prerequisites
- Node.js (v16 or higher)
- MySQL Server
- npm or yarn

## Setup Instructions

### 1. Install Dependencies
```bash
npm install
```

### 2. Database Setup
1. Make sure MySQL is running
2. Create the database:
```sql
CREATE DATABASE hcc;
```

### 3. Environment Configuration
Create a `.env` file in the backend directory with the following content:

```env
# Database Configuration
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=hcc

# Server Configuration
PORT=3001
NODE_ENV=development
```

### 4. Start the Server

**Development mode:**
```bash
npm run dev
```

**Production mode:**
```bash
npm start
```

## API Endpoints

### Health Check
- `GET /` - Basic API info
- `GET /health` - Health check with database status

## Database Connection
- **Database**: hcc
- **Connection Pool**: 10 connections
- **Auto-reconnect**: Enabled
- **Timeout**: 60 seconds

## Features
- ✅ MySQL database connection
- ✅ Connection pooling
- ✅ CORS enabled
- ✅ Security headers (Helmet)
- ✅ Request logging (Morgan)
- ✅ Health check endpoint
- ✅ Error handling
- ✅ Auto-reconnection

## Troubleshooting

### Database Connection Issues
1. Verify MySQL is running
2. Check database credentials in `.env`
3. Ensure the `hcc` database exists
4. Check firewall settings

### Port Issues
1. Make sure port 3001 is available
2. Update PORT in `.env` if needed

### Dependencies Issues
1. Run `npm install` to install all dependencies
2. Check Node.js version compatibility

## cPanel deployment

`node_modules` is **not** in Git. After upload or `git pull` you must install packages on the server or you will see:

`Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'express'`

### Steps
1. In **cPanel → Setup Node.js App**:
   - Application root: `backend.kigalitaste.co` (folder that contains `package.json` + `app.js`)
   - Application startup file: **`app.js`** (not `index.js`)
   - Node.js version: **18+** (or 20/22)
2. Open the app’s terminal / SSH into the app directory:
   ```bash
   cd ~/backend.kigalitaste.co
   npm install --omit=dev
   ```
3. Create `.env` in that folder with your cPanel MySQL credentials (`NODE_ENV=production`).
4. Click **Restart** on the Node.js App.

If `bcrypt` fails to build during `npm install`, run:
```bash
npm rebuild bcrypt
```
or ask hosting support to enable build tools for native modules.
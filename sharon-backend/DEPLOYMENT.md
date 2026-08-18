# Production Deployment Guide

## Production Environment Prerequisites
1. **PostgreSQL 14+ Instance**: Set `DATABASE_URL` environment variable.
2. **Node.js 20+ Runtime**
3. **Environment Variables**:
   - `NODE_ENV=production`
   - `PORT=3000`
   - `DATABASE_URL=postgresql://user:password@host:5432/sharon_db`
   - `JWT_SECRET=super_secret_jwt_key`

## Database Migration Command
Apply the database DDL schema:
```bash
psql $DATABASE_URL -f sharon-backend/src/database/schema.sql
```

## Running Server in Production
```bash
cd sharon-backend
npm run build
npm start
```

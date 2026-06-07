# TimberStruct — Full Stack Platform

## Stack
- **Frontend**: React 18 + Vite 5 + Tailwind CSS v3
- **Backend**: Node.js + Express + MySQL (mysql2)
- **Database**: MySQL (timber-db)

## Quick Start

### 1. Import Database
In phpMyAdmin → select timber-db → Import → choose `schema.sql` → Go

### 2. Start Backend
```bash
cd server
npm install
node server.js
```
Backend runs on: http://localhost:4000

### 3. Start Frontend
```bash
cd client
npm install --legacy-peer-deps
npm run dev
```
Frontend runs on: http://localhost:5173


## API Endpoints
| Method | Route | Auth | Description |
|---|---|---|---|
| GET | /api/ping | No | Health check |
| GET | /api/health | No | DB status + user count |
| GET | /api/test | No | List all users (debug) |
| POST | /api/auth/login | No | Login → JWT |
| POST | /api/auth/register | No | Client signup → JWT |
| GET | /api/auth/me | Yes | Current user |
| GET | /api/dashboard/stats | Yes | Dashboard KPIs |
| GET | /api/projects | Yes | List projects |
| POST | /api/projects | Yes | Create project |
| GET | /api/projects/:id | Yes | Project detail |
| PUT | /api/projects/:id | Yes | Update project |
| DELETE | /api/projects/:id | Yes | Delete project |
| GET | /api/projects/:id/members | Yes | Structural members |
| POST | /api/projects/:id/members | Yes | Add member |
| GET | /api/orders | Yes | Procurement orders |
| POST | /api/orders | Yes | Create order |
| PUT | /api/orders/:id | Yes | Update order |
| GET | /api/suppliers | Yes | Supplier list |
| POST | /api/suppliers | Yes | Add supplier |
| POST | /api/appointments | No | Book consultation |
| GET | /api/appointments | Yes | List appointments |
| PUT | /api/appointments/:id | Yes | Update appointment |
| GET | /api/testimonials | No | Public reviews |
| GET | /api/events | Yes | Event log |

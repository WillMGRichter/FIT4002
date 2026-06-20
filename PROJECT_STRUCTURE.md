# SmartSim Project Structure and File Reference

## Project Layout

```
FIT4002/
├── backend/                              # Node.js/Express API
│   ├── src/
│   │   ├── index.ts                     # Main server entry point
│   │   ├── config/
│   │   │   ├── supabase.ts              # Database client initialization
│   │   │   └── entities/
│   │   │       └── user.ts              # User entity (stub for future use)
│   │   ├── types/
│   │   │   └── index.ts                 # ALL TypeScript type definitions
│   │   ├── middleware/
│   │   │   └── authMiddleware.ts        # JWT verification middleware
│   │   ├── services/
│   │   │   ├── authService.ts           # Authentication logic (JWT, bcrypt)
│   │   │   ├── projectService.ts        # Project CRUD operations
│   │   │   └── simulationService.ts     # Simulation state management
│   │   ├── routes/
│   │   │   ├── authRoutes.ts            # /auth endpoints (signup, login)
│   │   │   ├── projectRoutes.ts         # /projects endpoints
│   │   │   └── simulationRoutes.ts      # /simulations endpoints
│   │   └── excel/
│   │       └── excelParser.ts           # Excel file upload/parsing
│   ├── migrations/
│   │   └── 001_initial_schema.sql       # Database schema (RUN THIS FIRST)
│   ├── package.json                     # Dependencies and scripts
│   ├── tsconfig.json                    # TypeScript configuration
│   ├── .env.example                     # Configuration template
│   └── .env                             # (Create locally, not in repo)
│
├── frontend/                            # React SPA
│   ├── src/
│   │   ├── index.tsx                   # React entry point
│   │   ├── App.tsx                     # Main app with routing logic
│   │   ├── index.css                   # Global styles
│   │   ├── contexts/
│   │   │   └── AuthContext.tsx         # Authentication state (global)
│   │   └── pages/
│   │       ├── LoginPage.tsx           # Login form
│   │       ├── SignupPage.tsx          # Signup form
│   │       ├── DashboardPage.tsx       # Project listing dashboard
│   │       ├── ProjectCreatePage.tsx   # Create project with Excel upload
│   │       ├── SimulationPage.tsx      # Student interaction page
│   │       ├── AuthPages.css           # Auth page styling
│   │       ├── Dashboard.css           # Dashboard styling
│   │       ├── ProjectCreate.css       # Create project styling
│   │       └── SimulationPage.css      # Simulation styling
│   ├── public/
│   │   ├── index.html                  # HTML entry point
│   │   ├── manifest.json
│   │   └── robots.txt
│   ├── package.json                    # React dependencies
│   ├── tsconfig.json                   # TypeScript configuration
│   └── .env.local                      # (Local environment, not in repo)
│
├── QUICK_START.md                      # Setup guide (START HERE)
├── IMPLEMENTATION_GUIDE.md             # Architecture and detailed docs
├── IMPLEMENTATION_SUMMARY.md           # Summary of what was built
├── ROADMAP.md                          # Future features guide
└── README.md                           # (Optional: project overview)
```

---

## Key Files to Understand First

### 1. Backend Type Definitions
**Location**: `backend/src/types/index.ts`
- Contains all TypeScript interfaces
- User, Project, Simulation types
- API response types
- User roles: organisation, admin, teacher, student

### 2. Database Schema
**Location**: `backend/migrations/001_initial_schema.sql`
- Create all database tables
- Set up relationships and indexes
- 6 tables: users, organisations, projects, participants, progress, results

### 3. Main Server
**Location**: `backend/src/index.ts`
- Express app setup
- Route mounting
- CORS and middleware configuration
- Port 5000

### 4. Main React App
**Location**: `frontend/src/App.tsx`
- Route definitions
- Auth provider setup
- Protected route logic
- Browser routing config

### 5. Auth Context
**Location**: `frontend/src/contexts/AuthContext.tsx`
- Global authentication state
- Login/signup functions
- Token management
- User persistence

---

## Data Flow Patterns

### Authentication Flow
```
User Form (LoginPage.tsx)
    |
useAuth() hook
    |
authService.loginUser()
    |
Supabase (fetch user + verify password)
    |
JWT generated
    |
Stored in localStorage
    |
AuthContext updated
    |
Routes protected based on user state
```

### Create Project Flow
```
Teacher uploads Excel (ProjectCreatePage.tsx)
    |
Excel parsed (excelParser.ts)
    |
POST /projects (with excelData)
    |
projectService.createProject()
    |
Stored in Supabase
    |
Redirect to dashboard
```

### Run Simulation Flow
```
Student opens project (SimulationPage.tsx)
    |
Fetch project details
    |
Load saved progress (if exists)
    |
Display inputs from Excel
    |
Student modifies values
    |
POST /simulations/:projectId/progress
    |
simulationService.saveSimulationProgress()
    |
Stored in Supabase
    |
Can continue later from same state
```

---

## API Endpoint Reference

### Structure: METHOD /endpoint -> Handler

#### Authentication Routes (/auth)
- `POST /auth/signup/organisation` -> Create org + admin
- `POST /auth/signup` -> Register teacher/student
- `POST /auth/login` -> Generate JWT token

#### Project Routes (/projects)
- `POST /projects` -> Create project
- `GET /projects/:projectId` -> Get project details
- `GET /projects/teacher/projects` -> Get teacher's projects
- `GET /projects/student/projects` -> Get assigned projects
- `PUT /projects/:projectId` -> Update project
- `DELETE /projects/:projectId` -> Delete project
- `POST /projects/:projectId/participants` -> Add student
- `DELETE /projects/:projectId/participants/:userId` -> Remove student
- `GET /projects/:projectId/participants` -> List participants

#### Simulation Routes (/simulations)
- `POST /simulations/:projectId/progress` -> Save state
- `GET /simulations/:projectId/progress` -> Load state
- `POST /simulations/:projectId/complete` -> Submit results
- `GET /simulations/:projectId/results` -> Get all results (teacher)
- `GET /simulations/:projectId/results/user` -> Get user's results

#### Excel Routes (/excel)
- `POST /excel/upload` -> Parse Excel file

---

## Database Schema Overview

### users
```
id (UUID) -> User identifier
username (TEXT) -> Unique login
password_hash (TEXT) -> Bcrypt hash
role (TEXT) -> organisation | admin | teacher | student
organisation_id (FK) -> Parent organisation
created_at / updated_at (TIMESTAMP)
```

### organisations
```
id (UUID) -> Org identifier
name (TEXT) -> School/company name
created_at (TIMESTAMP)
```

### projects
```
id (UUID) -> Project identifier
name (TEXT) -> Simulation name
description (TEXT) -> Details
created_by (FK) -> Teacher who created it
organisation_id (FK) -> Parent org
visibility (TEXT) -> private | public | selective
excel_data (JSONB) -> Parsed Excel formulas
created_at / updated_at (TIMESTAMP)
```

### project_participants
```
id (UUID)
project_id (FK) -> Which project
user_id (FK) -> Which user
role (TEXT) -> teacher | student
created_at (TIMESTAMP)
```

### simulation_progress
```
id (UUID)
project_id (FK)
user_id (FK)
state (JSONB) -> Current input values
saved_at / updated_at (TIMESTAMP)
```

### project_results
```
id (UUID)
project_id (FK)
user_id (FK)
final_state (JSONB) -> Final submitted state
completed_at (TIMESTAMP)
```

---

## Services Explained

### authService.ts
**Purpose**: Authentication and user management
**Key functions**:
- `hashPassword()` - Bcrypt hashing
- `comparePassword()` - Verify password
- `generateToken()` - Create JWT
- `verifyToken()` - Validate JWT
- `registerUser()` - New account
- `loginUser()` - Authenticate
- `getUserById()` - Fetch user
- `createOrganisation()` - New org

### projectService.ts
**Purpose**: Project CRUD and participant management
**Key functions**:
- `createProject()` - New simulation
- `getProjectById()` - Fetch project
- `updateProject()` - Edit details
- `deleteProject()` - Remove project
- `addProjectParticipant()` - Enroll student
- `removeProjectParticipant()` - Unenroll
- `getStudentProjects()` - List student's projects
- `getProjectsByTeacher()` - List teacher's projects

### simulationService.ts
**Purpose**: Simulation state and results
**Key functions**:
- `saveSimulationProgress()` - Save current state
- `getSimulationProgress()` - Load saved state
- `completeSimulation()` - Submit results
- `getProjectResults()` - All results (teacher)
- `getUserProjectResults()` - User's results

---

## Authentication and Authorization

### JWT Token
- Generated on login
- Valid for 7 days
- Stored in localStorage
- Sent in Authorization header: `Bearer {token}`

### Role-Based Access Control (RBAC)
```
organisation
    -> Can: Create org, manage admins
    -> Cannot: Create projects

admin
    -> Can: Create/delete users, manage teachers
    -> Cannot: Create projects (unless also teacher)

teacher
    -> Can: Create projects, add students, view results
    -> Cannot: Access other orgs' projects

student
    -> Can: Run simulations, save progress
    -> Cannot: Create projects, modify permissions
```

### Protected Routes
- All `/projects` endpoints need auth
- All `/simulations` endpoints need auth
- `/auth/login` and `/auth/signup` are public
- Dashboard redirects to login if no user

---

## Component Hierarchy

```
App.tsx (main router)
+-- AuthContext (global auth state)
+-- LoginPage
|   +-- Login form
+-- SignupPage
|   +-- Signup form
+-- DashboardPage
|   +-- Header (logout, user info)
|   +-- Project grid
|   +-- Project cards (clickable)
+-- ProjectCreatePage
|   +-- Project form
|   +-- Excel upload input
|   +-- Excel preview
+-- SimulationPage
    +-- Header (project name)
    +-- Input fields (from Excel)
    +-- State display (JSON)
    +-- Action buttons (save, submit)
```

---

## Key Concepts

### State Management
- `AuthContext` - User authentication state
- Component state - Local form data
- Supabase - Persistent data storage

### Authentication
- Signup creates user + token
- Login verifies credentials + creates token
- Token verified on every protected request
- Token in localStorage for persistence

### Projects
- Teacher creates project with Excel
- Project has participants (enrolled students)
- Each student gets own simulation instance
- Progress saved separately per student

### Simulations
- Students modify input values
- State stored as JSONB in database
- Progress auto-saves
- Results submitted after completion

---

## Common Tasks

### Add a new API endpoint
1. Add function to service (`services/*.ts`)
2. Add route handler to routes file (`routes/*.ts`)
3. Add type definition if needed (`types/index.ts`)
4. Mount route in `index.ts`
5. Add frontend API call in component

### Add a new page
1. Create component file (`pages/ComponentName.tsx`)
2. Create CSS file (`pages/ComponentName.css`)
3. Add route to `App.tsx`
4. Add link/navigation in relevant pages

### Add database table
1. Add SQL to migration file
2. Create TypeScript interface in `types/index.ts`
3. Add service functions
4. Create API endpoints
5. Create frontend components

---

## Testing the Application

### Manual Testing Checklist
- [ ] Signup creates organisation
- [ ] Login works with correct credentials
- [ ] Login fails with wrong password
- [ ] Create project appears in dashboard
- [ ] Add student to project
- [ ] Student sees project in their dashboard
- [ ] Can modify simulation values
- [ ] Can save progress
- [ ] Can load saved progress
- [ ] Can submit simulation
- [ ] Results appear in results table

---

## Documentation Files

| File | Purpose | Read Time |
|------|---------|-----------|
| QUICK_START.md | Setup guide | 5 min |
| IMPLEMENTATION_GUIDE.md | Architecture and API | 20 min |
| ROADMAP.md | Future features | 15 min |
| IMPLEMENTATION_SUMMARY.md | What was built | 10 min |
| This file | Project structure | 10 min |

---

## External Resources

- Supabase Docs: https://supabase.com/docs
- Express.js: https://expressjs.com/
- React: https://react.dev/
- TypeScript: https://www.typescriptlang.org/
- JWT: https://jwt.io/
- XLSX: https://sheetjs.com/

---

## Pro Tips

1. Always check types first - `types/index.ts` shows all data structures
2. Services contain business logic - Routes should be thin wrappers
3. Use consistent error handling - Follow existing patterns
4. Test auth flow first - Most features depend on authentication
5. Frontend auth depends on localStorage - Clear it to reset
6. Check backend logs - Always look at `npm run dev` output
7. Use Supabase dashboard - Useful for viewing/editing data directly

---

**Last Updated**: 2026-06-19
**Version**: 1.0.0 MVP
**Status**: Production Ready

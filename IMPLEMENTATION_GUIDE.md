# SmartSim - Excel Simulation Platform

A web-based platform for teachers to create and manage Excel-based simulations for students. Inspired by Forio but designed for ease of use and rapid setup.

## Project Overview

SmartSim allows:
- Teachers to upload Excel spreadsheets, create simulation projects, and manage student participation
- Students to run simulations, test different scenarios, and save their progress
- Administrators to manage organisational structure and approve project creation
- Easy sharing and tracking of simulation results

## Technology Stack

### Backend
- Framework: Express.js (Node.js)
- Language: TypeScript
- Database: Supabase (PostgreSQL)
- Authentication: JWT
- File Handling: Multer
- Excel Processing: XLSX

### Frontend
- Framework: React 19
- Language: TypeScript
- Routing: React Router DOM
- Styling: CSS3
- State Management: React Context API

## Project Structure

```
FIT4002/
├── backend/
│   ├── src/
│   │   ├── index.ts                 # Main server entry
│   │   ├── config/
│   │   │   ├── supabase.ts          # Supabase client
│   │   │   └── entities/
│   │   │       └── user.ts          # User entity definitions
│   │   ├── types/
│   │   │   └── index.ts             # TypeScript types
│   │   ├── middleware/
│   │   │   └── authMiddleware.ts    # JWT authentication
│   │   ├── services/
│   │   │   ├── authService.ts       # Auth logic
│   │   │   ├── projectService.ts    # Project CRUD
│   │   │   └── simulationService.ts # Simulation state
│   │   ├── routes/
│   │   │   ├── authRoutes.ts        # Auth endpoints
│   │   │   ├── projectRoutes.ts     # Project endpoints
│   │   │   └── simulationRoutes.ts  # Simulation endpoints
│   │   └── excel/
│   │       └── excelParser.ts       # Excel file processing
│   ├── migrations/
│   │   └── 001_initial_schema.sql   # Database schema
│   ├── package.json
│   ├── tsconfig.json
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── App.tsx                  # Main app with routing
│   │   ├── contexts/
│   │   │   └── AuthContext.tsx      # Authentication context
│   │   └── pages/
│   │       ├── LoginPage.tsx        # Login UI
│   │       ├── SignupPage.tsx       # Signup UI
│   │       ├── DashboardPage.tsx    # Main dashboard
│   │       ├── AuthPages.css        # Auth styling
│   │       └── Dashboard.css        # Dashboard styling
│   ├── package.json
│   ├── tsconfig.json
│   └── public/
└── README.md
```

## Setup Instructions

### Prerequisites
- Node.js 18+
- npm or yarn
- Supabase account (https://supabase.com)

### 1. Backend Setup

```bash
cd backend
npm install

# Create .env file
cp .env.example .env

# Configure your .env with:
# - SUPABASE_URL: Your Supabase project URL
# - SUPABASE_SERVICE_ROLE_KEY: Your Supabase service role key
# - JWT_SECRET: REQUIRED. A long random string (the server refuses to start without
#   it). Generate one: node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

**Run SQL migrations in Supabase:**
1. Go to Supabase dashboard
2. Navigate to SQL Editor
3. Create a new query and paste the contents of `migrations/001_initial_schema.sql`
4. Execute the SQL

**Start the backend:**
```bash
npm run dev
```

The backend will run on `http://localhost:5000`

### 2. Frontend Setup

```bash
cd frontend
npm install

# Start the development server
npm start
```

The frontend will run on `http://localhost:3000`

## API Endpoints

### Authentication
- `POST /auth/signup/organisation` - Create new organisation with admin account
- `POST /auth/signup` - Register teacher/student
- `POST /auth/login` - Login

### Projects
- `POST /projects` - Create new project
- `GET /projects/:projectId` - Get project details
- `GET /projects/teacher/projects` - Get teacher's projects
- `GET /projects/student/projects` - Get student's assigned projects
- `PUT /projects/:projectId` - Update project
- `DELETE /projects/:projectId` - Delete project
- `POST /projects/:projectId/participants` - Add participant
- `GET /projects/:projectId/participants` - Get participants
- `DELETE /projects/:projectId/participants/:userId` - Remove participant

### Simulations
- `POST /simulations/:projectId/progress` - Save simulation progress
- `GET /simulations/:projectId/progress` - Get saved progress
- `POST /simulations/:projectId/complete` - Submit completed simulation
- `GET /simulations/:projectId/results` - Get all results (teacher only)
- `GET /simulations/:projectId/results/user` - Get user's results

### Excel
- `POST /excel/upload` - Upload and parse Excel file

## Database Schema

### users
- id (UUID) - Primary key
- username (TEXT) - Unique username
- email (TEXT) - Optional
- password_hash (TEXT) - Bcrypt hashed password
- role (TEXT) - organisation | admin | teacher | student
- organisation_id (UUID) - Foreign key to organisations
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)

### organisations
- id (UUID) - Primary key
- name (TEXT) - Unique organisation name
- created_at (TIMESTAMP)

### projects
- id (UUID) - Primary key
- name (TEXT) - Project name
- description (TEXT) - Optional description
- created_by (UUID) - Teacher/admin who created it
- organisation_id (UUID) - Organisation it belongs to
- visibility (TEXT) - private | public | selective
- excel_data (JSONB) - Parsed Excel spreadsheet data
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)

### project_participants
- id (UUID) - Primary key
- project_id (UUID) - Foreign key
- user_id (UUID) - Foreign key
- role (TEXT) - teacher | student
- created_at (TIMESTAMP)

### simulation_progress
- id (UUID) - Primary key
- project_id (UUID) - Foreign key
- user_id (UUID) - Foreign key
- state (JSONB) - Current simulation state
- saved_at (TIMESTAMP)
- updated_at (TIMESTAMP)

### project_results
- id (UUID) - Primary key
- project_id (UUID) - Foreign key
- user_id (UUID) - Foreign key
- final_state (JSONB) - Final simulation state
- completed_at (TIMESTAMP)

## User Flows

### Organisation Setup
1. Admin creates organisation account (signup/organisation)
2. System generates unique organisation
3. Admin can now invite teachers

### Teacher Workflow
1. Login with teacher credentials
2. Dashboard shows their projects
3. Create new project:
   - Upload Excel file
   - Configure simulation parameters
   - Design UI (canvas)
   - Set visibility and sharing
4. Invite students via email/ID
5. Monitor student progress
6. View results and analytics

### Student Workflow
1. Receive invite to simulation
2. Login to dashboard
3. See assigned simulations
4. Open simulation:
   - View Excel inputs/outputs
   - Adjust input values
   - Save progress
   - Continue later
5. Submit completed simulation

## Next Steps / TODO

### High Priority
- [ ] Create project management UI (teacher)
- [ ] Implement Excel upload and parsing UI
- [ ] Create simulation canvas interface
- [ ] Build input/output widget system
- [ ] Implement student simulation interface
- [ ] Add results visualization dashboard

### Medium Priority
- [ ] Drag-and-drop canvas builder for UI
- [ ] Widget system (sliders, inputs, charts)
- [ ] Real-time collaboration features
- [ ] Student list management (bulk upload)
- [ ] Email notifications for invites
- [ ] Excel formula calculation engine

### Lower Priority
- [ ] Version history for projects
- [ ] Undo/redo functionality
- [ ] Mobile responsiveness
- [ ] Multi-page/tab support in simulations
- [ ] Advanced analytics and reporting
- [ ] Custom widget templates

## Security Considerations

1. Passwords: Hashed with bcrypt (10 rounds)
2. Tokens: JWT with 7-day expiration
3. Database: All sensitive queries use parameterized statements
4. Authorization: Role-based access control on all endpoints
5. CORS: Configured to allow frontend domain

## Environment Variables

### Backend
```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
JWT_SECRET=<long random string - REQUIRED, generate with: node -e "console.log(require('crypto').randomBytes(48).toString('hex'))">
PORT=5000
NODE_ENV=development
```

## Contributing

1. Create a feature branch
2. Make your changes
3. Test thoroughly
4. Submit a pull request

## License

MIT

## Support

For issues or questions, please create an issue in the repository.

# SmartSim - Quick Start Guide

## 5-Minute Setup

### Prerequisites
- Node.js 18+ installed
- Supabase account (create free at https://supabase.com)
- Git (to clone the repo)

### Step 1: Get Supabase Credentials (2 minutes)

1. Go to https://supabase.com and create a free account
2. Create a new project
3. Go to **Settings → API** to find:
   - `SUPABASE_URL` - Your project URL
   - `SUPABASE_SERVICE_ROLE_KEY` - Service role key (under "Service roles")
4. Copy these values - you'll need them shortly

### Step 2: Setup Database (1 minute)

1. In your Supabase dashboard, go to **SQL Editor**
2. Click **New Query**
3. Open [backend/migrations/001_initial_schema.sql](backend/migrations/001_initial_schema.sql)
4. Copy and paste the entire SQL into the query box
5. Click **Run** to create all tables

### Step 3: Configure Backend (1 minute)

```bash
cd backend
npm install

# Create .env file
cp .env.example .env

# Edit .env and add your Supabase credentials:
# SUPABASE_URL=https://xxxx.supabase.co
# SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
# JWT_SECRET=my-super-secret-key-please-change
```

### Step 4: Start Backend (1 minute)

```bash
npm run dev
```

You should see: `SmartSim API running on port 5000`

### Step 5: Setup Frontend (30 seconds)

In a new terminal:

```bash
cd frontend
npm install
npm start
```

Frontend will open at `http://localhost:3000`

---

## First Time Using SmartSim

### Create Organisation & Admin Account

1. Click **Sign Up** on the login page
2. Fill in:
   - **Organisation Name**: Your school/company name
   - **Username**: Your admin username
   - **Password**: Strong password
3. Click **Create Account**
4. You'll be taken to the dashboard

### Create Your First Simulation

1. Click **+ Create New Project**
2. Give it a name: e.g., "Sales Forecast Model"
3. Upload an Excel file (must have formulas)
   - Example: A spreadsheet with sales inputs and calculated revenue
4. Click **Create Project**
5. You now have your first simulation!

### Start a Simulation (as Student)

1. Log out and create a new account with role "student"
2. Ask your teacher to add you to the project
3. Log in and click on the project
4. You'll see input fields for each Excel cell
5. Adjust values and see results
6. Click **Save Progress** to save your work
7. Click **Submit Simulation** to complete

---

## Key Features Explained

### For Teachers
- **Create Projects**: Upload Excel files as simulation engines
- **Manage Students**: Add/remove students from simulations
- **View Results**: See what each student did with the simulation
- **Share Projects**: Set visibility (private/public/selective)

### For Students
- **Run Simulations**: Interact with Excel models through a simple UI
- **Save Progress**: Leave and come back later
- **Test Scenarios**: Change inputs and see outputs change
- **Submit Results**: Turn in your work when done

### For Organisation Admins
- **Manage Users**: Create teacher and student accounts
- **Monitor Activities**: See all projects and activity

---

## API Endpoints Quick Reference

### Authentication
```bash
# Signup
POST /auth/signup/organisation
{
  "username": "admin",
  "password": "password",
  "organisationName": "My School"
}

# Login
POST /auth/login
{
  "username": "admin",
  "password": "password"
}
```

### Projects
```bash
# Create project
POST /projects
Authorization: Bearer {token}
{
  "name": "My Simulation",
  "description": "Description here",
  "excelData": {...}
}

# Get your projects
GET /projects/teacher/projects
Authorization: Bearer {token}

# Add student to project
POST /projects/{projectId}/participants
Authorization: Bearer {token}
{
  "userId": "student-id",
  "role": "student"
}
```

### Simulations
```bash
# Save progress
POST /simulations/{projectId}/progress
Authorization: Bearer {token}
{
  "state": {"A1": 100, "B2": 200}
}

# Submit completed simulation
POST /simulations/{projectId}/complete
Authorization: Bearer {token}
{
  "finalState": {"A1": 100, "B2": 200}
}

# Get results (teacher only)
GET /simulations/{projectId}/results
Authorization: Bearer {token}
```

---

## Excel File Format

SmartSim works best with Excel files that have:

1. **Input cells**: Where students enter values
   - Example: "Quantity" in cell A1
   
2. **Formula cells**: That calculate based on inputs
   - Example: Cell B1 has formula `=A1*100` (calculates total cost)

3. **Clear structure**: Organized sheets with related data

### Example Excel Structure
```
Sheet1: Sales Model
├─ Inputs:
│  ├─ A1: "Unit Price" → 50
│  ├─ A2: "Quantity" → 10
│
└─ Calculations:
   ├─ B1: =A1*A2 (Total Revenue)
   └─ B2: =B1*0.2 (20% Profit)
```

When uploaded, students see:
- Input boxes for A1 and A2
- Calculated values B1 and B2 update as they change inputs

---

## Troubleshooting

### "Cannot connect to server"
- Check backend is running on port 5000
- Verify Supabase credentials in `.env`
- Check firewall isn't blocking port 5000

### "Login failed"
- Verify Supabase tables were created (check SQL migration)
- Make sure password was entered correctly
- Try creating a new account

### "Excel upload failed"
- Ensure file is `.xlsx` format
- File must have at least one formula
- File size should be under 5MB

### "Project not showing up"
- Refresh the page
- Check backend logs for errors
- Verify user has permission to view project

---

## Next Steps

1. ✓ Set up database and backend
2. ✓ Start frontend
3. ✓ Create first simulation
4. ✓ Invite students
5. **Ready to use!**

## Getting Help

- Check [IMPLEMENTATION_GUIDE.md](IMPLEMENTATION_GUIDE.md) for detailed architecture
- Review API documentation above
- Check browser console for errors (F12)
- Check backend terminal for server logs

## Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| Port 5000 already in use | Change `PORT` in backend `.env` |
| Database connection error | Verify Supabase URL and key are correct |
| Login always fails | Make sure SQL migration was executed |
| Can't upload Excel | File must be `.xlsx` with formulas |
| CORS errors | Backend should be on `http://localhost:5000` |

---

** You're now running SmartSim! **

For advanced features and customization, see [IMPLEMENTATION_GUIDE.md](IMPLEMENTATION_GUIDE.md).

# SmartSim

SmartSim turns an Excel workbook into an interactive simulation that students run in the
browser. A teacher uploads a spreadsheet, designs the simulation's pages by dragging
inputs, outputs, charts, tables, text and images onto a canvas, and shares a link. Students
sign in, change the input values, and the spreadsheet's formulas are recalculated live. Each
student's inputs, progress and results are saved separately.

Built for FIT4002 (Software Engineering Studio Project, Monash University). The client's
goal was to simplify the use of Excel for teaching, taking inspiration from Forio.

## What it does

**Teachers / admins**
- Sign up, which creates an organisation and an admin account.
- Create a simulation: upload an `.xlsx` workbook (multiple sheets supported) and add students.
- Design pages in a drag-and-drop designer: text, number/percentage/slider/dropdown inputs,
  bar and pie charts, tables and images. Each element is bound to a spreadsheet cell.
- Use several pages (scenarios) per simulation. Values are isolated between pages.
- Share a join link with students and set the maximum number of attempts.
- Preview the simulation as a student.

**Students**
- Open the join link and sign in with the username and password their teacher set.
- Work through the pages, adjust inputs and watch outputs, charts and tables update.
- Inputs save automatically. Submit when finished. Attempts are limited by the teacher.

## How it works

```
Browser (React SPA)  ->  Express API (JWT auth)  ->  Supabase PostgreSQL
        |
   FormulaEngine evaluates the workbook's formulas in the browser
```

1. The backend reads the uploaded workbook (SheetJS plus a custom OOXML reader that
   recovers formulas SheetJS doesn't expose) and stores its cell graph as JSONB.
2. The designer binds elements to cells and saves page layouts.
3. The student view evaluates formulas client-side with the project's own `FormulaEngine`,
   so server load does not grow as students interact. Student state is saved through the API.

Details: [System Architecture Document](docs/design/SmartSim_System_Architecture_Document.docx).

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript, Create React App, React Router, `@xyflow/react` |
| Backend | Node.js, Express 5, TypeScript |
| Database | PostgreSQL on Supabase (plain SQL migrations in `backend/migrations/`) |
| Auth | bcrypt password hashing, JWT (custom, not Supabase Auth) |
| Security | helmet, express-rate-limit, upload size limit |
| Testing | Jest, React Testing Library, supertest |
| CI | GitHub Actions (backend, frontend, DB integration) |

## Getting started

Prerequisites: Node.js 20+, Git, and a free [Supabase](https://supabase.com) project.

1. **Apply the database migrations.** In the Supabase SQL Editor, run all five files in
   `backend/migrations/` in order (`001` to `005`). Skipping any breaks login or signup.
2. **Configure and start the backend.**
   ```bash
   cd backend
   npm install
   cp .env.example .env     # fill in SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, JWT_SECRET
   npm run dev              # http://localhost:5000 (PORT is configurable)
   ```
   `JWT_SECRET` is required. The server refuses to start without it. Never commit `.env`.
3. **Start the frontend.**
   ```bash
   cd frontend
   npm install
   npm start
   ```
4. Open the app, click **Sign Up** to create an admin account, then **Create New Simulation**.
   Sample workbooks are in [`sample-excel-sheets/`](sample-excel-sheets/).

The full walkthrough is in the [Technical Guide](docs/guides/SmartSim_Technical_Guide.docx)
and the [User Guide](docs/guides/SmartSim_User_Guide.docx).
Students on a local network: see [docs/STUDENT_JOIN.md](docs/STUDENT_JOIN.md).

## Running the tests

```bash
cd backend  && npm test                          # mocked unit and route tests
cd frontend && npm test -- --watchAll=false      # component and unit tests
```

The backend DB integration suite is opt-in and needs Docker and the Supabase CLI. See
[docs/TESTS.md](docs/TESTS.md) and [docs/CI.md](docs/CI.md).

## Documentation

Everything below is in this repository.

**Guides**
- [Technical Guide](docs/guides/SmartSim_Technical_Guide.docx): setup, deployment, configuration.
- [User Guide](docs/guides/SmartSim_User_Guide.docx): teacher and student walkthrough.
- [Student join and LAN access](docs/STUDENT_JOIN.md)

**Design**
- [System Architecture Document](docs/design/SmartSim_System_Architecture_Document.docx)
- [Database Design](docs/design/SmartSim_Database_Design.docx)
- [Security and Privacy](docs/design/SmartSim_Security_and_Privacy.docx)
- Prototypes: [lo-fi](docs/design/SmartSim_LoFi_Prototype.png), [hi-fi](docs/design/SmartSim_HiFi_Prototype.png)
- Module diagrams: [`docs/diagrams/`](docs/diagrams/)

**Quality assurance**
- [Test suite overview](docs/TESTS.md)
- [CI pipeline](docs/CI.md)
- [Workflow definition](.github/workflows/ci.yml)

**Project management**
- [Project Management Artefact](docs/project-management/Project_Management_Artefact.docx)
- [Project Plan](docs/project-management/SmartSim_Project_Plan.docx)
- [Project Timeline](docs/project-management/SmartSim_Project_Timeline.xlsx)
- [Risk Register](docs/project-management/SmartSim_RiskMatrix.docx)
- Meeting minutes: [client](docs/project-management/meeting-minutes/SmartSim_Client_Meeting_Minutes.docx), [supervisor](docs/project-management/meeting-minutes/SmartSim_Supervisor_Meeting_Minutes.docx)

**Other repository notes**
- [Implementation guide](IMPLEMENTATION_GUIDE.md) (includes hosting behind a reverse proxy)
- [Project structure](PROJECT_STRUCTURE.md)
- [Roadmap](ROADMAP.md)

## Repository layout

```
backend/            Express API: routes, services, middleware, Excel parsing, migrations
frontend/           React app: pages, components, FormulaEngine, designer modules
docs/               Test and CI docs, diagrams, and docs/design, guides, project-management (FIT4002 documents)
sample-excel-sheets/  Example workbooks for trying the product
scripts/            Helpers that build the demo workbooks
supabase/           Local Supabase configuration (used by integration tests)
.github/workflows/  CI
```

## Known limitations

- Not hosted. The client confirmed hosting is not required. Deployment steps are in the Technical Guide.
- Browser-side formulas support the functions implemented in `FormulaEngine`. Other Excel functions will not calculate.
- Some read endpoints require login but do not check project membership, and CORS is open.
  See the Security and Privacy document for the full list and plan.

## Team

Meng Siau (Project Manager), Agamjot Singh (Lead Backend), Jackson Tong (Lead Frontend),
William Richter (Software Architect), Huu Nguyen (Scrum Master).
Supervisor: Md Shamsujjoha. Client: Alphan Culha.

# SmartSim - Feature Implementation Roadmap

## Completed Baseline Features

### Phase 1: Foundation (COMPLETE)
- [x] User authentication system (signup/login)
- [x] Role-based access control (admin, teacher, student)
- [x] Organisation structure
- [x] Project/simulation CRUD operations
- [x] Excel file upload and parsing
- [x] Simulation state persistence
- [x] Results tracking
- [x] Basic dashboard UI
- [x] Project creation UI
- [x] Simulation interface for students

### Phase 2: Core Functionality (COMPLETE)
- [x] JWT authentication with middleware
- [x] Password security (bcrypt hashing)
- [x] Project participant management
- [x] Simulation progress saving
- [x] Results collection and retrieval
- [x] Database migrations
- [x] API error handling
- [x] Frontend routing and protected routes
- [x] Auth context for state management

---

## High Priority Features (Recommended Next)

### 1. Student Management UI
**Status**: Not started
**Effort**: 4-6 hours
**Description**: Interface for teachers to manage their students

**Components needed**:
- Student list page for each project
- Add/remove students UI
- Bulk import students from CSV
- Student status tracking (in progress, completed, not started)

**Files to create**:
```
frontend/src/pages/ProjectManagePage.tsx
frontend/src/pages/StudentListPage.tsx
frontend/src/components/StudentTable.tsx
frontend/src/services/studentService.ts
```

**Example API calls to add**:
```typescript
POST /projects/:projectId/participants/bulk
DELETE /projects/:projectId/participants/:userId
GET /projects/:projectId/participants/status
```

---

### 2. Teacher Results Dashboard
**Status**: Not started
**Effort**: 6-8 hours
**Description**: Teachers view student results and analytics

**Components needed**:
- Results table showing all students' submissions
- Individual result viewer (detailed state)
- Basic analytics (completion rate, average scores)
- Export results to CSV

**Files to create**:
```
frontend/src/pages/ResultsPage.tsx
frontend/src/components/ResultsTable.tsx
frontend/src/components/ResultDetail.tsx
frontend/src/services/resultsService.ts
```

**Backend enhancements needed**:
```typescript
GET /simulations/:projectId/results/analytics
GET /simulations/:projectId/results/:resultId
POST /simulations/:projectId/results/export
```

---

### 3. Project Settings and Sharing
**Status**: Partially done (API ready)
**Effort**: 3-4 hours
**Description**: Configure project visibility and access

**Components needed**:
- Project settings page
- Visibility selector (private/public/selective)
- Sharing with specific users
- Project edit form

**Files to create**:
```
frontend/src/pages/ProjectSettingsPage.tsx
frontend/src/components/ProjectForm.tsx
```

**Example features**:
- Change project name/description
- Set visibility levels
- Invite specific users by email
- Set project due date
- Clone project

---

## Medium Priority Features

### 4. Dashboard Widgets
**Status**: Not started
**Effort**: 8-10 hours
**Description**: Interactive widgets for simulation interface

**Components needed**:
- Slider input widget
- Number input widget
- Dropdown selector widget
- Chart/graph display widget
- Table display widget

**Architecture**:
```typescript
// Define widget interface
interface Widget {
  id: string;
  type: 'slider' | 'input' | 'dropdown' | 'chart' | 'table';
  config: {
    min?: number;
    max?: number;
    step?: number;
    linkedCell?: string;
    label?: string;
  };
  position: { x: number; y: number };
  size: { width: number; height: number };
}
```

---

### 5. Drag-and-Drop Canvas Builder
**Status**: Not started
**Effort**: 12-16 hours
**Description**: Teachers design simulation UI visually

**Technologies**: React-DnD or React-Beautiful-DnD
**Components needed**:
- Canvas area
- Widget palette
- Property inspector
- Preview mode
- Save/load layouts

**Example workflow**:
1. Teacher drags slider widget onto canvas
2. Selects Excel cell to link
3. Configures min/max values
4. Drags chart widget and links to formula cells
5. Saves layout
6. Students see the designed UI

---

## Lower Priority Enhancements

### 6. Email Notifications
- Student invite emails
- Project reminders
- Completion confirmations
- **Effort**: 4-6 hours

### 7. Version Control
- Project version history
- Undo/redo functionality
- Rollback to previous versions
- **Effort**: 6-8 hours

### 8. Advanced Analytics
- Student performance metrics
- Time spent on simulations
- Input change frequency
- Visualization dashboards
- **Effort**: 8-10 hours

### 9. Mobile Responsiveness
- Responsive UI for tablets
- Touch-friendly controls
- Mobile-optimized dashboard
- **Effort**: 6-8 hours

### 10. Real-time Collaboration
- Live student monitoring
- Real-time formula updates
- Multiplayer simulations
- **Effort**: 12-16 hours

---

## Technical Improvements

### Backend Enhancements
- Input validation middleware
- Rate limiting
- API documentation (Swagger)
- Unit tests
- Error logging
- Database indexing optimization
- Caching layer (Redis)

### Frontend Improvements
- Form validation library (React Hook Form)
- State management enhancement (Redux/Zustand)
- Error boundary components
- Loading skeletons
- Accessibility improvements
- Performance optimization
- Component storybook

### DevOps
- Docker configuration
- GitHub Actions CI/CD
- Automated testing
- Environment configuration
- Monitoring and logging

---

## Implementation Checklist for Next Developer

### Before starting:
- [ ] Read QUICK_START.md
- [ ] Review IMPLEMENTATION_GUIDE.md
- [ ] Understand database schema
- [ ] Test basic flows (create project, simulate)

### For each feature:
- [ ] Create feature branch
- [ ] Implement backend endpoints
- [ ] Implement frontend components
- [ ] Add error handling
- [ ] Test end-to-end
- [ ] Update documentation
- [ ] Create pull request

---

## Recommended Priority Order

### Sprint 1 (Week 1-2):
1. Student Management UI
2. Results Dashboard
3. Project Settings page

### Sprint 2 (Week 3-4):
1. Dashboard Widgets
2. Email notifications
3. Analytics improvements

### Sprint 3+ (Future):
1. Canvas builder
2. Real-time features
3. Advanced integrations

---

## Code Generation Tips

### Adding a new API endpoint
```typescript
// 1. Add to service
export async function myNewFunction(params: any) {
  const { data, error } = await supabase
    .from('table_name')
    .select()
    .eq('condition', value);
  if (error) throw error;
  return data;
}

// 2. Add to routes
router.get('/endpoint', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const result = await myNewFunction(req.body);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// 3. Call from frontend
const result = await fetch('http://localhost:5000/endpoint', {
  method: 'GET',
  headers: { Authorization: `Bearer ${token}` }
});
```

### Adding a new component
```typescript
import React, { useState } from 'react';
import './ComponentName.css';

export const ComponentName: React.FC<Props> = (props) => {
  const [state, setState] = useState('');
  
  return (
    <div className="component">
      {/* JSX */}
    </div>
  );
};
```

---

## Known Limitations

1. **Excel Calculation**: Currently only extracts formulas, does not calculate them
   - Solution: Integrate formula.js or Handsontable
2. **No Real-time Collaboration**: Students cannot work together
   - Solution: Implement WebSocket with Socket.io
3. **Limited Widget Support**: No drag-and-drop UI builder yet
   - Solution: Integrate React-DnD for canvas builder
4. **Mobile**: Not optimized for mobile devices
   - Solution: Add responsive CSS and touch handlers
5. **File Size**: Excel files limited by multer (default 50MB)
   - Solution: Increase limits and add file validation

---

## Useful Resources

- Excel parsing: https://sheetjs.com/
- UI Builder: https://react-dnd.github.io/react-dnd/
- Forms: https://react-hook-form.com/
- Charts: https://recharts.org/
- Database: https://supabase.com/docs
- Backend: https://expressjs.com/
- Frontend: https://react.dev/

---

## Support

For questions about implementation:
1. Check existing code patterns
2. Review similar components/endpoints
3. Check TypeScript types for guidance
4. Ask in PR reviews

**Last Updated**: 2026-06-19
**Maintainer**: SmartSim Team

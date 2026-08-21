import { Routes, Route } from 'react-router-dom';
import { AppLayout } from '@/layout/AppLayout';
import { LoginPage } from '@/auth/LoginPage';
import { ProtectedRoute } from '@/auth/ProtectedRoute';
import { DashboardPage } from '@/features/dashboard/DashboardPage';
import { SurgeryListPage } from '@/features/surgeryBudget/SurgeryListPage';
import { SurgeryBudgetPage } from '@/features/surgeryBudget/SurgeryBudgetPage';
import { ExplorerPage } from '@/features/explorer/ExplorerPage';
import { BenchmarkDashboardPage } from '@/features/benchmarks/BenchmarkDashboardPage';
import { CostIntelligencePage } from '@/features/costIntelligence/CostIntelligencePage';
import { AlertCenterPage } from '@/features/alerts/AlertCenterPage';
import { ReportsPage } from '@/features/reports/ReportsPage';
import { NotFoundPage } from '@/components/common/NotFoundPage';
// Module 1 & 2
import { AdminConfigPage } from '@/features/admin/AdminConfigPage';
import { PatientEntryPage } from '@/features/patients/PatientEntryPage';
// Module 3
import { SchedulingListPage }    from '@/features/scheduling/SchedulingListPage';
import { SchedulingPage }        from '@/features/scheduling/SchedulingPage';
// Module 4 — Pre-Op Checklist is now integrated in SchedulingPage tabs

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<DashboardPage />} />

        {/* Module 1 — Master Configuration (admin only) */}
        <Route
          path="/admin/config"
          element={
            <ProtectedRoute roles={['ADMIN']}>
              <AdminConfigPage />
            </ProtectedRoute>
          }
        />

        {/* Module 2 — Patient Entry */}
        <Route path="/patients" element={<PatientEntryPage />} />

        {/* Module 3 — Scheduling */}
        <Route path="/scheduling" element={<SchedulingListPage />} />
        <Route path="/scheduling/new" element={<SchedulingPage />} />
        <Route path="/scheduling/:scheduleId" element={<SchedulingPage />} />
        {/* Module 4 — Pre-Op Checklist + Documentation are tabs inside SchedulingPage */}

        {/* Surgery Entry (list + form) — combined */}
        <Route path="/surgeries" element={<SurgeryListPage />} />
        <Route path="/surgeries/new" element={<SurgeryBudgetPage />} />
        <Route path="/surgeries/:id" element={<SurgeryBudgetPage />} />
        <Route path="/explorer" element={<ExplorerPage />} />
        <Route path="/benchmarks" element={<BenchmarkDashboardPage />} />
        <Route path="/cost-intelligence" element={<CostIntelligencePage />} />
        <Route path="/alerts" element={<AlertCenterPage />} />
        <Route
          path="/reports"
          element={
            <ProtectedRoute roles={['ADMIN', 'FINANCE', 'MANAGEMENT']}>
              <ReportsPage />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}

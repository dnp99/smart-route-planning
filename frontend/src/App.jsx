import { Navigate, NavLink, Route, Routes } from "react-router-dom";
import RoutePlanner from "./components/RoutePlanner";
import PatientsPage from "./components/patients/PatientsPage";

const linkBaseClassName =
  "rounded-xl px-3 py-2 text-sm font-semibold transition";

const resolveNavLinkClassName = ({ isActive }) =>
  [
    linkBaseClassName,
    isActive
      ? "bg-blue-600 text-white"
      : "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800",
  ].join(" ");

function App() {
  return (
    <div className="mx-auto w-full max-w-4xl p-3 sm:p-4 md:p-6">
      <header className="w-full rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="m-0 text-xs font-semibold uppercase tracking-[0.16em] text-blue-600 dark:text-blue-300">
              CareFlow
            </p>
            <p className="m-0 text-sm text-slate-500 dark:text-slate-400">
              Nurse operations workspace for Su Mei ❤️
            </p>
          </div>

          <nav className="flex flex-wrap items-center gap-2">
            <NavLink to="/patients" className={resolveNavLinkClassName}>
              Patients
            </NavLink>
            <NavLink to="/route-planner" className={resolveNavLinkClassName}>
              Route Planner
            </NavLink>
          </nav>
        </div>
      </header>

      <Routes>
        <Route path="/patients" element={<PatientsPage />} />
        <Route path="/route-planner" element={<RoutePlanner />} />
        <Route path="/" element={<Navigate to="/route-planner" replace />} />
        <Route path="*" element={<Navigate to="/route-planner" replace />} />
      </Routes>
    </div>
  );
}

export default App;

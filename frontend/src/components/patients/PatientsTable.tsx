import type { Patient } from "../../../../shared/contracts";
import { formatTimeWindow, getPatientDisplayName } from "./patientForm";

type PatientsTableProps = {
  isLoading: boolean;
  isSubmitting: boolean;
  patients: Patient[];
  searchQuery: string;
  onDelete: (patientId: string) => Promise<void> | void;
  onEdit: (patient: Patient) => void;
};

const resolveVisitTypeLabel = (patient: Patient): "fixed" | "flexible" | "mixed" => {
  const windows = Array.isArray(patient.visitWindows) ? patient.visitWindows : [];
  if (windows.length === 0) {
    return patient.visitTimeType === "flexible" ? "flexible" : "fixed";
  }

  const visitTypes = new Set(windows.map((window) => window.visitTimeType));
  if (visitTypes.size > 1) {
    return "mixed";
  }

  return visitTypes.has("flexible") ? "flexible" : "fixed";
};

const renderVisitType = (patient: Patient) => {
  const typeLabel = resolveVisitTypeLabel(patient);
  const typeClassName =
    typeLabel === "fixed"
      ? "bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-200"
      : typeLabel === "flexible"
        ? "bg-violet-100 text-violet-700 dark:bg-violet-950/50 dark:text-violet-200"
        : "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-200";

  return (
    <span
      className={[
        "inline-flex rounded-full px-2.5 py-1 text-xs font-semibold uppercase tracking-wide",
        typeClassName,
      ].join(" ")}
    >
      {typeLabel}
    </span>
  );
};

export const PatientsTable = ({
  isLoading,
  isSubmitting,
  patients,
  searchQuery,
  onDelete,
  onEdit,
}: PatientsTableProps) => {
  if (isLoading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white px-5 py-6 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
        Loading patients...
      </div>
    );
  }

  if (patients.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white px-5 py-10 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
        {searchQuery.trim() ? "No patients match this search." : "No patients added yet."}
      </div>
    );
  }

  return (
    <>
      <div className="grid gap-3 md:hidden">
        {patients.map((patient, index) => (
          <article
            key={patient.id}
            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <p className="m-0 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                  No. {index + 1}
                </p>
                <h3 className="mt-1 text-base font-semibold text-slate-900 dark:text-slate-100">
                  {getPatientDisplayName(patient)}
                </h3>
              </div>
              {renderVisitType(patient)}
            </div>

            <dl className="grid gap-3 text-sm">
              <div>
                <dt className="font-semibold text-slate-700 dark:text-slate-300">Address</dt>
                <dd className="m-0 text-slate-600 dark:text-slate-400">{patient.address}</dd>
              </div>
              <div>
                <dt className="font-semibold text-slate-700 dark:text-slate-300">Preferred window</dt>
                <dd className="m-0 text-slate-600 dark:text-slate-400">{formatTimeWindow(patient)}</dd>
              </div>
            </dl>

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => onEdit(patient)}
                aria-label={`Edit patient ${getPatientDisplayName(patient)}`}
                className="flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => void onDelete(patient.id)}
                disabled={isSubmitting}
                aria-label={`Delete patient ${getPatientDisplayName(patient)}`}
                className="flex-1 rounded-xl border border-red-200 px-3 py-2 text-sm font-medium text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-red-900/60 dark:text-red-300 dark:hover:bg-red-950/30"
              >
                Delete
              </button>
            </div>
          </article>
        ))}
      </div>

      <div className="hidden overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 md:block">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
            <colgroup>
              <col className="w-20" />
              <col className="w-[18%]" />
              <col className="w-[32%]" />
              <col className="w-[20%]" />
              <col className="w-[12%]" />
              <col className="w-[18%]" />
            </colgroup>
            <thead className="bg-slate-50 dark:bg-slate-950">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                  No.
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                  Name
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                  Address
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                  Preferred window
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                  Type
                </th>
                <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white dark:divide-slate-800 dark:bg-slate-900">
              {patients.map((patient, index) => (
                <tr
                  key={patient.id}
                  className="transition hover:bg-slate-50 dark:hover:bg-slate-950"
                >
                  <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300">
                    {index + 1}
                  </td>
                  <td className="px-6 py-4 text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {getPatientDisplayName(patient)}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300">
                    {patient.address}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300">
                    {formatTimeWindow(patient)}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300">
                    {renderVisitType(patient)}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => onEdit(patient)}
                        aria-label={`Edit patient ${getPatientDisplayName(patient)}`}
                        className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => void onDelete(patient.id)}
                        disabled={isSubmitting}
                        aria-label={`Delete patient ${getPatientDisplayName(patient)}`}
                        className="rounded-xl border border-red-200 px-3 py-2 text-sm font-medium text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-red-900/60 dark:text-red-300 dark:hover:bg-red-950/30"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
};

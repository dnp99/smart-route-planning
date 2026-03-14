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

const TrashIcon = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    className={className}
  >
    <path d="M3 6h18" />
    <path d="M8 6V4h8v2" />
    <path d="M19 6l-1 14H6L5 6" />
    <path d="M10 11v6" />
    <path d="M14 11v6" />
  </svg>
);

const EditIcon = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    className={className}
  >
    <path d="M12 20h9" />
    <path d="m16.5 3.5 4 4L8 20H4v-4z" />
  </svg>
);

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
        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-200"
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
            <p className="m-0 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
              No. {index + 1}
            </p>

            <div className="mt-1 grid grid-cols-[1fr_auto] items-start gap-x-2 gap-y-2">
              <h3 className="m-0 min-w-0 text-base font-semibold text-slate-900 dark:text-slate-100">
                {getPatientDisplayName(patient)}
              </h3>
              <div className="row-span-2 flex shrink-0 justify-self-end gap-2">
                <button
                  type="button"
                  onClick={() => onEdit(patient)}
                  aria-label={`Edit patient ${getPatientDisplayName(patient)}`}
                  title={`Edit patient ${getPatientDisplayName(patient)}`}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-300 text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  <EditIcon className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => void onDelete(patient.id)}
                  disabled={isSubmitting}
                  aria-label={`Delete patient ${getPatientDisplayName(patient)}`}
                  title={`Delete patient ${getPatientDisplayName(patient)}`}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-red-200 text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-red-900/60 dark:text-red-300 dark:hover:bg-red-950/30"
                >
                  <TrashIcon className="h-4 w-4" />
                </button>
              </div>
              <div>{renderVisitType(patient)}</div>
            </div>

            <dl className="mt-3 grid gap-3 text-sm">
              <div>
                <dt className="font-semibold text-slate-700 dark:text-slate-300">Time window</dt>
                <dd className="m-0 text-slate-600 dark:text-slate-400">{formatTimeWindow(patient)}</dd>
              </div>
              <div>
                <dt className="font-semibold text-slate-700 dark:text-slate-300">Address</dt>
                <dd className="m-0 text-slate-600 dark:text-slate-400">{patient.address}</dd>
              </div>
            </dl>

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
                        title={`Edit patient ${getPatientDisplayName(patient)}`}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-300 text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                      >
                        <EditIcon className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => void onDelete(patient.id)}
                        disabled={isSubmitting}
                        aria-label={`Delete patient ${getPatientDisplayName(patient)}`}
                        title={`Delete patient ${getPatientDisplayName(patient)}`}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-red-200 text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-red-900/60 dark:text-red-300 dark:hover:bg-red-950/30"
                      >
                        <TrashIcon className="h-4 w-4" />
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

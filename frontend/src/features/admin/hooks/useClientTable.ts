import { useMemo, useState } from "react";
import type { AdminNursePatient } from "../api/adminService";

export type ClientSortKey = "name" | "address" | "createdAt" | "status";
export type SortDirection = "asc" | "desc";

const statusRank = (patient: AdminNursePatient): number => {
  if (patient.isActive) return 0;
  if (patient.archivedAt) return 1;
  return 2;
};

const compare = (left: AdminNursePatient, right: AdminNursePatient, key: ClientSortKey): number => {
  switch (key) {
    case "name":
      return `${left.firstName} ${left.lastName}`.localeCompare(
        `${right.firstName} ${right.lastName}`,
      );
    case "address":
      return left.address.localeCompare(right.address);
    case "status":
      return statusRank(left) - statusRank(right);
    case "createdAt":
    default:
      return left.createdAt.localeCompare(right.createdAt);
  }
};

// Owns search + sort + pagination for the client table together, so a new search
// or sort resets to page one and the slice stays consistent. Pure client-side
// over the already-loaded list.
export const useClientTable = (patients: AdminNursePatient[], pageSize: number) => {
  const [search, setSearchRaw] = useState("");
  const [sortKey, setSortKey] = useState<ClientSortKey>("createdAt");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [page, setPage] = useState(1);

  const setSearch = (value: string) => {
    setSearchRaw(value);
    setPage(1);
  };

  const toggleSort = (key: ClientSortKey) => {
    if (key === sortKey) {
      setSortDirection((direction) => (direction === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      // Dates default newest-first; text/status default A→Z.
      setSortDirection(key === "createdAt" ? "desc" : "asc");
    }
    setPage(1);
  };

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    const matched = query
      ? patients.filter((patient) => {
          const name = `${patient.firstName} ${patient.lastName}`.toLowerCase();
          return name.indexOf(query) !== -1 || patient.address.toLowerCase().indexOf(query) !== -1;
        })
      : patients;

    const sorted = [...matched].sort((left, right) => {
      const result = compare(left, right, sortKey);
      return sortDirection === "asc" ? result : -result;
    });
    return sorted;
  }, [patients, search, sortKey, sortDirection]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(Math.max(1, page), pageCount);
  const pageItems = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  return {
    search,
    setSearch,
    sortKey,
    sortDirection,
    toggleSort,
    page: safePage,
    setPage,
    pageCount,
    pageItems,
    filteredCount: filtered.length,
  };
};

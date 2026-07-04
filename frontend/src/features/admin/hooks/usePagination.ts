import { useState } from "react";

// Client-side pagination over an already-loaded array. Returns the current
// page's slice plus controls. The page is clamped to the valid range so a
// shrinking list never leaves you on an empty page.
export const usePagination = <T>(items: T[], pageSize: number) => {
  const [page, setPage] = useState(1);
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(Math.max(1, page), pageCount);
  const start = (safePage - 1) * pageSize;
  const pageItems = items.slice(start, start + pageSize);

  return { page: safePage, setPage, pageCount, pageItems };
};

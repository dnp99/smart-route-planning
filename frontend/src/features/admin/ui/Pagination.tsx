import { responsiveStyles } from "../../../components/responsiveStyles";

type PaginationProps = {
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
};

// Compact page list: all pages when few, else first/last + a window around the
// current page with ellipses.
const buildPageList = (page: number, pageCount: number): (number | "ellipsis")[] => {
  if (pageCount <= 7) {
    return Array.from({ length: pageCount }, (_, index) => index + 1);
  }
  const pages: (number | "ellipsis")[] = [1];
  const left = Math.max(2, page - 1);
  const right = Math.min(pageCount - 1, page + 1);
  if (left > 2) {
    pages.push("ellipsis");
  }
  for (let current = left; current <= right; current += 1) {
    pages.push(current);
  }
  if (right < pageCount - 1) {
    pages.push("ellipsis");
  }
  pages.push(pageCount);
  return pages;
};

const Pagination = ({ page, pageCount, onPageChange }: PaginationProps) => {
  if (pageCount <= 1) {
    return null;
  }

  const pages = buildPageList(page, pageCount);

  return (
    <nav className={responsiveStyles.adminPaginationRow} aria-label="Pagination">
      <button
        type="button"
        className={`${responsiveStyles.adminPageButton} ${responsiveStyles.adminPageButtonInactive}`}
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1}
        aria-label="Previous page"
      >
        ‹
      </button>

      {pages.map((entry, index) =>
        entry === "ellipsis" ? (
          <span key={`ellipsis-${index}`} className={responsiveStyles.adminPageEllipsis}>
            …
          </span>
        ) : (
          <button
            key={entry}
            type="button"
            className={`${responsiveStyles.adminPageButton} ${
              entry === page
                ? responsiveStyles.adminPageButtonActive
                : responsiveStyles.adminPageButtonInactive
            }`}
            onClick={() => onPageChange(entry)}
            aria-current={entry === page ? "page" : undefined}
          >
            {entry}
          </button>
        ),
      )}

      <button
        type="button"
        className={`${responsiveStyles.adminPageButton} ${responsiveStyles.adminPageButtonInactive}`}
        onClick={() => onPageChange(page + 1)}
        disabled={page >= pageCount}
        aria-label="Next page"
      >
        ›
      </button>
    </nav>
  );
};

export default Pagination;

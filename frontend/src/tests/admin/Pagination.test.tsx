import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import Pagination from "../../features/admin/ui/Pagination";

describe("Pagination", () => {
  afterEach(cleanup);

  it("renders nothing for a single page", () => {
    const { container } = render(
      <Pagination page={1} pageCount={1} onPageChange={() => undefined} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders page numbers and disables prev on the first page", () => {
    const onPageChange = vi.fn();
    render(<Pagination page={1} pageCount={3} onPageChange={onPageChange} />);

    expect(screen.getByText("1")).toBeTruthy();
    expect(screen.getByText("2")).toBeTruthy();
    expect(screen.getByText("3")).toBeTruthy();

    const prev = screen.getByLabelText("Previous page") as HTMLButtonElement;
    expect(prev.disabled).toBe(true);

    fireEvent.click(screen.getByText("2"));
    expect(onPageChange).toHaveBeenCalledWith(2);

    fireEvent.click(screen.getByLabelText("Next page"));
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it("collapses many pages with ellipses around the current page", () => {
    render(<Pagination page={6} pageCount={12} onPageChange={() => undefined} />);
    // first, last, and a window around 6 are shown; far pages collapse to "…"
    expect(screen.getByText("1")).toBeTruthy();
    expect(screen.getByText("12")).toBeTruthy();
    expect(screen.getByText("6")).toBeTruthy();
    expect(screen.getAllByText("…").length).toBeGreaterThan(0);
    expect(screen.queryByText("3")).toBeNull();
  });
});

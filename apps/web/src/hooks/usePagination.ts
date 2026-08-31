import { useState, useMemo } from "react";

export function usePagination<T>(items: T[], initialRowsPerPage = 10) {
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(initialRowsPerPage);

  const paged = useMemo(
    () => items.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage),
    [items, page, rowsPerPage],
  );

  const handleChangePage = (_: unknown, newPage: number) => setPage(newPage);
  const handleChangeRowsPerPage = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0); // reset to first page when page size changes
  };

  return {
    paged,
    page,
    rowsPerPage,
    handleChangePage,
    handleChangeRowsPerPage,
  };
}

import type { ErrorBreakdownEntry } from "./types";

interface Props {
  data: ErrorBreakdownEntry[];
}

export function ErrorBreakdownTable({ data }: Props) {
  return (
    <div className="dashboard-card">
      <h3>{"Error breakdown"}</h3>
      <p className="dashboard-card-subtitle">
        {"Most frequent distinct error messages (redacted)"}
      </p>
      {data.length === 0 ? (
        <p className="dashboard-empty">{"No errors recorded."}</p>
      ) : (
        <table className="dashboard-table">
          <thead>
            <tr>
              <th>{"Error message"}</th>
              <th>{"Count"}</th>
            </tr>
          </thead>
          <tbody>
            {data.map((entry) => (
              <tr key={entry.message}>
                <td>{entry.message}</td>
                <td className="dashboard-table-count">{entry.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

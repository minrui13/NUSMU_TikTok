import type { DenialEvent } from "./types";

interface Props {
  data: DenialEvent[];
}

function formatTimestamp(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function DenialFeed({ data }: Props) {
  return (
    <div className="dashboard-card">
      <h3>{"Denial feed"}</h3>
      <p className="dashboard-card-subtitle">
        {"Most recent blocked actions, redacted"}
      </p>
      {data.length === 0 ? (
        <p className="dashboard-empty">{"No denials recorded."}</p>
      ) : (
        <div className="dashboard-denial-feed">
          {data.map((event) => (
            <article className="dashboard-denial-item" key={event.id}>
              <div className="dashboard-denial-head">
                <span className={"dashboard-denial-source " + event.source}>
                  {event.source}
                </span>
                <span>{formatTimestamp(event.timestamp)}</span>
              </div>
              <div className="dashboard-denial-action">{event.action}</div>
              <div className="dashboard-denial-reason">{event.reason}</div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

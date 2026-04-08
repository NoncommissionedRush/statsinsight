interface Option {
  value: string;
  label: string;
}

interface Props {
  options: Option[];
  from: string;
  to: string;
  totalPoints: number;
  visiblePoints: number;
  disabled?: boolean;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
}

export function TimeRangePicker({
  options,
  from,
  to,
  totalPoints,
  visiblePoints,
  disabled = false,
  onFromChange,
  onToChange,
}: Props) {
  return (
    <section className="time-range-card">
      <div className="time-range-copy">
        <h2>Časové obdobie</h2>
        <p>Zamerajte graf a postrehy na podmnožinu načítaných časových radov.</p>
      </div>

      <div className="time-range-controls">
        <label>
          <span>Od</span>
          <select value={from} onChange={(event) => onFromChange(event.target.value)} disabled={disabled}>
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>Do</span>
          <select value={to} onChange={(event) => onToChange(event.target.value)} disabled={disabled}>
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <p className="time-range-summary">
        Zobrazených {visiblePoints} z {totalPoints} načítaných období.
      </p>
    </section>
  );
}

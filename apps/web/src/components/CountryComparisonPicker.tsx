interface CountryOption {
  code: string;
  label: string;
}

interface Props {
  options: readonly CountryOption[];
  selected: string[];
  maxSelected?: number;
  onToggle: (code: string) => void;
}

export function CountryComparisonPicker({
  options,
  selected,
  maxSelected = 4,
  onToggle,
}: Props) {
  const selectedCount = selected.length;
  const summary =
    selectedCount > 0
      ? `${selectedCount} vybraných`
      : `Vyberte až ${maxSelected} krajín`;

  return (
    <details className="comparison-card" open>
      <summary className="comparison-summary">
        <div className="comparison-summary-copy">
          <h2>Porovnanie krajín</h2>
          <p>{summary}</p>
        </div>
        <span className="comparison-summary-toggle">Zobraziť/Skryť</span>
      </summary>

      <div className="comparison-body">
        <div className="comparison-copy">
          <p>
            Porovnajte Slovensko s až {maxSelected} ďalšími krajinami na rovnakom grafe Eurostatu.
          </p>
        </div>

        <div className="comparison-options">
          {options.map((option) => {
            const isSelected = selected.includes(option.code);
            const atLimit = !isSelected && selected.length >= maxSelected;

            return (
              <label
                key={option.code}
                className={`comparison-pill ${isSelected ? 'selected' : ''} ${atLimit ? 'disabled' : ''}`}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  disabled={atLimit}
                  onChange={() => onToggle(option.code)}
                />
                <span>{option.label}</span>
              </label>
            );
          })}
        </div>
      </div>
    </details>
  );
}

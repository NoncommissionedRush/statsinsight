import type { CatalogEntry } from '../types';

interface Props {
  catalog: CatalogEntry[];
  selected: string | null;
  loading: boolean;
  onSelect: (id: string) => void;
}

const SOURCE_BADGES: Record<string, { label: string; color: string }> = {
  eurostat: { label: 'Eurostat', color: '#003399' },
  susr: { label: 'SU SR', color: '#e63946' },
};

export function DatasetPicker({ catalog, selected, loading, onSelect }: Props) {
  return (
    <div className="dataset-picker">
      <h2>Select a Dataset</h2>
      <div className="dataset-grid">
        {catalog.map((entry) => {
          const badge = SOURCE_BADGES[entry.source];
          const isSelected = selected === entry.id;
          return (
            <button
              key={entry.id}
              className={`dataset-card ${isSelected ? 'selected' : ''}`}
              onClick={() => onSelect(entry.id)}
              disabled={loading}
            >
              <span className="source-badge" style={{ backgroundColor: badge?.color }}>
                {badge?.label}
              </span>
              <h3>{entry.label}</h3>
              <p>{entry.description}</p>
              <span className="unit">Unit: {entry.unit}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

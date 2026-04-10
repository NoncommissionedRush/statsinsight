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
  datacube: { label: 'DATAcube', color: '#0f766e' },
};

export function DatasetPicker({ catalog, selected, loading, onSelect }: Props) {
  const selectedEntry = catalog.find((entry) => entry.id === selected) ?? null;

  return (
    <div className="dataset-picker">
      <div className="dataset-picker-header">
        <div>
          <p className="section-kicker">Dataset explorer</p>
          <h2>Vyberte dataset</h2>
          <p className="dataset-picker-copy">
            Každý dataset otvorí vlastný analytický pohľad s grafom, insightmi a prípadnými špecializovanými blokmi.
          </p>
        </div>
        <div className="dataset-picker-status">
          <span className="dataset-picker-status-label">Aktívny výber</span>
          <strong>{selectedEntry?.label ?? 'Zatiaľ nič nie je vybrané'}</strong>
          <p>{selectedEntry?.unit ?? 'Kliknite na ľubovoľnú kartu nižšie.'}</p>
        </div>
      </div>
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
              <div className="dataset-card-footer">
                <span className="unit">Jednotka: {entry.unit}</span>
                <span className="dataset-card-arrow">{isSelected ? 'Aktívne' : 'Otvoriť'}</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

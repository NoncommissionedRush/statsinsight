const SLOVAK_MONTHS = [
  'Január', 'Február', 'Marec', 'Apríl', 'Máj', 'Jún',
  'Júl', 'August', 'September', 'Október', 'November', 'December',
];

/** Converts "YYYY-MM" to "Month YYYY" in Slovak. Returns the input unchanged for other formats. */
export function formatPeriodLabel(label: string): string {
  const m = label.match(/^(\d{4})-(\d{2})$/);
  if (m) {
    const month = parseInt(m[2], 10);
    if (month >= 1 && month <= 12) return `${SLOVAK_MONTHS[month - 1]} ${m[1]}`;
  }
  return label;
}

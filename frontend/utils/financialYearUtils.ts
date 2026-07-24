export function getDefaultDate(): string {
  try {
    const fyId = localStorage.getItem('selectedFinancialYearId');
    const fyStart = localStorage.getItem('selectedFinancialYearStart');
    const fyEnd = localStorage.getItem('selectedFinancialYearEnd');
    if (fyStart && fyEnd) {
      const today = new Date().toISOString().slice(0, 10);
      if (today >= fyStart && today <= fyEnd) return today;
      return fyStart;
    }
  } catch { /* non-fatal */ }
  return new Date().toISOString().slice(0, 10);
}

export function isDateInFY(date: string): boolean {
  try {
    const fyStart = localStorage.getItem('selectedFinancialYearStart');
    const fyEnd = localStorage.getItem('selectedFinancialYearEnd');
    if (fyStart && fyEnd) {
      return date >= fyStart && date <= fyEnd;
    }
  } catch { /* non-fatal */ }
  return true;
}

export function validateDateInFY(date: string): string | null {
  try {
    const fyId = localStorage.getItem('selectedFinancialYearId');
    if (!fyId) return null;
    const fyStart = localStorage.getItem('selectedFinancialYearStart');
    const fyEnd = localStorage.getItem('selectedFinancialYearEnd');
    const fyName = localStorage.getItem('selectedFinancialYearName');
    if (fyStart && fyEnd && (date < fyStart || date > fyEnd)) {
      return `Selected date does not belong to the active Financial Year (${fyName || 'Unknown'}). Please switch Financial Year or choose a valid date within ${fyStart} to ${fyEnd}.`;
    }
    if (localStorage.getItem('selectedFinancialYearClosed') === '1') {
      return `Financial Year "${fyName || 'Unknown'}" is closed. No new transactions can be created.`;
    }
  } catch { /* non-fatal */ }
  return null;
}
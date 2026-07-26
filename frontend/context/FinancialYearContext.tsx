import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from './AuthContext';
import { api } from '../services/api';

export interface FinancialYear {
  id: string;
  name: string;
  code: string;
  start_date: string;
  end_date: string;
  is_default: number;
  is_closed: number;
  status: string;
  company_id: string;
}

interface FinancialYearContextType {
  selectedFinancialYear: FinancialYear | null;
  availableFinancialYears: FinancialYear[];
  isLoading: boolean;
  setFinancialYear: (fy: FinancialYear) => void;
  refreshFinancialYears: () => Promise<void>;
  isDateInFY: (date: string) => boolean;
  getFYDateRange: () => { start: string; end: string } | null;
  validateDateInFY: (date: string) => string | null;
}

const FinancialYearContext = createContext<FinancialYearContextType | undefined>(undefined);

const STORAGE_KEY = 'selectedFinancialYearId';

function getFyIdFromUrl(): string | null {
  const params = new URLSearchParams(window.location.search);
  return params.get('financialYear') || params.get('fy') || null;
}

const persistFyToLocalStorage = (fy: FinancialYear) => {
  localStorage.setItem(STORAGE_KEY, fy.id);
  localStorage.setItem('selectedFinancialYearName', fy.name);
  localStorage.setItem('selectedFinancialYearStart', fy.start_date);
  localStorage.setItem('selectedFinancialYearEnd', fy.end_date);
  localStorage.setItem('selectedFinancialYearClosed', String(fy.is_closed));
};

export const FinancialYearProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { companyConfig, isInitialized } = useAuth();
  const [financialYears, setFinancialYears] = useState<FinancialYear[]>([]);
  const [selected, setSelected] = useState<FinancialYear | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchFinancialYears = useCallback(async () => {
    try {
      const [years, defaultFy] = await Promise.all([
        api.system.getFinancialYears(),
        api.system.getDefaultFinancialYear(),
      ]);
      setFinancialYears(years || []);
      return { years: years || [], defaultFy: defaultFy || null };
    } catch {
      return { years: [], defaultFy: null };
    }
  }, []);

  const refreshFinancialYears = useCallback(async () => {
    const { years, defaultFy } = await fetchFinancialYears();
    setFinancialYears(years);

    const selectAndPersist = (fy: FinancialYear) => {
      setSelected(fy);
      persistFyToLocalStorage(fy);
    };

    const urlId = getFyIdFromUrl();
    if (urlId) {
      const urlMatch = years.find((fy: FinancialYear) => fy.id === urlId);
      if (urlMatch) {
        selectAndPersist(urlMatch);
        setIsLoading(false);
        return;
      }
    }

    const storedId = localStorage.getItem(STORAGE_KEY);
    if (storedId) {
      const match = years.find((fy: FinancialYear) => fy.id === storedId);
      if (match) {
        selectAndPersist(match);
        setIsLoading(false);
        return;
      }
    }
    if (defaultFy) {
      selectAndPersist(defaultFy);
    } else if (years.length > 0) {
      selectAndPersist(years[0]);
    }
    setIsLoading(false);
  }, [fetchFinancialYears]);

  useEffect(() => {
    if (!isInitialized) return;
    refreshFinancialYears();
  }, [isInitialized, refreshFinancialYears]);

  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue !== e.oldValue) {
        refreshFinancialYears();
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [refreshFinancialYears]);

  const setFinancialYear = useCallback((fy: FinancialYear) => {
    setSelected(fy);
    persistFyToLocalStorage(fy);
  }, []);

  const isDateInFY = useCallback((date: string): boolean => {
    if (!selected) return true;
    return date >= selected.start_date && date <= selected.end_date;
  }, [selected]);

  const getFYDateRange = useCallback(() => {
    if (!selected) return null;
    return { start: selected.start_date, end: selected.end_date };
  }, [selected]);

  const validateDateInFY = useCallback((date: string): string | null => {
    if (!selected) return null;
    if (date < selected.start_date || date > selected.end_date) {
      return `Selected date does not belong to the active Financial Year (${selected.name}). Please switch Financial Year or choose a valid date within ${selected.start_date} to ${selected.end_date}.`;
    }
    if (selected.is_closed) {
      return `Financial Year "${selected.name}" is closed. No new transactions can be created.`;
    }
    return null;
  }, [selected]);

  const value = useMemo(() => ({
    selectedFinancialYear: selected,
    availableFinancialYears: financialYears,
    isLoading,
    setFinancialYear,
    refreshFinancialYears,
    isDateInFY,
    getFYDateRange,
    validateDateInFY,
  }), [selected, financialYears, isLoading, setFinancialYear, refreshFinancialYears, isDateInFY, getFYDateRange, validateDateInFY]);

  return (
    <FinancialYearContext.Provider value={value}>
      {children}
    </FinancialYearContext.Provider>
  );
};

export const useFinancialYear = () => {
  const context = useContext(FinancialYearContext);
  if (!context) throw new Error('useFinancialYear must be used within FinancialYearProvider');
  return context;
};

export default FinancialYearContext;
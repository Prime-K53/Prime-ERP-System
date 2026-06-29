import { useState, useCallback } from 'react';

export interface Conversion {
  id: string;
  fromUnit: string;
  toUnit: string;
  factor: number;
}

const generateId = (): string =>
  'CONV-' + Date.now().toString(36).toUpperCase();

export function useConversionManager() {
  const [conversions, setConversions] = useState<Conversion[]>([]);

  const addConversion = useCallback(() => {
    setConversions(prev => [
      ...prev,
      { id: generateId(), fromUnit: '', toUnit: '', factor: 1 },
    ]);
  }, []);

  const removeConversion = useCallback((id: string) => {
    setConversions(prev => prev.filter(c => c.id !== id));
  }, []);

  const updateConversion = useCallback((id: string, patch: Partial<Conversion>) => {
    setConversions(prev =>
      prev.map(c => (c.id === id ? { ...c, ...patch } : c)),
    );
  }, []);

  const importConversions = useCallback((items: Conversion[]) => {
    setConversions(items);
  }, []);

  const toSimpleConversions = useCallback((): { fromUnit: string; toUnit: string; factor: number }[] => {
    return conversions.map(({ fromUnit, toUnit, factor }) => ({ fromUnit, toUnit, factor }));
  }, [conversions]);

  return {
    conversions,
    addConversion,
    removeConversion,
    updateConversion,
    importConversions,
    toSimpleConversions,
    setConversions,
  };
}

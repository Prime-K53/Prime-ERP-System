import React, { useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ItemWizard } from './ItemWizard';
import { PrintingServiceModal } from './PrintingServiceModal';
import type { Item } from '../../../types';

interface Props {
  open: boolean;
  item?: Item | null;
  onClose: () => void;
  onSave: (item: Item) => Promise<void>;
  allItems?: Item[];
  lockClassification?: boolean;
  sourceTab?: string | null;
}

export const ItemModal: React.FC<Props> = ({ open, item, onClose, onSave, allItems, lockClassification, sourceTab }) => {
  const [internalItem, setInternalItem] = React.useState<Item | null | undefined>(item);
  const modalRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const navigate = useNavigate();

  const handleOpenRecipeEditor = useCallback(() => {
    const pid = internalItem?.id;
    if (pid) {
      navigate('/tools/smart-pricing', { state: { loadProductId: pid } });
    } else {
      alert('Please save the item first before opening the recipe editor.');
    }
  }, [internalItem?.id, navigate]);

  useEffect(() => {
    if (open && item) setInternalItem(item);
  }, [item, open]);

  useEffect(() => {
    if (!open) setInternalItem(null);
  }, [open]);

  useEffect(() => {
    if (open && closeRef.current) {
      closeRef.current.focus();
    }
  }, [open]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  }, [onClose]);

  useEffect(() => {
    if (open) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [open, handleKeyDown]);

  if (!open) return null;

  const handleSave = async (savedItem: Item) => {
    await onSave(savedItem);
    onClose();
  };

  const isPrintingService = (() => {
    if (!internalItem) return false;
    if ((internalItem as any).classification === 'printing_service') return true;
    if ((internalItem as any).classification === 'product') return true;
    if ((internalItem as any).classification === 'stationery') return true;
    if ((internalItem as any).classification === 'raw_material') return true;
    if (internalItem.type === 'Service') {
      if (!internalItem.id && lockClassification) return true;
      if ((internalItem as any).printType || (internalItem as any).printingServiceType || (internalItem as any).printColorMode) return true;
      if ((internalItem as any).productType === 'SERVICE') return true;
    }
    return false;
  })();

  const usePrintingServiceModal = (sourceTab === 'product' || sourceTab === 'printing' || sourceTab === 'stationery' || sourceTab === 'raw' || sourceTab === 'raw material') || isPrintingService;

  if (usePrintingServiceModal) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ background: 'rgba(22,32,27,.5)' }}
        role="dialog"
        aria-modal="true"
        aria-label={internalItem?.id ? `Edit ${sourceTab === 'product' ? 'product' : sourceTab === 'stationery' ? 'stationery' : sourceTab === 'raw_material' ? 'raw material' : 'printing service'}` : `New ${sourceTab === 'product' ? 'product' : sourceTab === 'stationery' ? 'stationery' : sourceTab === 'raw_material' ? 'raw material' : 'printing service'}`}
      >
        <div
          ref={modalRef}
          className="bg-white rounded-[16px] w-full max-w-[72.8rem] max-h-[calc(100vh-4rem)] flex flex-col overflow-hidden"
          style={{ boxShadow: '0 1px 2px rgba(15,30,25,.04), 0 6px 18px rgba(15,30,25,.05)', fontFamily: "'Inter',sans-serif", fontSize: 13.5, lineHeight: 1.45, color: '#1E2A24', padding: '16px 20px' }}
        >
          <PrintingServiceModal
            item={internalItem}
            onSave={handleSave}
            onClose={onClose}
            allItems={allItems}
            sourceTab={sourceTab}
          />
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(22,32,27,.5)' }}
      role="dialog"
      aria-modal="true"
      aria-label={internalItem?.id ? 'Edit item' : 'New item'}
    >
      <div
        ref={modalRef}
        className="bg-white rounded-[16px] w-full max-w-[58.24rem] max-h-[calc(100vh-4rem)] flex flex-col overflow-hidden"
        style={{ boxShadow: '0 1px 2px rgba(15,30,25,.04), 0 6px 18px rgba(15,30,25,.05)', fontFamily: "'Inter',sans-serif", fontSize: 13.5, lineHeight: 1.45, color: '#1E2A24' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between shrink-0" style={{ padding: '12px 16px', borderBottom: '1px solid #E5E8E1', background: 'white' }}>
          <div className="flex items-center gap-3">
            <div className="w-[34px] h-[34px] rounded-[9px] flex items-center justify-center bg-[#DCF0EA]" style={{ color: '#128C72' }}>
              <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            <div>
              <h2 className="font-bold" style={{ fontSize: 20, color: '#1E2A24', margin: 0, lineHeight: 1.4 }}>
                {internalItem?.id ? 'Edit Item' : 'New Item'}
              </h2>
              <p style={{ fontSize: 13, color: '#6C766F', margin: 0, lineHeight: 1.45 }}>
                {internalItem?.id ? internalItem.name || `ID: ${internalItem.id}` : 'Create a new inventory item'}
              </p>
            </div>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            style={{ color: '#9CA59E', padding: 6 }}
            aria-label="Close modal"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 flex flex-col overflow-hidden min-h-0" style={{ padding: '14px 16px' }}>
          <ItemWizard
            item={internalItem}
            onSave={handleSave}
            onClose={onClose}
            onOpenRecipeEditor={handleOpenRecipeEditor}
            allItems={allItems}
            lockClassification={lockClassification}
          />
        </div>
      </div>
    </div>
  );
};

export default ItemModal;

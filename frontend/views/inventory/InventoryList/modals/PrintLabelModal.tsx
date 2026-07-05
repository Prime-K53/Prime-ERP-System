import React, { useState, useEffect } from 'react';
import { X, Printer, QrCode, Barcode, Loader2 } from 'lucide-react';
import QRCode from 'qrcode';
import type { Item } from '../../../../types';
import { generateBarcodeDataUrl } from '../../../../utils/barcodeGenerator';
import { currencyService } from '../../../../services/currencyService';
import { useAuth } from '../../../../context/AuthContext';

interface Props {
  open: boolean;
  items: Item[];
  mode: 'barcode' | 'qrcode' | 'label';
  onClose: () => void;
}

export const PrintLabelModal: React.FC<Props> = ({ open, items, mode, onClose }) => {
  const { companyConfig } = useAuth();
  const currency = companyConfig?.currencySymbol || currencyService.getCurrency(currencyService.getBaseCurrency())?.symbol || '$';
  const [showPrice, setShowPrice] = useState(true);
  const [showName, setShowName] = useState(true);
  const [showSKU, setShowSKU] = useState(true);
  const [qrDataUrls, setQrDataUrls] = useState<Record<string, string>>({});
  const [barcodeDataUrls, setBarcodeDataUrls] = useState<Record<string, string>>({});
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (!open) return;
    const generate = async () => {
      setGenerating(true);
      const qrUrls: Record<string, string> = {};
      const bcUrls: Record<string, string> = {};
      for (const item of items) {
        const barcodeText = item.barcode || item.sku || item.id || item.name;
        if (barcodeText) {
          bcUrls[item.id] = generateBarcodeDataUrl(barcodeText, { height: 50, width: 2, margin: 5, fontSize: 10 });
        }
        if (mode === 'qrcode') {
          try { qrUrls[item.id] = await QRCode.toDataURL(item.id || item.sku || item.name, { width: 150, margin: 1 }); } catch { qrUrls[item.id] = ''; }
        }
      }
      setBarcodeDataUrls(bcUrls);
      setQrDataUrls(qrUrls);
      setGenerating(false);
    };
    generate();
  }, [open, mode, items]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open || items.length === 0) return null;

  const handlePrint = () => window.print();

  const printStyles = `
    @media print {
      body * { visibility: hidden; }
      #printable-labels, #printable-labels * { visibility: visible; }
      #printable-labels { position: absolute; left: 5mm; top: 5mm; width: 100%; display: flex; flex-wrap: wrap; gap: 4mm; }
      .print-label { break-inside: avoid; page-break-inside: avoid; border: 1px solid #ccc; }
      @page { margin: 5mm; size: auto; }
    }
  `;

  const renderBarcode = (item: Item) => {
    const url = barcodeDataUrls[item.id];
    if (!url) return null;
    return <img src={url} alt={`Barcode ${item.barcode}`} className="h-10 w-full object-contain" />;
  };

  const getLabelStyle = () => {
    if (mode === 'barcode' || mode === 'label') return { width: '50mm', height: '30mm' };
    return { width: '38mm', height: '38mm' };
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(22,32,27,.5)' }}>
      <div className="relative bg-white rounded-[16px] w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden" style={{ boxShadow: '0 1px 2px rgba(15,30,25,.04), 0 6px 18px rgba(15,30,25,.05)' }}>
        <style>{printStyles}</style>
        <div className="px-5 py-4 border-b border-[#E5E8E1] flex items-center justify-between shrink-0" style={{ background: '#fff' }}>
          <div className="flex items-center gap-3">
            <div className="w-[34px] h-[34px] rounded-[9px] flex items-center justify-center bg-[#DCF0EA]" style={{ color: '#128C72' }}>
              {mode === 'barcode' ? <Barcode size={18} /> : mode === 'qrcode' ? <QrCode size={18} /> : <Printer size={18} />}
            </div>
            <div>
              <h2 className="text-sm font-bold" style={{ color: '#16201B' }}>
                {mode === 'barcode' ? 'Print Barcodes' : mode === 'qrcode' ? 'Print QR Codes' : 'Print Labels'}
              </h2>
              <p className="text-xs" style={{ color: '#9CA59E' }}>{items.length} item{items.length !== 1 ? 's' : ''}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {[
              { key: 'name', label: 'Name', state: showName, set: setShowName },
              { key: 'sku', label: 'SKU', state: showSKU, set: setShowSKU },
              { key: 'price', label: 'Price', state: showPrice, set: setShowPrice },
            ].map(cfg => (
              <label key={cfg.key} className="flex items-center gap-1.5 text-xs font-medium cursor-pointer" style={{ color: '#3B453F' }}>
                <input type="checkbox" checked={cfg.state} onChange={e => cfg.set(e.target.checked)} style={{ accentColor: '#128C72' }} /> {cfg.label}
              </label>
            ))}
            <div className="w-px h-5" style={{ background: '#E5E8E1' }} />
            <button onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-[14px] py-[8.5px] rounded-[7px] text-xs font-medium transition-all cursor-pointer bg-[#128C72] text-white hover:bg-[#0E5C4C]">
              <Printer size={13} /> Print
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg transition-all cursor-pointer" style={{ color: '#9CA59E' }}>
              <X size={17} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6" style={{ background: '#F6F7F2' }}>
          {generating ? (
            <div className="flex items-center justify-center py-20"><Loader2 size={28} className="animate-spin" style={{ color: '#9CA59E' }} /></div>
          ) : (
            <div id="printable-labels" className="flex flex-wrap gap-4 justify-center">
              {items.map((item, idx) => (
                <div key={`${item.id}-${idx}`} className="bg-white border border-[#E5E8E1] rounded-lg flex flex-col items-center justify-center text-center p-3 shadow-sm print-label" style={getLabelStyle()}>
                  {mode === 'qrcode' && qrDataUrls[item.id] ? (
                    <img src={qrDataUrls[item.id]} alt={`QR for ${item.name}`} className="w-24 h-24" />
                  ) : mode === 'barcode' ? renderBarcode(item) : null}
                  {mode === 'label' && renderBarcode(item)}
                  {showName && <div className="text-[9px] font-bold leading-tight line-clamp-2 mt-1" style={{ color: '#16201B' }}>{item.name}</div>}
                  {showSKU && <div className="text-[7px] font-mono mt-0.5" style={{ color: '#9CA59E' }}>{item.sku}</div>}
                  {showPrice && <div className="text-[10px] font-bold mt-0.5" style={{ color: '#128C72' }}>{currency}{(item.sellingPrice || item.price || 0).toFixed(2)}</div>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  X, FileText, Loader2, AlertTriangle, RefreshCw, Download, Printer, Share2,
  ZoomIn, ZoomOut, Maximize2, FileDown, Maximize,
} from 'lucide-react';
import type { DocType, FilePreviewDescriptor } from '../../../../stores/documentStore';
import type { PrimeDocData } from './schemas';
import { attachDocumentSecurity } from '../../../../utils/documentSecurity';
import { getStoredCompanyConfig, initializePrimePdfFonts } from './templateSettings';
import { hydrateCompanyPdfAssets } from '../../../../utils/companyAssetUtils';
import { downloadPdfSource, getPdfErrorMessage, type PDFPreviewSource, resolvePdfFilePreviewSource } from './pdfPreviewUtils';
import { validateDocumentData } from './documentValidation';
import { getDeviceProfile } from '../../../../utils/documentPreview';
import { Z_LAYERS } from '../../../../constants/layers';

const ZOOM_PRESETS = [0.75, 1, 1.25, 1.5] as const;
const ZOOM_STEP = 0.1;
const MIN_ZOOM = 0.25;
const MAX_ZOOM = 3;

interface PreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  type?: DocType;
  data?: PrimeDocData | null;
  file?: FilePreviewDescriptor | null;
}

export const PreviewModal = ({ isOpen, onClose, type, data = null, file = null }: PreviewModalProps) => {
  const [preparing, setPreparing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pdfSource, setPdfSource] = useState<PDFPreviewSource | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const [genInfo, setGenInfo] = useState<string>('');
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [fitMode, setFitMode] = useState<'width' | 'page' | 'none'>('width');
  const containerRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const rid = useRef(0);
  const touchRef = useRef<{ start?: number; dist?: number }>({});

  const device = useMemo(() => getDeviceProfile(), []);
  const isMobile = device.isMobile;
  const isTablet = device.isTablet;
  const isTouch = isMobile || isTablet;

  const status = useMemo(() => {
    if (!data) return null;
    const raw = data as Record<string, unknown>;
    return (raw.status as string) || (raw.paymentStatus as string) || null;
  }, [data]);

  const statusColor = useMemo(() => {
    if (!status) return 'bg-slate-100 text-slate-600 border-slate-200';
    const s = status.toLowerCase();
    if (s === 'paid' || s === 'active' || s === 'completed') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    if (s === 'pending' || s === 'draft' || s === 'partial') return 'bg-amber-50 text-amber-700 border-amber-200';
    if (s === 'overdue' || s === 'cancelled' || s === 'void') return 'bg-red-50 text-red-700 border-red-200';
    return 'bg-slate-100 text-slate-600 border-slate-200';
  }, [status]);

  const invoiceNumber = useMemo(() => {
    if (!data) return '';
    const raw = data as Record<string, unknown>;
    return (raw.number as string) || (raw.invoiceNumber as string) || (raw.documentNumber as string) || '';
  }, [data]);

  const customerName = useMemo(() => {
    if (!data) return '';
    const raw = data as Record<string, unknown>;
    return (raw.clientName as string) || (raw.customerName as string) || (raw.billTo?.name as string) || '';
  }, [data]);

  const previewTitle = useMemo(() => {
    if (file?.title) return file.title;
    if (type === 'FISCAL_REPORT' && data && 'reportName' in data) return String((data as Record<string, unknown>).reportName);
    if (type === 'SUBSCRIPTION') return 'Recurring Invoice Preview';
    if (type === 'POS_RECEIPT') return 'POS Receipt Preview';
    if (type === 'INVOICE' || type === 'EXAMINATION_INVOICE') {
      return invoiceNumber ? `Invoice ${invoiceNumber}` : 'Invoice Preview';
    }
    return 'Document Preview';
  }, [data, file?.title, type, invoiceNumber]);

  const generate = useCallback(async (id: number) => {
    if (!data && !file) {
      if (id === rid.current) setError('No document data to preview');
      return;
    }

    try {
      if (file) {
        const src = await resolvePdfFilePreviewSource(file, abortRef.current?.signal);
        if (id !== rid.current) return;
        setPdfSource(src);
        return;
      }
      if (!data || !type) throw new Error('Missing document data or document type');

      const semanticCheck = validateDocumentData(type, data);
      if (!semanticCheck.valid) {
        setError(semanticCheck.error || 'Document data validation failed');
        setPreparing(false);
        return;
      }

      setGenInfo('Preparing assets...');
      const config = await hydrateCompanyPdfAssets(getStoredCompanyConfig());
      await initializePrimePdfFonts();
      setGenInfo('Securing document...');
      const secured = await attachDocumentSecurity(data);
      setGenInfo('Generating PDF...');
      const start = Date.now();
      const { generatePrimeDocumentBlob } = await import('./generatePrimeDocumentBlob');
      const blob = await generatePrimeDocumentBlob(type, secured as PrimeDocData, config);
      const ms = Date.now() - start;
      setGenInfo(`Generated in ${ms}ms`);
      if (id !== rid.current) return;

      setPdfSource(blob);
    } catch (err: any) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      if (id !== rid.current) return;
      setError(getPdfErrorMessage(err));
    } finally {
      if (id === rid.current) setPreparing(false);
    }
  }, [data, file, type]);

  useEffect(() => {
    if (!isOpen) {
      rid.current += 1; abortRef.current?.abort(); abortRef.current = null;
      setPdfSource(null); setError(null); setGenInfo('');
      setBlobUrl((prev) => { if (prev) URL.revokeObjectURL(prev); return null; });
      setZoom(1); setFitMode('width');
      return;
    }
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    rid.current += 1; const id = rid.current;
    setPreparing(true); setError(null); setPdfSource(null); setGenInfo('');
    setBlobUrl((prev) => { if (prev) URL.revokeObjectURL(prev); return null; });
    setZoom(1); setFitMode('width');
    const t = setTimeout(() => generate(id), 80);
    return () => { rid.current += 1; abortRef.current?.abort(); clearTimeout(t); };
  }, [isOpen, data, file, type, generate, retryKey]);

  useEffect(() => {
    if (pdfSource instanceof Blob && pdfSource.size > 0) {
      const url = URL.createObjectURL(pdfSource);
      setBlobUrl(url);
      return () => URL.revokeObjectURL(url);
    }
    if (pdfSource instanceof Uint8Array || pdfSource instanceof ArrayBuffer) {
      const blob = new Blob([pdfSource], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      setBlobUrl(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [pdfSource]);

  useEffect(() => {
    if (!isOpen) return;
    const down = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); }
      if ((e.ctrlKey || e.metaKey) && e.key === 'p') { e.preventDefault(); handlePrint(); }
      if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); handleDownload(); }
    };
    window.addEventListener('keydown', down);
    return () => window.removeEventListener('keydown', down);
  }, [isOpen, onClose, blobUrl]);

  useEffect(() => {
    if (!isOpen || !previewRef.current) return;
    const el = previewRef.current;
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
        setZoom((z) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z + delta)));
        setFitMode('none');
      }
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [isOpen]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      touchRef.current = { dist };
    }
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2 && touchRef.current.dist) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const delta = (dist - touchRef.current.dist) * 0.01;
      setZoom((z) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z + delta)));
      setFitMode('none');
      touchRef.current.dist = dist;
    }
  }, []);

  const handleZoomIn = useCallback(() => {
    setZoom((z) => { const n = Math.min(MAX_ZOOM, z + ZOOM_STEP); setFitMode('none'); return n; });
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoom((z) => { const n = Math.max(MIN_ZOOM, z - ZOOM_STEP); setFitMode('none'); return n; });
  }, []);

  const handleFitWidth = useCallback(() => {
    setFitMode('width');
    if (containerRef.current && previewRef.current) {
      const cw = containerRef.current.clientWidth - 48;
      const iframe = previewRef.current.querySelector('iframe');
      if (iframe) {
        const natural = iframe.scrollWidth || 794;
        const scale = Math.max(0.25, cw / natural);
        setZoom(parseFloat(scale.toFixed(2)));
      }
    }
  }, []);

  const handleFitPage = useCallback(() => {
    setFitMode('page');
    if (containerRef.current && previewRef.current) {
      const cw = containerRef.current.clientWidth - 48;
      const ch = containerRef.current.clientHeight - 48;
      const naturalW = 794;
      const naturalH = 1123;
      const scaleW = cw / naturalW;
      const scaleH = ch / naturalH;
      const scale = Math.min(scaleW, scaleH);
      setZoom(parseFloat(Math.max(0.25, scale).toFixed(2)));
    }
  }, []);

  const handleRetry = useCallback(() => {
    setError(null); setPreparing(true); setRetryKey((k) => k + 1);
  }, []);

  const handleDownload = useCallback(() => {
    if (pdfSource) downloadPdfSource(pdfSource, previewTitle).catch((e) => setError(getPdfErrorMessage(e)));
  }, [pdfSource, previewTitle]);

  const handlePrint = useCallback(() => {
    if (blobUrl) {
      const w = window.open(blobUrl, '_blank');
      if (w) {
        w.onload = () => { w.print(); };
      } else {
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = `${previewTitle.replace(/[^a-z0-9]+/gi, '_')}.pdf`;
        a.target = '_blank';
        a.click();
      }
    }
  }, [blobUrl, previewTitle]);

  const handleShare = useCallback(async () => {
    if (!pdfSource) return;
    try {
      const blob = pdfSource instanceof Blob
        ? pdfSource
        : new Blob([pdfSource], { type: 'application/pdf' });
      if (navigator.share) {
        await navigator.share({
          title: previewTitle,
          files: [new File([blob], `${previewTitle.replace(/[^a-z0-9]+/gi, '_')}.pdf`, { type: 'application/pdf' })],
        });
      } else {
        await navigator.clipboard.writeText(window.location.href);
      }
    } catch { /* user cancelled */ }
  }, [pdfSource, previewTitle]);

  const zoomPercent = useMemo(() => Math.round(zoom * 100), [zoom]);

  if (!isOpen) return null;

  const hasContent = !!blobUrl;

  return createPortal(
    <div className="fixed inset-0 flex flex-col bg-[#f3f0ea] dark:bg-slate-900 animate-in fade-in duration-200" style={{ zIndex: Z_LAYERS.GLOBAL_PREVIEW }}>
      {/* Top Navigation */}
      <header className="flex shrink-0 items-center justify-between border-b border-[#d7d1c7] dark:border-slate-700 bg-white dark:bg-slate-800 px-3 sm:px-5 py-2 sm:py-3 shadow-sm">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            title="Close (Esc)"
          >
            <X className="h-4 w-4" />
            <span className="hidden sm:inline">Back</span>
          </button>
          <div className="flex items-center gap-2 shrink-0">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600 text-white shadow-sm">
              <FileText className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-sm font-bold text-slate-800 dark:text-slate-100">{previewTitle}</h2>
            <div className="flex items-center gap-2 text-[10px] text-slate-400 dark:text-slate-500">
              {invoiceNumber && <span className="truncate">{invoiceNumber}</span>}
              {customerName && (
                <>
                  <span className="text-slate-300">|</span>
                  <span className="truncate">{customerName}</span>
                </>
              )}
            </div>
          </div>
          {status && (
            <span className={`hidden sm:inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold border ${statusColor}`}>
              {status}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {(genInfo || preparing) && !hasContent && (
            <span className="hidden sm:inline text-[10px] text-slate-400">{genInfo || 'Initializing...'}</span>
          )}
        </div>
      </header>

      {/* Sticky Action Bar */}
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-[#d7d1c7] dark:border-slate-700 bg-white/95 dark:bg-slate-800/95 backdrop-blur px-3 sm:px-5 py-2 shadow-sm z-10">
        <div className="flex items-center gap-1.5 sm:gap-2">
          {hasContent && (
            <>
              <button
                onClick={handleDownload}
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-[11px] font-bold text-white transition-all hover:bg-blue-700 active:scale-95 shadow-sm"
                title="Download PDF (Ctrl+S)"
              >
                <FileDown className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Download</span>
              </button>
              <button
                onClick={handlePrint}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-1.5 text-[11px] font-semibold text-slate-700 dark:text-slate-200 transition-all hover:bg-slate-50 dark:hover:bg-slate-600 active:scale-95"
                title="Print (Ctrl+P)"
              >
                <Printer className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Print</span>
              </button>
              <button
                onClick={handleShare}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-1.5 text-[11px] font-semibold text-slate-700 dark:text-slate-200 transition-all hover:bg-slate-50 dark:hover:bg-slate-600 active:scale-95"
                title="Share"
              >
                <Share2 className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Share</span>
              </button>
            </>
          )}
        </div>
        {hasContent && (
          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              onClick={onClose}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-1.5 text-[11px] font-semibold text-slate-600 dark:text-slate-300 transition-all hover:bg-slate-50 dark:hover:bg-slate-600 active:scale-95"
            >
              <X className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Close</span>
            </button>
          </div>
        )}
      </div>

      {/* Body */}
      <div ref={containerRef} className="flex flex-1 flex-col overflow-hidden bg-[#e8e4de] dark:bg-slate-950">
        {preparing && !hasContent ? (
          /* Loading skeleton */
          <div className="flex h-full items-center justify-center p-4 sm:p-8">
            <div className="w-full max-w-lg text-center">
              <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-white dark:bg-slate-800 shadow-lg animate-pulse">
                <FileText className="h-7 w-7 text-blue-600" />
              </div>
              <div className="mx-auto h-3 w-48 rounded-full bg-slate-200 dark:bg-slate-700 animate-pulse mb-3" />
              <div className="mx-auto h-2 w-32 rounded-full bg-slate-100 dark:bg-slate-800 animate-pulse mb-6" />
              <div className="mx-auto flex items-center justify-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>{genInfo || 'Preparing document...'}</span>
              </div>
              <div className="mt-8 grid grid-cols-3 gap-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-48 rounded-xl bg-white/60 dark:bg-slate-800/60 animate-pulse shadow-sm" />
                ))}
              </div>
            </div>
          </div>
        ) : error ? (
          /* Error state */
          <div className="flex h-full items-center justify-center p-4 sm:p-6 md:p-8">
            <div className="w-full max-w-md rounded-2xl border border-red-200 dark:border-red-900 bg-white dark:bg-slate-800 p-6 sm:p-8 shadow-lg text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 dark:bg-red-900/30 text-red-500 mb-4">
                <AlertTriangle className="h-7 w-7" />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-2">Preview Failed</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">{error}</p>
              <div className="flex flex-wrap justify-center gap-3">
                <button
                  onClick={handleRetry}
                  className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white transition-all hover:bg-blue-700 active:scale-95 shadow-sm"
                >
                  <RefreshCw className="h-4 w-4" /> Try Again
                </button>
                <button
                  onClick={onClose}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-5 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-200 transition-all hover:bg-slate-50 dark:hover:bg-slate-600 active:scale-95"
                >
                  <X className="h-4 w-4" /> Close
                </button>
              </div>
            </div>
          </div>
        ) : blobUrl ? (
          /* PDF Preview */
          <div className="flex flex-1 flex-col overflow-hidden">
            <div
              ref={previewRef}
              className="flex flex-1 items-start justify-center overflow-auto p-4 sm:p-6 md:p-8"
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
            >
              <div
                className="shadow-2xl rounded-lg overflow-hidden bg-white transition-transform duration-75 ease-out"
                style={{
                  transform: `scale(${zoom})`,
                  transformOrigin: 'top center',
                  width: isTouch ? '100%' : '794px',
                  maxWidth: '100%',
                }}
              >
                <iframe
                  src={blobUrl}
                  className="border-none bg-white"
                  style={{
                    width: '794px',
                    height: '1123px',
                    maxWidth: '100%',
                  }}
                  title={previewTitle}
                />
              </div>
            </div>
          </div>
        ) : (
          /* No document */
          <div className="flex h-full items-center justify-center text-slate-400">
            <div className="text-center">
              <FileText className="mx-auto h-12 w-12 opacity-30" />
              <p className="mt-3 text-sm font-medium">No document to preview</p>
            </div>
          </div>
        )}
      </div>

      {/* Footer - Zoom Controls */}
      {hasContent && (
        <footer className="flex shrink-0 items-center justify-between gap-2 border-t border-[#d7d1c7] dark:border-slate-700 bg-white dark:bg-slate-800 px-3 sm:px-5 py-2 shadow-sm">
          <div className="flex items-center gap-1 sm:gap-2">
            <button
              onClick={handleZoomOut}
              disabled={zoom <= MIN_ZOOM}
              className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 transition-colors"
              title="Zoom Out"
            >
              <ZoomOut className="h-4 w-4" />
            </button>

            <div className="flex items-center rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-[11px] font-semibold text-slate-700 dark:text-slate-200">
              {ZOOM_PRESETS.map((pct) => (
                <button
                  key={pct}
                  onClick={() => { setZoom(pct); setFitMode('none'); }}
                  className={`px-2 py-1 transition-colors hover:bg-slate-100 dark:hover:bg-slate-600 first:rounded-l-lg last:rounded-r-lg ${
                    zoom === pct && fitMode === 'none' ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' : ''
                  }`}
                >
                  {Math.round(pct * 100)}%
                </button>
              ))}
            </div>

            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 min-w-[3rem] text-center">
              {zoomPercent}%
            </span>

            <button
              onClick={handleZoomIn}
              disabled={zoom >= MAX_ZOOM}
              className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 transition-colors"
              title="Zoom In"
            >
              <ZoomIn className="h-4 w-4" />
            </button>

            <div className="w-px h-5 bg-slate-200 dark:bg-slate-600 mx-1 hidden sm:block" />

            <button
              onClick={handleFitWidth}
              className={`rounded-lg p-1.5 transition-colors ${
                fitMode === 'width' ? 'text-blue-600 bg-blue-50 dark:bg-blue-900/30' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700'
              }`}
              title="Fit Width"
            >
              <Maximize className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={handleFitPage}
              className={`rounded-lg p-1.5 transition-colors ${
                fitMode === 'page' ? 'text-blue-600 bg-blue-50 dark:bg-blue-900/30' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700'
              }`}
              title="Fit Page"
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="flex items-center gap-2 text-[10px] text-slate-400 dark:text-slate-500">
            <span className="hidden sm:inline">Ctrl+Scroll to zoom</span>
            {isTouch && <span className="hidden sm:inline">Pinch to zoom</span>}
          </div>
        </footer>
      )}
    </div>,
    document.body,
  );
};

export default PreviewModal;

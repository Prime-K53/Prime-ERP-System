import React from 'react';
import { Z_LAYERS } from '../constants/layers';

type Props = {
  open: boolean;
  onClose: () => void;
  title?: string;
  content?: React.ReactNode;
}

const Z = Z_LAYERS.DOCUMENT_PREVIEW;

const DocumentPreviewModal: React.FC<Props> = ({ open, onClose, title = 'Document Preview', content }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 backdrop-blur-sm" style={{ zIndex: Z }}>
      <div className="bg-white rounded-[1.25rem] shadow-2xl w-full max-w-3xl overflow-hidden animate-fadeIn">
        <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
          <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">Close</button>
        </div>
        <div className="p-6 max-h-[70vh] overflow-y-auto">
          {content ?? (
            <div className="text-slate-500">No content</div>
          )}
        </div>
      </div>
    </div>
  );
}

export default DocumentPreviewModal;

import React, { useRef } from 'react';
import type { ItemFormData } from '../types/itemFormTypes';

interface Props {
  data: ItemFormData;
  onChange: <K extends keyof ItemFormData>(key: K, value: ItemFormData[K]) => void;
}

export const AttachmentsSection: React.FC<Props> = ({ data, onChange }) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const attachments = data.attachments || [];

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Convert to base64 for storage; in production use a file upload service
    const b64 = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.readAsDataURL(file);
    });
    onChange('attachments', [
      ...attachments,
      { name: file.name, url: b64, type: file.type, size: file.size },
    ]);
    if (fileRef.current) fileRef.current.value = '';
  };

  const remove = (idx: number) => {
    onChange('attachments', attachments.filter((_: any, i: number) => i !== idx));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-slate-900">Attachments</h3>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="px-3 py-1.5 text-xs font-bold bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all"
        >
          + Upload
        </button>
      </div>
      <input ref={fileRef} type="file" className="hidden" onChange={handleFile} />

      {attachments.length === 0 && (
        <p className="text-sm text-slate-400 italic py-8 text-center">No attachments</p>
      )}

      <div className="space-y-2">
        {attachments.map((a: any, idx: number) => (
          <div key={idx} className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2">
            <div className="flex items-center gap-2 text-sm text-slate-600 truncate">
              <svg className="w-4 h-4 text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span className="truncate">{a.name}</span>
              <span className="text-xs text-slate-400">({(a.size / 1024).toFixed(0)} KB)</span>
            </div>
            <button
              type="button"
              onClick={() => remove(idx)}
              className="text-red-400 hover:text-red-600 text-xs font-bold ml-2"
            >
              Remove
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

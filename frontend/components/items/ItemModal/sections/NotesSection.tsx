import React from 'react';
import type { ItemFormData } from '../types/itemFormTypes';

interface Props {
  data: ItemFormData;
  onChange: <K extends keyof ItemFormData>(key: K, value: ItemFormData[K]) => void;
}

export const NotesSection: React.FC<Props> = ({ data, onChange }) => {
  const notes = data.notes || [];
  const addNote = () => {
    const ts = new Date().toISOString();
    onChange('notes', [...notes, { id: Date.now().toString(), content: '', createdAt: ts, updatedAt: ts }]);
  };
  const updateNote = (idx: number, content: string) => {
    const updated = notes.map((n: any, i: number) =>
      i === idx ? { ...n, content, updatedAt: new Date().toISOString() } : n,
    );
    onChange('notes', updated);
  };
  const removeNote = (idx: number) => {
    onChange('notes', notes.filter((_: any, i: number) => i !== idx));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-slate-900">Notes</h3>
        <button
          type="button"
          onClick={addNote}
          className="px-3 py-1.5 text-xs font-bold bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all"
        >
          + Add Note
        </button>
      </div>

      {notes.length === 0 && (
        <p className="text-sm text-slate-400 italic py-8 text-center">No notes</p>
      )}

      <div className="space-y-3">
        {notes.map((n: any, idx: number) => (
          <div key={n.id || idx} className="border border-slate-200 rounded-xl p-3 bg-white">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-slate-400">
                {n.createdAt ? new Date(n.createdAt).toLocaleString() : 'New'}
              </span>
              <button
                type="button"
                onClick={() => removeNote(idx)}
                className="text-red-400 hover:text-red-600 text-xs font-bold"
              >
                Remove
              </button>
            </div>
            <textarea
              value={n.content}
              onChange={e => updateNote(idx, e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-blue-500 transition-all resize-none"
              placeholder="Type your note..."
            />
          </div>
        ))}
      </div>
    </div>
  );
};

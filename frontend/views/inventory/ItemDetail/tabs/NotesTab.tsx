import React, { useState } from 'react';
import { MessageSquare, Plus, Trash2, Send, User, Clock } from 'lucide-react';

interface Props {
  item: any;
}

interface Note {
  id: string;
  text: string;
  author: string;
  createdAt: string;
}

export const NotesTab: React.FC<Props> = ({ item }) => {
  const [notes, setNotes] = useState<Note[]>(item.notes || []);
  const [newNote, setNewNote] = useState('');

  const handleAdd = () => {
    if (!newNote.trim()) return;
    const note: Note = {
      id: Date.now().toString(),
      text: newNote.trim(),
      author: 'Current User',
      createdAt: new Date().toISOString(),
    };
    setNotes(prev => [note, ...prev]);
    setNewNote('');
  };

  const handleDelete = (id: string) => {
    setNotes(prev => prev.filter(n => n.id !== id));
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
        <div className="flex gap-3">
          <div className="flex-1">
            <textarea
              value={newNote}
              onChange={e => setNewNote(e.target.value)}
              placeholder="Add a note about this item..."
              rows={3}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
            />
          </div>
          <button onClick={handleAdd}
            className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-semibold hover:bg-blue-700 shadow-sm transition-all inline-flex items-center gap-1.5 h-fit">
            <Send size={14} /> Add
          </button>
        </div>
      </div>

      {notes.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-slate-400">
          <MessageSquare size={48} className="mb-4 opacity-50" />
          <p className="text-sm font-semibold">No Notes</p>
          <p className="text-xs mt-1">No internal notes have been added for this item.</p>
        </div>
      )}

      <div className="space-y-3">
        {notes.map((note) => (
          <div key={note.id} className="bg-white rounded-xl border border-slate-200 p-4 hover:shadow-sm transition-all">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{note.text}</p>
                <div className="flex items-center gap-3 mt-2 text-[10px] text-slate-400">
                  <span className="flex items-center gap-1"><User size={10} /> {note.author}</span>
                  <span className="flex items-center gap-1"><Clock size={10} /> {new Date(note.createdAt).toLocaleString()}</span>
                </div>
              </div>
              <button onClick={() => handleDelete(note.id)}
                className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all flex-shrink-0">
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

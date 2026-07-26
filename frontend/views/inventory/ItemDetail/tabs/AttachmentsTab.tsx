import React from 'react';
import { Paperclip, File, FileImage, FileText, Download, Eye } from 'lucide-react';

interface Props {
  item: any;
}

const getFileIcon = (mime?: string) => {
  if (!mime) return <File size={20} className="text-slate-400" />;
  if (mime.startsWith('image/')) return <FileImage size={20} className="text-violet-500" />;
  if (mime.includes('pdf')) return <FileText size={20} className="text-red-500" />;
  return <File size={20} className="text-blue-500" />;
};

export const AttachmentsTab: React.FC<Props> = ({ item }) => {
  const attachments: { id?: string; name?: string; url?: string; type?: string; size?: number; uploadedAt?: string }[] = item.attachments || [];

  if (attachments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-slate-400">
        <Paperclip size={48} className="mb-4 opacity-50" />
        <p className="text-sm font-semibold">No Attachments</p>
        <p className="text-xs mt-1">No files have been attached to this item.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {attachments.map((att, i) => (
          <div key={att.id || i} className="bg-white rounded-xl border border-slate-200 p-4 hover:shadow-sm transition-all shadow-sm">
            <div className="flex items-start gap-3">
              <div className="p-2.5 bg-slate-50 rounded-xl">{getFileIcon(att.type)}</div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-800 truncate">{att.name || `Attachment ${i + 1}`}</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {att.type || 'Unknown type'}
                  {att.size ? ` · ${(att.size / 1024).toFixed(1)} KB` : ''}
                  {att.uploadedAt ? ` · ${new Date(att.uploadedAt).toLocaleDateString()}` : ''}
                </p>
              </div>
            </div>
            {att.url && (
              <div className="flex gap-2 mt-3 pt-3 border-t border-slate-100">
                <a href={att.url} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-xs font-semibold hover:bg-blue-100 transition-all">
                  <Eye size={12} /> View
                </a>
                <a href={att.url} download
                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-50 text-slate-600 rounded-lg text-xs font-semibold hover:bg-slate-100 transition-all">
                  <Download size={12} /> Download
                </a>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};


import React from 'react';
import { X, FileText, Image, Film, Music, Box, Lock } from 'lucide-react';
import { EXTENSION_ENCRYPTED } from '../constants';

interface FileListProps {
  files: File[];
  onRemove: (index: number) => void;
  disabled: boolean; // Disables remove buttons during processing
}

/**
 * FILE LIST COMPONENT
 * Renders a visual queue of files waiting to be processed.
 * Includes icons based on file type and a remove button.
 */
export const FileList: React.FC<FileListProps> = ({ files, onRemove, disabled }) => {
  
  // Format bytes to human readable string (KB, MB, GB)
  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  // Determine Icon based on extension
  const getFileIcon = (filename: string) => {
    if (filename.endsWith(EXTENSION_ENCRYPTED)) return <Lock className="w-5 h-5 text-emerald-400" />;
    const ext = filename.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'png': case 'jpg': case 'jpeg': case 'gif': return <Image className="w-5 h-5 text-purple-400" />;
      case 'mp4': case 'mov': case 'avi': return <Film className="w-5 h-5 text-rose-400" />;
      case 'mp3': case 'wav': return <Music className="w-5 h-5 text-amber-400" />;
      case 'zip': case 'rar': case '7z': return <Box className="w-5 h-5 text-orange-400" />;
      default: return <FileText className="w-5 h-5 text-blue-400" />;
    }
  };

  return (
    <div className="flex-1 overflow-y-auto pr-2 scrollbar-thin space-y-2 max-h-[400px]">
      {files.map((file, idx) => (
        <div 
          key={`${file.name}-${idx}`}
          className="group flex items-center justify-between p-3 bg-slate-900/40 border border-slate-800 hover:border-slate-600 rounded-xl transition-all hover:bg-slate-800/40 animate-in fade-in slide-in-from-bottom-2 duration-300"
          style={{ animationDelay: `${idx * 50}ms` }}
        >
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="p-2 bg-slate-900 rounded-lg group-hover:bg-slate-950 transition-colors">
              {getFileIcon(file.name)}
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-medium text-slate-200 truncate pr-2 group-hover:text-white transition-colors">
                {file.name}
              </span>
              <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wide">
                {formatSize(file.size)}
              </span>
            </div>
          </div>
          
          <button
            onClick={(e) => { e.stopPropagation(); onRemove(idx); }}
            disabled={disabled}
            className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-all opacity-0 group-hover:opacity-100 focus:opacity-100 disabled:opacity-0"
            title="Remove from queue"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
};
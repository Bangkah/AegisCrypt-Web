import React, { useEffect, useRef } from 'react';
import { LogEntry, LogLevel } from '../types';
import { Terminal, XCircle, CheckCircle, Info, AlertTriangle } from 'lucide-react';

interface LogBoxProps {
  logs: LogEntry[];
  onClear: () => void;
}

export const LogBox: React.FC<LogBoxProps> = ({ logs, onClear }) => {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const getIcon = (level: LogLevel) => {
    switch (level) {
      case LogLevel.SUCCESS: return <CheckCircle className="w-4 h-4 text-emerald-500" />;
      case LogLevel.ERROR: return <XCircle className="w-4 h-4 text-rose-500" />;
      case LogLevel.WARNING: return <AlertTriangle className="w-4 h-4 text-amber-500" />;
      default: return <Info className="w-4 h-4 text-sky-500" />;
    }
  };

  const getColor = (level: LogLevel) => {
    switch (level) {
      case LogLevel.SUCCESS: return 'text-emerald-400';
      case LogLevel.ERROR: return 'text-rose-400';
      case LogLevel.WARNING: return 'text-amber-400';
      default: return 'text-slate-300';
    }
  };

  return (
    <div className="flex flex-col h-64 bg-slate-900 border border-slate-700 rounded-lg overflow-hidden shadow-inner">
      <div className="flex items-center justify-between px-4 py-2 bg-slate-800 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-slate-400" />
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Operation Log</span>
        </div>
        <button 
          onClick={onClear}
          className="text-xs text-slate-500 hover:text-slate-200 transition-colors"
        >
          Clear
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-2 scrollbar-thin font-mono text-sm">
        {logs.length === 0 ? (
          <p className="text-slate-600 italic">Ready for operations...</p>
        ) : (
          logs.map((log) => (
            <div key={log.id} className="flex items-start gap-3 animate-in fade-in slide-in-from-bottom-1 duration-200">
              <span className="text-slate-600 text-xs mt-0.5 min-w-[60px]">{log.timestamp}</span>
              <div className="mt-0.5">{getIcon(log.level)}</div>
              <span className={`break-all ${getColor(log.level)}`}>{log.message}</span>
            </div>
          ))
        )}
        <div ref={endRef} />
      </div>
    </div>
  );
};

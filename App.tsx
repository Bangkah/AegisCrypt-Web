import React, { useState, useCallback, useRef } from 'react';
import { 
  Shield, FileUp, Download, RefreshCw, 
  Trash2, FileLock, FileCheck, FolderOpen,
  History
} from 'lucide-react';
import { LogEntry, LogLevel, ProcessedFileHistory } from './types';
import { PasswordInput } from './components/PasswordInput';
import { LogBox } from './components/LogBox';
import { 
  encryptFileContent, 
  decryptFileContent, 
  downloadBlob, 
  getEncryptedFilename, 
  getDecryptedFilename 
} from './services/cryptoService';
import { EXTENSION_ENCRYPTED } from './constants';

export default function App() {
  const [password, setPassword] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [history, setHistory] = useState<ProcessedFileHistory[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const addLog = useCallback((message: string, level: LogLevel = LogLevel.INFO) => {
    const entry: LogEntry = {
      id: crypto.randomUUID(),
      timestamp: new Date().toLocaleTimeString(),
      message,
      level
    };
    setLogs(prev => [...prev, entry]);
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const filesArray = Array.from(e.target.files);
      setSelectedFiles(filesArray);
      addLog(`Selected ${filesArray.length} file(s) for processing.`, LogLevel.INFO);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const filesArray = Array.from(e.dataTransfer.files);
      setSelectedFiles(filesArray);
      addLog(`Dropped ${filesArray.length} file(s).`, LogLevel.INFO);
    }
  };

  const processFiles = async (mode: 'ENCRYPT' | 'DECRYPT') => {
    if (selectedFiles.length === 0) {
      addLog('No files selected.', LogLevel.WARNING);
      return;
    }
    if (password.length < 8) {
      addLog('Password must be at least 8 characters long.', LogLevel.ERROR);
      return;
    }

    setIsProcessing(true);
    setProgress(0);
    addLog(`Starting ${mode} process using AES-256-GCM...`, LogLevel.INFO);

    const totalFiles = selectedFiles.length;
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < totalFiles; i++) {
      const file = selectedFiles[i];
      const currentProgress = Math.round(((i) / totalFiles) * 100);
      setProgress(currentProgress);

      try {
        addLog(`Processing: ${file.name}...`, LogLevel.INFO);
        const arrayBuffer = await file.arrayBuffer();
        let resultBuffer: ArrayBuffer;
        let outputName: string;

        if (mode === 'ENCRYPT') {
          resultBuffer = await encryptFileContent(arrayBuffer, password);
          outputName = getEncryptedFilename(file.name);
        } else {
          // Decrypt
          if (!file.name.endsWith(EXTENSION_ENCRYPTED)) {
             addLog(`Note: File ${file.name} does not have ${EXTENSION_ENCRYPTED} extension. Checking magic bytes...`, LogLevel.WARNING);
          }
          resultBuffer = await decryptFileContent(arrayBuffer, password);
          outputName = getDecryptedFilename(file.name);
        }

        downloadBlob(resultBuffer, outputName);
        addLog(`${mode} Success: ${outputName}`, LogLevel.SUCCESS);
        successCount++;
        
        // Add to history
        setHistory(prev => [{
          id: crypto.randomUUID(),
          fileName: outputName,
          operation: mode,
          timestamp: new Date(),
          status: 'SUCCESS'
        }, ...prev.slice(0, 9)]); // Keep last 10

      } catch (err: any) {
        failCount++;
        addLog(`Failed to ${mode.toLowerCase()} ${file.name}: ${err.message}`, LogLevel.ERROR);
      }
    }

    setProgress(100);
    setIsProcessing(false);
    
    if (failCount === 0) {
      addLog(`All operations completed successfully.`, LogLevel.SUCCESS);
    } else {
      addLog(`Operation completed with ${failCount} errors.`, LogLevel.WARNING);
    }
    
    // Clear selection after success
    if (successCount === totalFiles) {
      setTimeout(() => setSelectedFiles([]), 1500);
    }
  };

  return (
    <div className="flex h-full flex-col md:flex-row">
      {/* Sidebar / History */}
      <aside className="w-full md:w-80 bg-slate-900 border-r border-slate-800 p-6 flex flex-col gap-6">
        <div className="flex items-center gap-3 text-emerald-400">
          <Shield className="w-8 h-8" />
          <div>
            <h1 className="font-bold text-xl text-slate-100 tracking-tight">AegisCrypt</h1>
            <p className="text-xs text-slate-500">Official .aegis format</p>
          </div>
        </div>

        <div className="flex-1 overflow-hidden flex flex-col">
          <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
            <History className="w-4 h-4" /> Recent Activity
          </h2>
          <div className="space-y-3 overflow-y-auto scrollbar-thin flex-1 pr-2">
            {history.length === 0 ? (
              <div className="text-slate-600 text-sm italic text-center py-10">No recent history</div>
            ) : (
              history.map(item => (
                <div key={item.id} className="bg-slate-800/50 rounded p-3 border border-slate-700/50">
                  <div className="flex justify-between items-start mb-1">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                      item.operation === 'ENCRYPT' ? 'bg-blue-500/10 text-blue-400' : 'bg-purple-500/10 text-purple-400'
                    }`}>
                      {item.operation}
                    </span>
                    <span className="text-[10px] text-slate-500">{item.timestamp.toLocaleTimeString()}</span>
                  </div>
                  <div className="text-sm text-slate-300 truncate font-mono" title={item.fileName}>
                    {item.fileName}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 bg-slate-950 p-6 md:p-12 overflow-y-auto scrollbar-thin">
        <div className="max-w-4xl mx-auto space-y-8">
          
          {/* Header */}
          <div className="flex justify-between items-end border-b border-slate-800 pb-6">
            <div>
              <h2 className="text-2xl font-semibold text-slate-100">Encryption Suite</h2>
              <p className="text-slate-400 mt-1">Secure your files locally using standard <span className="text-emerald-400 font-mono">.aegis</span> format.</p>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={() => {
                   setLogs([]); 
                   setHistory([]); 
                   setSelectedFiles([]); 
                   setPassword(''); 
                   setProgress(0);
                }}
                className="text-slate-500 hover:text-rose-400 transition-colors flex items-center gap-1 text-sm"
              >
                <Trash2 className="w-4 h-4" /> Reset
              </button>
            </div>
          </div>

          {/* Config Area */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-6">
              <PasswordInput 
                value={password} 
                onChange={setPassword} 
                disabled={isProcessing} 
              />
              
              {/* Drag Drop Area */}
              <div 
                className={`border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer ${
                  selectedFiles.length > 0 
                    ? 'border-emerald-500/50 bg-emerald-500/5' 
                    : 'border-slate-700 hover:border-slate-500 hover:bg-slate-900'
                }`}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileSelect} 
                  className="hidden" 
                  multiple 
                />
                
                {selectedFiles.length > 0 ? (
                  <div className="space-y-2">
                    <FileCheck className="w-10 h-10 text-emerald-500 mx-auto" />
                    <p className="text-slate-200 font-medium">{selectedFiles.length} File(s) Selected</p>
                    <p className="text-xs text-slate-500">Click to change selection</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <FileUp className="w-10 h-10 text-slate-500 mx-auto" />
                    <p className="text-slate-300 font-medium">Drag & Drop files or click to browse</p>
                    <p className="text-xs text-slate-500">Supports single files or bulk selection</p>
                  </div>
                )}
              </div>

               {/* Folder Button (Using Directory Attribute trick) */}
               <div className="flex gap-2 justify-center">
                  <p className="text-xs text-slate-600 self-center">Or select folder:</p>
                  <button 
                    onClick={() => folderInputRef.current?.click()}
                    className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded text-xs text-slate-300 transition-colors"
                  >
                    <FolderOpen className="w-3 h-3" /> Browse Folder
                  </button>
                  <input
                    type="file"
                    ref={folderInputRef}
                    onChange={handleFileSelect}
                    className="hidden"
                    // @ts-ignore - Standard browser feature but not in standard TS defs
                    webkitdirectory=""
                    directory=""
                  />
               </div>
            </div>

            {/* Actions & Status */}
            <div className="flex flex-col gap-6">
               <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={() => processFiles('ENCRYPT')}
                    disabled={isProcessing || !password || selectedFiles.length === 0}
                    className="group relative flex flex-col items-center justify-center gap-3 p-6 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:cursor-not-allowed rounded-xl transition-all shadow-lg hover:shadow-blue-500/20"
                  >
                    <FileLock className="w-8 h-8 text-blue-100 group-hover:scale-110 transition-transform" />
                    <span className="font-bold text-blue-50">Encrypt Files</span>
                  </button>

                  <button
                    onClick={() => processFiles('DECRYPT')}
                    disabled={isProcessing || !password || selectedFiles.length === 0}
                    className="group relative flex flex-col items-center justify-center gap-3 p-6 bg-purple-600 hover:bg-purple-500 disabled:bg-slate-800 disabled:cursor-not-allowed rounded-xl transition-all shadow-lg hover:shadow-purple-500/20"
                  >
                    <Download className="w-8 h-8 text-purple-100 group-hover:scale-110 transition-transform" />
                    <span className="font-bold text-purple-50">Decrypt Files</span>
                  </button>
               </div>

               {/* Progress Bar */}
               <div className="bg-slate-900 rounded-lg p-5 border border-slate-800">
                  <div className="flex justify-between text-xs mb-2">
                    <span className="text-slate-400">Status</span>
                    <span className={isProcessing ? "text-blue-400 animate-pulse" : "text-slate-500"}>
                      {isProcessing ? 'Processing...' : 'Idle'}
                    </span>
                  </div>
                  <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <div className="flex justify-end mt-1">
                    <span className="text-xs text-slate-500">{progress}%</span>
                  </div>
               </div>
            </div>
          </div>

          {/* Logs */}
          <LogBox logs={logs} onClear={() => setLogs([])} />

          {/* Footer Info */}
          <div className="text-center pt-8 border-t border-slate-800">
             <div className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900/50 rounded-full border border-slate-800">
                <RefreshCw className="w-3 h-3 text-emerald-500" />
                <span className="text-[10px] text-slate-400">
                   <strong>AES-256-GCM</strong> (128-bit Tag) • <strong>PBKDF2</strong> (100k iters, SHA-256) • <strong>.aegis v1</strong>
                </span>
             </div>
          </div>
        </div>
      </main>
    </div>
  );
}
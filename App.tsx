
import React, { useState, useCallback, useRef } from 'react';
import { 
  Shield, FileUp, Download, RefreshCw, 
  Trash2, FileLock, FileCheck, FolderOpen,
  History, Key, Terminal
} from 'lucide-react';
import { LogEntry, LogLevel, ProcessedFileHistory } from './types';
import { PasswordInput } from './components/PasswordInput';
import { LogBox } from './components/LogBox';
import { 
  processFileEncrypt, 
  processFileDecrypt, 
  downloadBlob, 
  getEncryptedFilename, 
  getDecryptedFilename 
} from './services/cryptoService';
import { EXTENSION_ENCRYPTED } from './constants';

export default function App() {
  const [password, setPassword] = useState('');
  const [keyFile, setKeyFile] = useState<File | null>(null);
  const [useKeyFile, setUseKeyFile] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [history, setHistory] = useState<ProcessedFileHistory[]>([]);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const keyFileInputRef = useRef<HTMLInputElement>(null);

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

  const handleKeyFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setKeyFile(e.target.files[0]);
      addLog(`Keyfile selected: ${e.target.files[0].name}`, LogLevel.SUCCESS);
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
    if (useKeyFile && !keyFile) {
      addLog('Keyfile enabled but no file selected.', LogLevel.ERROR);
      return;
    }

    setIsProcessing(true);
    setProgress(0);
    addLog(`Starting ${mode} (Stream Mode v2)...`, LogLevel.INFO);

    let keyFileBuffer: ArrayBuffer | null = null;
    if (useKeyFile && keyFile) {
       try {
         keyFileBuffer = await keyFile.arrayBuffer();
       } catch (err) {
         addLog('Failed to read Keyfile.', LogLevel.ERROR);
         setIsProcessing(false);
         return;
       }
    }

    const totalFiles = selectedFiles.length;
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < totalFiles; i++) {
      const file = selectedFiles[i];
      // Reset progress for each file
      setProgress(0);

      try {
        addLog(`Processing: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)...`, LogLevel.INFO);
        
        let resultBuffer: ArrayBuffer;
        let outputName: string;

        if (mode === 'ENCRYPT') {
          resultBuffer = await processFileEncrypt(file, password, keyFileBuffer, setProgress);
          outputName = getEncryptedFilename(file.name);
        } else {
          const buffer = await file.arrayBuffer(); // For decrypt we still load logic wrapper, but streaming func uses views
          resultBuffer = await processFileDecrypt(buffer, password, keyFileBuffer, setProgress);
          outputName = getDecryptedFilename(file.name);
        }

        downloadBlob(resultBuffer, outputName);
        addLog(`${mode} Success: ${outputName}`, LogLevel.SUCCESS);
        successCount++;
        
        setHistory(prev => [{
          id: crypto.randomUUID(),
          fileName: outputName,
          operation: mode,
          timestamp: new Date(),
          status: 'SUCCESS'
        }, ...prev.slice(0, 9)]);

      } catch (err: any) {
        failCount++;
        addLog(`Error ${file.name}: ${err.message}`, LogLevel.ERROR);
      }
    }

    setProgress(100);
    setIsProcessing(false);
    
    if (failCount === 0) {
      addLog(`Batch Completed. ${successCount} files processed.`, LogLevel.SUCCESS);
    } else {
      addLog(`Batch Completed with ${failCount} errors.`, LogLevel.WARNING);
    }
    
    if (successCount === totalFiles) {
      setTimeout(() => setSelectedFiles([]), 1500);
    }
  };

  const resetState = () => {
    setLogs([]); 
    setHistory([]); 
    setSelectedFiles([]); 
    setPassword(''); 
    setKeyFile(null);
    setUseKeyFile(false);
    setProgress(0);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (keyFileInputRef.current) keyFileInputRef.current.value = '';
  };

  return (
    <div className="flex h-full flex-col md:flex-row font-inter">
      {/* Sidebar */}
      <aside className="w-full md:w-80 bg-slate-900 border-r border-slate-800 p-6 flex flex-col gap-6 shadow-2xl z-10">
        <div className="flex items-center gap-3 text-emerald-400">
          <Shield className="w-8 h-8" />
          <div>
            <h1 className="font-bold text-xl text-slate-100 tracking-tight">AegisCrypt</h1>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest">Enterprise Edition</p>
          </div>
        </div>

        <div className="flex-1 overflow-hidden flex flex-col">
          <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
            <History className="w-4 h-4" /> Activity Log
          </h2>
          <div className="space-y-3 overflow-y-auto scrollbar-thin flex-1 pr-2">
            {history.length === 0 ? (
              <div className="text-slate-600 text-sm italic text-center py-10">No recent activity</div>
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
                  <div className="text-xs text-slate-300 truncate font-mono" title={item.fileName}>
                    {item.fileName}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
        
        <div className="pt-4 border-t border-slate-800">
           <div className="flex items-center gap-2 text-slate-500 text-xs">
              <Terminal className="w-3 h-3" />
              <span>v2.0.0 (Streaming Engine)</span>
           </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 bg-slate-950 p-6 md:p-12 overflow-y-auto scrollbar-thin relative">
        <div className="max-w-5xl mx-auto space-y-8">
          
          {/* Header */}
          <div className="flex justify-between items-end border-b border-slate-800 pb-6">
            <div>
              <h2 className="text-2xl font-bold text-slate-100">Secure Operation Center</h2>
              <p className="text-slate-400 mt-1 text-sm">
                AES-256-GCM Streaming Encryption with <span className="text-emerald-400 font-mono">.aegis</span> v2 format.
              </p>
            </div>
            <button 
              onClick={resetState}
              className="px-4 py-2 bg-slate-900 border border-slate-700 hover:bg-rose-950/30 hover:border-rose-800 text-slate-400 hover:text-rose-400 transition-all rounded-lg flex items-center gap-2 text-sm"
            >
              <Trash2 className="w-4 h-4" /> Reset Session
            </button>
          </div>

          {/* Core Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            
            {/* Left Column: Inputs */}
            <div className="lg:col-span-7 space-y-6">
              
              <div className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800 space-y-6">
                <PasswordInput 
                  value={password} 
                  onChange={setPassword} 
                  disabled={isProcessing} 
                />

                {/* Keyfile Block */}
                <div className="space-y-3">
                   <div className="flex items-center justify-between">
                      <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                        <Key className="w-4 h-4 text-amber-500" />
                        Keyfile Authentication
                      </label>
                      <button
                        onClick={() => {
                          const newState = !useKeyFile;
                          setUseKeyFile(newState);
                          if (!newState) setKeyFile(null);
                        }}
                        className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors duration-200 ${useKeyFile ? 'bg-emerald-600' : 'bg-slate-700'}`}
                      >
                        <div className={`bg-white w-4 h-4 rounded-full shadow-md transform duration-200 ${useKeyFile ? 'translate-x-5' : 'translate-x-0'}`} />
                      </button>
                   </div>
                   
                   {useKeyFile && (
                     <div 
                       onClick={() => keyFileInputRef.current?.click()}
                       className="group flex items-center gap-3 p-3 bg-slate-950 border border-slate-800 hover:border-emerald-500/50 rounded-xl cursor-pointer transition-all"
                     >
                        <div className="p-2.5 bg-slate-900 rounded-lg group-hover:bg-slate-800 transition-colors">
                          {keyFile ? <Key className="w-5 h-5 text-emerald-400" /> : <FileUp className="w-5 h-5 text-slate-500" />}
                        </div>
                        <div className="flex-1 min-w-0">
                           <p className="text-sm font-medium text-slate-200 truncate">
                             {keyFile ? keyFile.name : 'Select Keyfile...'}
                           </p>
                           <p className="text-xs text-slate-500">
                             {keyFile ? `${(keyFile.size / 1024).toFixed(1)} KB` : 'Recommended: Image, Document, or random file'}
                           </p>
                        </div>
                        <input type="file" ref={keyFileInputRef} className="hidden" onChange={handleKeyFileSelect} />
                     </div>
                   )}
                </div>
              </div>
              
              {/* Dropzone */}
              <div 
                className={`relative group border-2 border-dashed rounded-2xl p-10 text-center transition-all cursor-pointer overflow-hidden ${
                  selectedFiles.length > 0 
                    ? 'border-emerald-500/30 bg-emerald-500/5' 
                    : 'border-slate-800 hover:border-slate-600 hover:bg-slate-900/50'
                }`}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" multiple />
                
                <div className="relative z-10 space-y-4">
                  <div className={`w-16 h-16 mx-auto rounded-2xl flex items-center justify-center transition-colors ${
                    selectedFiles.length > 0 ? 'bg-emerald-500/20' : 'bg-slate-800'
                  }`}>
                    {selectedFiles.length > 0 ? (
                      <FileCheck className="w-8 h-8 text-emerald-400" />
                    ) : (
                      <FolderOpen className="w-8 h-8 text-slate-400 group-hover:text-slate-200" />
                    )}
                  </div>
                  <div>
                    <p className="text-lg font-medium text-slate-200">
                      {selectedFiles.length > 0 ? `${selectedFiles.length} files ready` : 'Drop files or folders'}
                    </p>
                    <p className="text-sm text-slate-500 mt-1">
                      {selectedFiles.length > 0 ? 'Click to add more' : 'Supports bulk processing & recursion'}
                    </p>
                  </div>
                </div>

                {/* Directory Button Overlay */}
                <div className="absolute bottom-4 left-0 right-0 flex justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={(e) => {
                         e.stopPropagation();
                         folderInputRef.current?.click();
                      }}
                      className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded-full border border-slate-700"
                    >
                      Browse Directory
                    </button>
                    <input
                      type="file"
                      ref={folderInputRef}
                      onChange={handleFileSelect}
                      className="hidden"
                      // @ts-ignore
                      webkitdirectory=""
                      directory=""
                    />
                </div>
              </div>
            </div>

            {/* Right Column: Actions */}
            <div className="lg:col-span-5 flex flex-col gap-6">
               <div className="bg-slate-900/50 rounded-2xl p-6 border border-slate-800 flex flex-col gap-4">
                  <button
                    onClick={() => processFiles('ENCRYPT')}
                    disabled={isProcessing || !password || selectedFiles.length === 0 || (useKeyFile && !keyFile)}
                    className="w-full group relative flex items-center justify-between p-4 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 disabled:from-slate-800 disabled:to-slate-800 disabled:text-slate-500 rounded-xl transition-all shadow-lg shadow-blue-900/20"
                  >
                    <span className="font-bold text-blue-50 pl-2">Encrypt Files</span>
                    <FileLock className="w-6 h-6 text-blue-200 opacity-70 group-hover:opacity-100 group-hover:scale-110 transition-all" />
                  </button>

                  <button
                    onClick={() => processFiles('DECRYPT')}
                    disabled={isProcessing || !password || selectedFiles.length === 0 || (useKeyFile && !keyFile)}
                    className="w-full group relative flex items-center justify-between p-4 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 rounded-xl border border-slate-700 transition-all"
                  >
                    <span className="font-bold text-purple-200 pl-2">Decrypt Files</span>
                    <Download className="w-6 h-6 text-purple-400 opacity-70 group-hover:opacity-100 group-hover:scale-110 transition-all" />
                  </button>
               </div>

               {/* Progress Panel */}
               <div className="bg-slate-900 rounded-2xl p-6 border border-slate-800 shadow-inner">
                  <div className="flex justify-between text-xs mb-3 font-medium">
                    <span className="text-slate-400 uppercase tracking-wider">Operation Status</span>
                    <span className={isProcessing ? "text-emerald-400 animate-pulse" : "text-slate-600"}>
                      {isProcessing ? 'PROCESSING CHUNKS...' : 'IDLE'}
                    </span>
                  </div>
                  <div className="h-4 bg-slate-950 rounded-full overflow-hidden border border-slate-800/50 relative">
                    {/* Stripe pattern for progress */}
                    <div 
                      className={`h-full bg-gradient-to-r from-emerald-600 to-teal-500 transition-all duration-300 ${isProcessing && 'animate-[shimmer_2s_infinite_linear]'}`}
                      style={{ 
                         width: `${progress}%`,
                         backgroundImage: 'linear-gradient(45deg,rgba(255,255,255,.15) 25%,transparent 25%,transparent 50%,rgba(255,255,255,.15) 50%,rgba(255,255,255,.15) 75%,transparent 75%,transparent)',
                         backgroundSize: '1rem 1rem'
                      }}
                    />
                  </div>
                  <div className="flex justify-between mt-2 text-xs text-slate-500 font-mono">
                    <span>{progress}%</span>
                    <span>{selectedFiles.length > 0 ? `${selectedFiles.length} Pending` : 'No Queue'}</span>
                  </div>
               </div>

               {/* Specs */}
               <div className="grid grid-cols-2 gap-3 text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
                 <div className="bg-slate-900/30 p-2 rounded border border-slate-800/50 text-center">AES-256-GCM</div>
                 <div className="bg-slate-900/30 p-2 rounded border border-slate-800/50 text-center">PBKDF2-SHA256</div>
                 <div className="bg-slate-900/30 p-2 rounded border border-slate-800/50 text-center">Stream Engine</div>
                 <div className="bg-slate-900/30 p-2 rounded border border-slate-800/50 text-center">Auth Tag 128b</div>
               </div>
            </div>
          </div>

          {/* Logs */}
          <LogBox logs={logs} onClear={() => setLogs([])} />
        </div>
      </main>
    </div>
  );
}

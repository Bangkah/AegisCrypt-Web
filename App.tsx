
import React, { useState, useCallback, useRef } from 'react';
import { 
  Shield, RefreshCw, LogOut, Lock, Unlock, Key,
  FilePlus, Trash2, StopCircle
} from 'lucide-react';
import { LogEntry, LogLevel, CryptoProgress, AuthSession } from './types';
import { LogBox } from './components/LogBox';
import { LoginScreen } from './components/LoginScreen';
import { FileList } from './components/FileList';
import { 
  processFileEncrypt, 
  processFileDecrypt, 
  downloadBlob, 
  getEncryptedFilename, 
  getDecryptedFilename 
} from './services/cryptoService';

/**
 * MAIN APPLICATION COMPONENT
 * Handles:
 * 1. Authentication State (Login/Logout)
 * 2. File Queue Management (Drag & Drop)
 * 3. Encryption/Decryption Orchestration
 * 4. UI Feedback (Logs, Progress, Animations)
 */
export default function App() {
  // --- State Management ---
  const [session, setSession] = useState<AuthSession | null>(null); // Holds Password & Keyfile
  const [files, setFiles] = useState<File[]>([]); // Current Queue
  const [logs, setLogs] = useState<LogEntry[]>([]);
  
  // UI Status Flags
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [progress, setProgress] = useState<CryptoProgress | null>(null);
  
  // Refs for non-rendering variables
  const abortControllerRef = useRef<AbortController | null>(null); // To cancel operations
  const fileInputRef = useRef<HTMLInputElement>(null); // Hidden file input

  // Logger Helper
  const addLog = useCallback((message: string, level: LogLevel = LogLevel.INFO) => {
    setLogs(prev => [...prev, {
      id: crypto.randomUUID(),
      timestamp: new Date().toLocaleTimeString('en-US', { hour12: false }),
      message,
      level
    }]);
  }, []);

  // --- Drag & Drop Handlers ---
  const handleDragEnter = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); };
  const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); };
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); };
  
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files?.length) {
      // Convert FileList to Array and add to queue
      const newFiles = Array.from(e.dataTransfer.files);
      setFiles(prev => [...prev, ...newFiles]);
      addLog(`Added ${newFiles.length} files to queue.`, LogLevel.INFO);
    }
  };

  // Standard File Input Handler
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) {
      const newFiles = Array.from(e.target.files);
      setFiles(prev => [...prev, ...newFiles]);
      addLog(`Added ${newFiles.length} files to queue.`, LogLevel.INFO);
    }
    // Reset input to allow selecting the same file again if needed
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  // --- Core Operations ---

  const cancelOperation = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort(); // Triggers exception in cryptoService
      addLog('Operation cancelled by user.', LogLevel.WARNING);
    }
  };

  const handleLogout = () => {
    if (isProcessing) return;
    setSession(null); // Clears keys from memory
    setFiles([]);
    setLogs([]);
    setProgress(null);
  };

  /**
   * Orchestrates the batch processing of files.
   * Iterates through the file queue and calls cryptoService for each.
   */
  const runCrypto = async (mode: 'ENCRYPT' | 'DECRYPT') => {
    if (!session) return;
    if (!files.length) return addLog('No files in queue.', LogLevel.WARNING);
    
    setIsProcessing(true);
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    let successCount = 0;

    try {
      // Batch Loop
      for (let i = 0; i < files.length; i++) {
        if (signal.aborted) break;
        
        const file = files[i];
        const startTime = performance.now();
        
        addLog(`Starting ${mode}: ${file.name}`, LogLevel.INFO);

        // Result can be Blob or ArrayBuffer, service handles chunking
        let resultData: Blob | ArrayBuffer;
        
        // Progress Callback: Calculates Speed & ETA
        const updateProgress = (bytes: number) => {
          const now = performance.now();
          const elapsedSec = (now - startTime) / 1000;
          const speed = elapsedSec > 0 ? (bytes / 1024 / 1024) / elapsedSec : 0; // MB/s
          const remainingBytes = file.size - bytes;
          const eta = speed > 0 ? remainingBytes / 1024 / 1024 / speed : 0; // Seconds

          setProgress({
            percent: Math.min(100, (bytes / file.size) * 100),
            currentFile: file.name,
            bytesProcessed: bytes,
            totalBytes: file.size,
            speed,
            eta
          });
        };

        try {
          if (mode === 'ENCRYPT') {
            resultData = await processFileEncrypt(file, session.password, session.keyFileBuffer, signal, updateProgress);
            downloadBlob(resultData, getEncryptedFilename(file.name));
          } else {
            const buffer = await file.arrayBuffer();
            resultData = await processFileDecrypt(buffer, session.password, session.keyFileBuffer, signal, updateProgress);
            downloadBlob(resultData, getDecryptedFilename(file.name));
          }
          addLog(`${mode} Success: ${file.name}`, LogLevel.SUCCESS);
          successCount++;
        } catch (err: any) {
          if (signal.aborted) break;
          addLog(`Failed ${file.name}: ${err.message}`, LogLevel.ERROR);
        }
      }
    } catch (err: any) {
      if (!signal.aborted) addLog(`System Error: ${err.message}`, LogLevel.ERROR);
    } finally {
      // Cleanup
      setIsProcessing(false);
      setProgress(null);
      abortControllerRef.current = null;
      if (successCount === files.length && files.length > 0 && !abortControllerRef.current?.signal.aborted) {
        addLog(`Batch Process Completed.`, LogLevel.SUCCESS);
        setFiles([]); // Clear queue on full success
      }
    }
  };

  // Redirect to Login if no session
  if (!session) return <LoginScreen onLogin={setSession} />;

  return (
    <div className="h-screen flex flex-col relative z-10">
      
      {/* Navbar */}
      <header className="px-6 py-4 flex items-center justify-between border-b border-white/5 glass-panel z-20">
        <div className="flex items-center gap-3">
          <div className="p-1.5 bg-gradient-to-br from-blue-600 to-emerald-600 rounded-lg shadow-[0_0_15px_rgba(37,99,235,0.3)]">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white tracking-tight">AegisCrypt</h1>
            <p className="text-[10px] font-mono text-emerald-400 uppercase tracking-widest mt-0.5">Session Active</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
           {/* Session Info Indicator */}
           <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900/50 border border-slate-700/50 text-xs backdrop-blur-sm">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_#10b981]" />
              <span className="text-slate-400">Auth:</span>
              <span className="font-mono text-slate-200">Password</span>
              {session.keyFile && (
                <>
                  <span className="text-slate-600">+</span>
                  <Key className="w-3 h-3 text-emerald-400" />
                </>
              )}
           </div>

           <button 
             onClick={handleLogout}
             disabled={isProcessing}
             className="flex items-center gap-2 px-4 py-2 hover:bg-white/5 text-slate-300 hover:text-white rounded-lg transition-all text-xs font-medium border border-transparent hover:border-white/10"
           >
             <LogOut className="w-4 h-4" />
             <span>Logout</span>
           </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col lg:flex-row gap-6 p-6 lg:p-8 max-w-7xl mx-auto w-full overflow-hidden">
        
        {/* Left Panel: File Management */}
        <div className="flex-[1.2] flex flex-col gap-6 min-w-0 h-full">
          <div 
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            className={`flex-1 relative rounded-3xl transition-all duration-500 flex flex-col overflow-hidden glass-panel ${
              isDragging 
                ? 'border-emerald-500/50 bg-emerald-500/10 shadow-[0_0_50px_rgba(16,185,129,0.2)] scale-[1.01]' 
                : 'border-slate-800 hover:border-slate-600'
            }`}
          >
            {/* Drag Overlay */}
            {isDragging && (
               <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm">
                 <div className="text-center animate-bounce">
                    <FilePlus className="w-16 h-16 text-emerald-400 mx-auto mb-4" />
                    <h3 className="text-2xl font-bold text-white">Drop Files Here</h3>
                 </div>
               </div>
            )}

            {/* List Header */}
            <div className="p-4 border-b border-white/5 flex items-center justify-between bg-white/5">
              <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                <FilePlus className="w-4 h-4 text-blue-400" />
                Processing Queue
                <span className="bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full text-xs font-mono">{files.length}</span>
              </h3>
              {files.length > 0 && (
                <button onClick={() => setFiles([])} disabled={isProcessing} className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1 hover:underline disabled:opacity-50">
                   <Trash2 className="w-3 h-3" /> Clear All
                </button>
              )}
            </div>

            {/* Queue Content: Empty State vs FileList */}
            {files.length === 0 ? (
              <div 
                onClick={() => !isProcessing && fileInputRef.current?.click()}
                className="flex-1 flex flex-col items-center justify-center cursor-pointer group hover:bg-white/5 transition-colors p-8"
              >
                <input type="file" multiple ref={fileInputRef} className="hidden" onChange={handleFileSelect} />
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-slate-800 to-slate-900 border border-slate-700 flex items-center justify-center mb-6 shadow-2xl group-hover:scale-110 group-hover:shadow-blue-500/20 group-hover:border-blue-500/50 transition-all duration-300">
                  <FilePlus className="w-10 h-10 text-slate-500 group-hover:text-blue-400 transition-colors" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Drop Files to Secure</h3>
                <p className="text-slate-500 text-sm max-w-xs text-center">
                  Drag and drop documents, images, or archives here. We support bulk processing.
                </p>
                <div className="mt-6 px-4 py-2 rounded-full bg-slate-800 border border-slate-700 text-xs text-slate-400 group-hover:bg-blue-600/20 group-hover:text-blue-200 group-hover:border-blue-500/30 transition-all">
                  Click to Browse
                </div>
              </div>
            ) : (
              <div className="flex-1 p-4 flex flex-col relative">
                <FileList files={files} onRemove={removeFile} disabled={isProcessing} />
                
                {/* Add More Button (Floating) */}
                <button 
                   onClick={() => !isProcessing && fileInputRef.current?.click()}
                   className="mt-4 w-full py-3 border border-dashed border-slate-700 rounded-xl text-slate-500 hover:text-blue-400 hover:border-blue-500/50 hover:bg-blue-500/5 transition-all flex items-center justify-center gap-2 text-sm"
                >
                   <FilePlus className="w-4 h-4" /> Add more files
                </button>
                <input type="file" multiple ref={fileInputRef} className="hidden" onChange={handleFileSelect} />
              </div>
            )}
          </div>
        </div>

        {/* Right Panel: Action Controls & Telemetry */}
        <div className="flex-1 flex flex-col gap-6 min-w-0">
          
          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => runCrypto('ENCRYPT')}
              disabled={isProcessing || !files.length}
              className="group relative overflow-hidden p-6 rounded-2xl flex flex-col items-center justify-center gap-3 transition-all duration-300 shadow-lg disabled:opacity-50 disabled:grayscale hover:-translate-y-1 bg-gradient-to-br from-blue-600 to-blue-800 border border-blue-400/20 hover:shadow-blue-600/30"
            >
              <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20" />
              <Lock className="w-8 h-8 text-white relative z-10 group-hover:scale-110 transition-transform" />
              <div className="text-center relative z-10">
                <span className="block font-bold text-white text-lg">Encrypt</span>
              </div>
            </button>
            
            <button
              onClick={() => runCrypto('DECRYPT')}
              disabled={isProcessing || !files.length}
              className="group relative overflow-hidden p-6 rounded-2xl flex flex-col items-center justify-center gap-3 transition-all duration-300 shadow-lg disabled:opacity-50 disabled:grayscale hover:-translate-y-1 bg-slate-800 hover:bg-slate-750 border border-slate-600 hover:border-slate-500"
            >
              <Unlock className="w-8 h-8 text-emerald-400 group-hover:scale-110 transition-transform" />
              <div className="text-center">
                <span className="block font-bold text-slate-200 text-lg group-hover:text-white">Decrypt</span>
              </div>
            </button>
          </div>

          {/* Progress & Telemetry Card */}
          <div className="glass-panel rounded-2xl p-5 border-t-2 border-t-blue-500/50">
             <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                   <RefreshCw className={`w-4 h-4 text-blue-400 ${isProcessing ? 'animate-spin' : ''}`} />
                   <span className="text-sm font-semibold text-slate-200">Operation Status</span>
                </div>
                {isProcessing && (
                  <button onClick={cancelOperation} className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1">
                     <StopCircle className="w-3 h-3" /> CANCEL
                  </button>
                )}
             </div>

             {/* Progress Bar */}
             <div className="h-3 w-full bg-slate-900 rounded-full overflow-hidden border border-slate-700 mb-2 relative">
                {isProcessing && (
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-shimmer" style={{ backgroundSize: '200% 100%' }} />
                )}
                <div 
                   className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 transition-all duration-300 ease-out" 
                   style={{ width: `${progress ? progress.percent : 0}%` }} 
                />
             </div>
             
             {/* Stats Grid */}
             <div className="grid grid-cols-3 gap-2 mt-4">
                <div className="bg-slate-900/50 rounded-lg p-2 text-center">
                   <div className="text-[10px] text-slate-500 uppercase">Speed</div>
                   <div className="font-mono text-sm text-emerald-400 font-bold">{progress ? progress.speed.toFixed(1) : '0.0'} <span className="text-[10px]">MB/s</span></div>
                </div>
                <div className="bg-slate-900/50 rounded-lg p-2 text-center">
                   <div className="text-[10px] text-slate-500 uppercase">ETA</div>
                   <div className="font-mono text-sm text-blue-400 font-bold">{progress ? progress.eta.toFixed(0) : '0'} <span className="text-[10px]">s</span></div>
                </div>
                <div className="bg-slate-900/50 rounded-lg p-2 text-center">
                   <div className="text-[10px] text-slate-500 uppercase">Current</div>
                   <div className="font-mono text-xs text-slate-300 truncate max-w-[80px] mx-auto">{progress ? progress.currentFile : '-'}</div>
                </div>
             </div>
          </div>

          {/* Logs */}
          <div className="flex-1 min-h-0">
             <LogBox logs={logs} onClear={() => setLogs([])} />
          </div>
        </div>

      </main>
    </div>
  );
}
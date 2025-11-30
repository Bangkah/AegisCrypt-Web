
import React, { useState, useRef } from 'react';
import { Shield, Key, ArrowRight, FileCheck, FileUp, Lock } from 'lucide-react';
import { PasswordInput } from './PasswordInput';
import { AuthSession } from '../types';

interface LoginScreenProps {
  onLogin: (session: AuthSession) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin }) => {
  const [password, setPassword] = useState('');
  const [keyFile, setKeyFile] = useState<File | null>(null);
  const [useKeyFile, setUseKeyFile] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  
  const keyFileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;

    setIsAnimating(true);
    
    // Prep key material buffer
    let keyFileBuffer: ArrayBuffer | null = null;
    if (useKeyFile && keyFile) {
      keyFileBuffer = await keyFile.arrayBuffer();
    }

    // UX delay for transition
    setTimeout(() => {
      onLogin({
        password,
        keyFile: useKeyFile ? keyFile : null,
        keyFileBuffer
      });
    }, 600);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative z-20">
      <div className={`relative w-full max-w-md glass-panel p-8 rounded-3xl shadow-2xl transition-all duration-700 ${isAnimating ? 'scale-95 opacity-0 translate-y-4' : 'scale-100 opacity-100'}`}>
        
        {/* Glow Effect */}
        <div className="absolute -top-20 -left-20 w-40 h-40 bg-blue-500/20 rounded-full blur-[80px] pointer-events-none" />
        <div className="absolute -bottom-20 -right-20 w-40 h-40 bg-emerald-500/20 rounded-full blur-[80px] pointer-events-none" />

        {/* Header */}
        <div className="text-center mb-8 relative">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-emerald-600 rounded-2xl mx-auto flex items-center justify-center shadow-lg shadow-blue-500/20 mb-4 ring-1 ring-white/10 group">
            <Shield className="w-8 h-8 text-white group-hover:scale-110 transition-transform duration-300" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">AegisCrypt</h1>
          <p className="text-slate-400 text-xs mt-2 uppercase tracking-widest font-mono">Secure Encryption Environment</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 relative">
          {/* Password */}
          <div>
            <PasswordInput value={password} onChange={setPassword} disabled={isAnimating} />
          </div>

          {/* Keyfile Option */}
          <div className={`transition-all duration-300 rounded-xl border ${useKeyFile ? 'bg-slate-800/40 border-emerald-500/30 p-4' : 'border-transparent p-0'}`}>
            <div className="flex items-center justify-between">
              <button 
                type="button"
                onClick={() => { setUseKeyFile(!useKeyFile); if(useKeyFile) setKeyFile(null); }}
                className="flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200 transition-colors focus:outline-none"
              >
                <Key className={`w-4 h-4 ${useKeyFile ? 'text-emerald-400' : 'text-slate-500'}`} />
                <span>Use Keyfile (2FA)</span>
              </button>
              <div 
                 onClick={() => { setUseKeyFile(!useKeyFile); if(useKeyFile) setKeyFile(null); }}
                 className={`w-10 h-5 rounded-full cursor-pointer relative transition-colors ${useKeyFile ? 'bg-emerald-600' : 'bg-slate-700'}`}
              >
                 <div className={`absolute top-1 left-1 w-3 h-3 bg-white rounded-full transition-transform ${useKeyFile ? 'translate-x-5' : 'translate-x-0'}`} />
              </div>
            </div>
            
            {useKeyFile && (
              <div 
                onClick={() => keyFileInputRef.current?.click()}
                className="mt-3 flex items-center gap-3 p-3 bg-slate-950/50 border border-dashed border-slate-600 hover:border-emerald-500/50 rounded-lg cursor-pointer group transition-all"
              >
                <div className="p-2 bg-slate-900 rounded-md group-hover:bg-slate-800 text-emerald-500 transition-colors">
                  {keyFile ? <FileCheck className="w-5 h-5" /> : <FileUp className="w-5 h-5" />}
                </div>
                <div className="flex-1 overflow-hidden">
                  <p className="text-sm font-medium text-slate-200 truncate">{keyFile ? keyFile.name : 'Select Keyfile...'}</p>
                </div>
                <input type="file" ref={keyFileInputRef} className="hidden" onChange={e => setKeyFile(e.target.files?.[0] || null)} />
              </div>
            )}
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={!password || isAnimating || (useKeyFile && !keyFile)}
            className="w-full py-3.5 bg-gradient-to-r from-blue-600 to-emerald-600 hover:from-blue-500 hover:to-emerald-500 text-white font-semibold rounded-xl shadow-lg shadow-blue-900/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98] flex items-center justify-center gap-2 group border border-white/10"
          >
            {isAnimating ? (
              <>
                <Lock className="w-4 h-4 animate-pulse" />
                <span className="text-sm">Initializing...</span>
              </>
            ) : (
              <>
                <span className="text-sm">Start Session</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
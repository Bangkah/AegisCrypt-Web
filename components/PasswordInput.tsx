
import React, { useState, useEffect } from 'react';
import { Eye, EyeOff, Lock, Check, X } from 'lucide-react';

interface PasswordInputProps {
  value: string;
  onChange: (val: string) => void;
  disabled: boolean;
}

export const PasswordInput: React.FC<PasswordInputProps> = ({ value, onChange, disabled }) => {
  const [show, setShow] = useState(false);
  const [strength, setStrength] = useState(0); // 0-4

  useEffect(() => {
    let score = 0;
    if (!value) { setStrength(0); return; }
    if (value.length > 7) score++;
    if (value.length > 12) score++;
    if (/[A-Z]/.test(value)) score++;
    if (/[0-9]/.test(value) || /[^A-Za-z0-9]/.test(value)) score++;
    setStrength(score);
  }, [value]);

  const strengthColor = () => {
    if (strength <= 1) return 'bg-rose-500 shadow-rose-500/50';
    if (strength === 2) return 'bg-amber-500 shadow-amber-500/50';
    if (strength === 3) return 'bg-blue-500 shadow-blue-500/50';
    return 'bg-emerald-500 shadow-emerald-500/50';
  };

  const strengthLabel = () => {
    if (strength <= 1) return 'Weak';
    if (strength === 2) return 'Fair';
    if (strength === 3) return 'Good';
    return 'Excellent';
  };

  return (
    <div className="space-y-3">
      <div className="relative group">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Lock className={`w-5 h-5 transition-colors duration-300 ${value ? 'text-blue-400' : 'text-slate-500'}`} />
        </div>
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          placeholder="Enter encryption password"
          className="w-full bg-slate-900/50 backdrop-blur-md border border-slate-700 rounded-xl py-3.5 pl-10 pr-12 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-medium tracking-wide"
        />
        <button
          onClick={() => setShow(!show)}
          disabled={disabled}
          className="absolute right-3 top-3.5 text-slate-500 hover:text-slate-300 transition-colors focus:outline-none"
        >
          {show ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
        </button>
      </div>
      
      {/* Strength Bar */}
      <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden flex items-center">
         <div 
            className={`h-full transition-all duration-500 ease-out ${value ? strengthColor() : 'w-0'}`} 
            style={{ width: `${(strength / 4) * 100}%` }}
         />
      </div>
      <div className="flex justify-between items-center text-xs">
         <span className={`font-semibold transition-colors duration-300 ${
           strength <= 1 ? 'text-rose-400' : strength === 2 ? 'text-amber-400' : strength === 3 ? 'text-blue-400' : 'text-emerald-400'
         }`}>
           {value ? strengthLabel() : 'Password required'}
         </span>
         <span className="text-slate-500">{value.length} chars</span>
      </div>
    </div>
  );
};

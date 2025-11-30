import React, { useState, useEffect } from 'react';
import { Eye, EyeOff, Lock } from 'lucide-react';

interface PasswordInputProps {
  value: string;
  onChange: (val: string) => void;
  disabled: boolean;
}

export const PasswordInput: React.FC<PasswordInputProps> = ({ value, onChange, disabled }) => {
  const [show, setShow] = useState(false);
  const [strength, setStrength] = useState<'Weak' | 'Medium' | 'Strong' | 'Empty'>('Empty');

  useEffect(() => {
    if (value.length === 0) {
      setStrength('Empty');
      return;
    }
    if (value.length < 8) {
      setStrength('Weak');
      return;
    }
    const hasNumber = /\d/.test(value);
    const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(value);
    const hasUpper = /[A-Z]/.test(value);

    if (hasNumber && hasSpecial && hasUpper && value.length >= 10) {
      setStrength('Strong');
    } else if ((hasNumber || hasSpecial) && value.length >= 8) {
      setStrength('Medium');
    } else {
      setStrength('Weak');
    }
  }, [value]);

  const getStrengthColor = () => {
    switch (strength) {
      case 'Strong': return 'bg-emerald-500';
      case 'Medium': return 'bg-amber-500';
      case 'Weak': return 'bg-rose-500';
      default: return 'bg-slate-700';
    }
  };

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
        <Lock className="w-4 h-4" />
        Encryption Password
      </label>
      <div className="relative">
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          placeholder="Enter a strong password"
          className="w-full bg-slate-800 border border-slate-700 rounded-lg py-3 pl-4 pr-12 text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all disabled:opacity-50"
        />
        <button
          onClick={() => setShow(!show)}
          disabled={disabled}
          className="absolute right-3 top-3 text-slate-500 hover:text-slate-300 focus:outline-none"
        >
          {show ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
        </button>
      </div>
      
      {/* Strength Indicator */}
      <div className="flex items-center gap-2">
        <div className="h-1 flex-1 bg-slate-800 rounded-full overflow-hidden">
          <div 
            className={`h-full transition-all duration-500 ${getStrengthColor()}`} 
            style={{ width: strength === 'Empty' ? '0%' : strength === 'Weak' ? '33%' : strength === 'Medium' ? '66%' : '100%' }}
          />
        </div>
        <span className={`text-xs font-semibold ${
          strength === 'Strong' ? 'text-emerald-500' : 
          strength === 'Medium' ? 'text-amber-500' : 
          strength === 'Weak' ? 'text-rose-500' : 'text-slate-500'
        }`}>
          {strength === 'Empty' ? 'Required' : strength}
        </span>
      </div>
    </div>
  );
};

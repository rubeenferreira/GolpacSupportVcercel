import React, { useState } from 'react';
import { ShieldCheck, ArrowRight, Lock, KeyRound } from 'lucide-react';

interface AuthPageProps {
  onLogin: () => void;
}

export const AuthPage: React.FC<AuthPageProps> = ({ onLogin }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [accessKey, setAccessKey] = useState('admin-secure-key');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    // Simulate network authentication request
    setTimeout(() => {
      setIsLoading(false);
      onLogin();
    }, 1200);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 font-sans">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in duration-500">
        
        {/* Brand Header */}
        <div className="bg-brand-600 p-10 text-center relative overflow-hidden">
          {/* Decorative background circle */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-brand-500/30 rounded-full blur-3xl"></div>
          
          <div className="relative z-10">
            <div className="w-20 h-20 bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl mx-auto flex items-center justify-center mb-6 shadow-lg">
               <ShieldCheck size={40} className="text-white" />
            </div>
            <h1 className="text-3xl font-bold text-white tracking-tight">Golpac Support IT</h1>
            <p className="text-brand-100 mt-2 font-medium">Secure Management Portal</p>
          </div>
        </div>

        {/* Login Form */}
        <div className="p-8 pt-10">
          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 ml-1">
                Identity Credentials
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <KeyRound className="h-5 w-5 text-slate-400 group-focus-within:text-brand-500 transition-colors" />
                </div>
                <input
                  type="password"
                  value={accessKey}
                  onChange={(e) => setAccessKey(e.target.value)}
                  className="block w-full pl-10 pr-3 py-3 border border-slate-200 rounded-xl leading-5 bg-slate-50 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all duration-200 sm:text-sm"
                  placeholder="Enter Access Key"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className={`w-full flex items-center justify-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-bold text-white bg-brand-600 hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-500 transition-all duration-200 ${isLoading ? 'opacity-80 cursor-wait' : ''}`}
            >
              {isLoading ? (
                <div className="flex items-center gap-2">
                   <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                   <span>Verifying Identity...</span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                   <span>Access Dashboard</span>
                   <ArrowRight size={18} />
                </div>
              )}
            </button>
          </form>

          <div className="mt-8 flex items-center justify-center space-x-2 text-xs text-slate-400">
            <Lock size={12} />
            <span>256-bit Encryption &bull; Authorized Personnel Only</span>
          </div>
        </div>
      </div>
      
      <div className="mt-8 text-center text-slate-400 text-xs">
        <p>&copy; {new Date().getFullYear()} Golpac Systems Inc. All rights reserved.</p>
        <p className="mt-1">v2.4.1-stable</p>
      </div>
    </div>
  );
};
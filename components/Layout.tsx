import React from 'react';
import { ViewState } from '../types';
import { LayoutDashboard, Monitor, BrainCircuit, Settings, LogOut } from 'lucide-react';

interface LayoutProps {
  currentView: ViewState;
  onChangeView: (view: ViewState) => void;
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ currentView, onChangeView, children }) => {
  
  const NavItem = ({ view, icon: Icon, label }: { view: ViewState, icon: any, label: string }) => (
    <button
      onClick={() => onChangeView(view)}
      className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-all duration-200 ${
        currentView === view 
          ? 'bg-brand-50 text-brand-700 font-semibold shadow-sm border border-brand-100' 
          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
      }`}
    >
      <Icon size={20} className={currentView === view ? 'text-brand-600' : 'text-slate-400'} />
      <span>{label}</span>
    </button>
  );

  return (
    <div className="flex h-screen bg-slate-50 font-sans">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-slate-200 hidden md:flex flex-col">
        <div className="p-6 border-b border-slate-100">
           <div className="flex items-center space-x-2">
             <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-lg">G</span>
             </div>
             <span className="text-lg font-bold text-slate-800 tracking-tight leading-tight">Golpac Support <span className="text-brand-600 block text-base">IT - Panel</span></span>
           </div>
        </div>
        
        <nav className="flex-1 p-4 space-y-2">
          <NavItem view="dashboard" icon={LayoutDashboard} label="Dashboard" />
          <NavItem view="devices" icon={Monitor} label="Devices" />
          <NavItem view="ai-insights" icon={BrainCircuit} label="AI Analyst" />
          {/* <NavItem view="settings" icon={Settings} label="Settings" /> */}
        </nav>

        <div className="p-4 border-t border-slate-100">
           <div className="flex items-center space-x-3 p-3 rounded-lg bg-slate-50 border border-slate-100">
             <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 font-bold">
               A
             </div>
             <div className="flex-1 overflow-hidden">
               <p className="text-sm font-medium text-slate-700 truncate">Admin User</p>
               <p className="text-xs text-slate-400 truncate">admin@golpac.com</p>
             </div>
             <LogOut size={16} className="text-slate-400 cursor-pointer hover:text-red-500" />
           </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Mobile Header */}
        <header className="md:hidden bg-white border-b border-slate-200 p-4 flex items-center justify-between">
           <span className="font-bold text-slate-800">Golpac Support IT</span>
           <button className="text-slate-500"><Settings /></button>
        </header>

        <div className="flex-1 overflow-auto p-4 md:p-8">
            <div className="max-w-7xl mx-auto h-full">
                {children}
            </div>
        </div>
      </main>
    </div>
  );
};
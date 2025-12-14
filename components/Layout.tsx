
import React from 'react';
import { ViewState } from '../types';
import { LayoutDashboard, Monitor, LogOut, Settings, Users, Shield } from 'lucide-react';

interface LayoutProps {
  currentView: ViewState;
  onChangeView: (view: ViewState) => void;
  children: React.ReactNode;
  currentUser?: string;
  onLogout: () => void;
}

export const Layout: React.FC<LayoutProps> = ({ currentView, onChangeView, children, currentUser, onLogout }) => {
  
  const NavItem = ({ view, icon: Icon, label }: { view: ViewState, icon: any, label: string }) => (
    <button
      onClick={() => onChangeView(view)}
      className={`w-full flex items-center space-x-3 px-3 py-1.5 rounded-md transition-all duration-200 text-sm font-medium ${
        currentView === view 
          ? 'bg-slate-200/60 text-slate-800' 
          : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
      }`}
    >
      <Icon size={18} className={currentView === view ? 'text-slate-800' : 'text-slate-400'} />
      <span>{label}</span>
    </button>
  );

  const MobileNavItem = ({ view, icon: Icon, label }: { view: ViewState, icon: any, label: string }) => (
    <button
      onClick={() => onChangeView(view)}
      className={`flex flex-col items-center justify-center p-2 rounded-lg transition-all duration-200 w-full ${
        currentView === view 
          ? 'text-slate-800 bg-slate-100' 
          : 'text-slate-400 hover:text-slate-600'
      }`}
    >
      <Icon size={22} strokeWidth={currentView === view ? 2.5 : 2} />
      <span className="text-[10px] font-medium mt-1">{label}</span>
    </button>
  );

  const logoUrl = "https://static.wixstatic.com/media/297e13_91fceac09fe745458d11b50051949432~mv2.png/v1/fill/w_194,h_110,al_c,q_85,usm_0.66_1.00_0.01,enc_avif,quality_auto/logo_footer.png";

  return (
    <div className="flex flex-col md:flex-row bg-white font-sans min-h-screen md:h-screen md:overflow-hidden">
      {/* Sidebar (Desktop Only) - Notion Sidebar Color */}
      <aside className="w-64 bg-slate-50 border-r border-slate-200 hidden md:flex flex-col h-full overflow-y-auto">
        <div className="p-4 pb-2 shrink-0">
           <div className="flex items-center gap-3 px-2 py-2 rounded-md hover:bg-slate-100 transition-colors cursor-default">
             <div className="h-6 w-6 bg-white border border-slate-200 rounded flex items-center justify-center shrink-0">
                <img src={logoUrl} alt="Golpac" className="h-4 w-auto object-contain" />
             </div>
             <div className="flex flex-col">
                <span className="text-sm font-semibold text-slate-800 leading-tight">Golpac Support</span>
                <span className="text-slate-500 text-[10px]">IT Workspace</span>
             </div>
           </div>
        </div>
        
        <nav className="flex-1 px-3 py-2 space-y-0.5">
          <div className="px-3 py-1 text-xs font-semibold text-slate-400 mb-1 mt-4">Platform</div>
          <NavItem view="dashboard" icon={LayoutDashboard} label="Dashboard" />
          <NavItem view="devices" icon={Monitor} label="Devices database" />
          
          <div className="px-3 py-1 text-xs font-semibold text-slate-400 mb-1 mt-6">Settings</div>
          <NavItem view="users" icon={Users} label="Team members" />
        </nav>

        <div className="p-4 border-t border-slate-200 shrink-0">
           <div className={`w-full flex items-center space-x-3 p-2 rounded-md hover:bg-slate-100 transition-colors cursor-pointer mb-1`}>
             <div className="w-5 h-5 rounded bg-brand-600 flex items-center justify-center text-white text-[10px] font-bold">
               {currentUser ? currentUser.charAt(0).toUpperCase() : 'A'}
             </div>
             <div className="flex-1 overflow-hidden">
               <p className="text-sm font-medium text-slate-700 truncate">{currentUser || 'Admin User'}</p>
             </div>
           </div>
           
           <button 
            onClick={onLogout}
            className="w-full flex items-center gap-2 text-xs text-slate-500 hover:text-red-600 hover:bg-red-50 px-2 py-1.5 rounded-md transition-colors"
           >
             <LogOut size={14} />
             <span>Log out</span>
           </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col relative w-full bg-white">
        {/* Mobile Top Header - Sticky */}
        <header className="md:hidden bg-white border-b border-slate-200 p-4 flex items-center justify-between shrink-0 sticky top-0 z-30">
           <div className="flex items-center gap-2">
                <div className="h-6 w-6 bg-slate-50 border border-slate-200 rounded flex items-center justify-center shrink-0">
                     <img src={logoUrl} alt="Golpac" className="h-3 w-auto object-contain" />
                </div>
                <span className="font-semibold text-slate-800 text-sm">Golpac Support</span>
           </div>
           <button 
             onClick={onLogout} 
             className="text-slate-400 hover:text-slate-600"
            >
              <LogOut size={18} />
            </button>
        </header>

        {/* Content Area */}
        {/* On mobile: Let window scroll naturally. On Desktop: overflow-auto inside the container. */}
        <div className="flex-1 md:overflow-y-auto md:h-full">
            <div className="p-4 pb-24 md:p-12 md:pb-12 max-w-6xl mx-auto h-full">
                {children}
            </div>
        </div>

        {/* Mobile Bottom Navigation - Fixed */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-6 py-2 pb-safe z-50">
          <div className="flex justify-between items-center max-w-sm mx-auto gap-2">
            <MobileNavItem view="dashboard" icon={LayoutDashboard} label="Dashboard" />
            <MobileNavItem view="devices" icon={Monitor} label="Devices" />
            <MobileNavItem view="users" icon={Shield} label="Manage" />
          </div>
        </div>
      </main>
    </div>
  );
};

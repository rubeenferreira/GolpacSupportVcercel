
import React, { useMemo, useState } from 'react';
import { Device, DeviceStatus, OSType } from '../types';
import { APP_LATEST_VERSION } from '../constants';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend } from 'recharts';
import { Activity, Server, AlertTriangle, ShieldCheck, Terminal, Copy, Check } from 'lucide-react';

interface DashboardProps {
  devices: Device[];
}

export const Dashboard: React.FC<DashboardProps> = ({ devices }) => {
  const [copyFeedback, setCopyFeedback] = useState<string|null>(null);

  const stats = useMemo(() => {
    return {
      total: devices.length,
      online: devices.filter(d => d.status === DeviceStatus.ONLINE).length,
      critical: devices.filter(d => d.status === DeviceStatus.CRITICAL).length,
      // Only count as outdated if it exists and is not equal to latest
      outdated: devices.filter(d => d.appVersion && d.appVersion !== 'N/A' && d.appVersion !== APP_LATEST_VERSION).length
    };
  }, [devices]);

  const osData = useMemo(() => {
    const counts: Record<string, number> = {};
    devices.forEach(d => {
      counts[d.os] = (counts[d.os] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [devices]);

  const statusData = useMemo(() => {
     const counts: Record<string, number> = {};
     devices.forEach(d => {
       counts[d.status] = (counts[d.status] || 0) + 1;
     });
     return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [devices]);

  const COLORS = ['#0ea5e9', '#8b5cf6', '#f59e0b', '#10b981'];
  const STATUS_COLORS: Record<string, string> = {
    [DeviceStatus.ONLINE]: '#22c55e',
    [DeviceStatus.OFFLINE]: '#94a3b8',
    [DeviceStatus.WARNING]: '#f59e0b',
    [DeviceStatus.CRITICAL]: '#ef4444',
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopyFeedback(id);
    setTimeout(() => setCopyFeedback(null), 2000);
  };

  const apiBase = typeof window !== 'undefined' ? window.location.origin : 'https://golpac-support-panel.vercel.app';

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-4">
      {/* KPI Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        {/* KPI Cards */}
        <div className="bg-white p-4 md:p-6 rounded-xl shadow-sm border border-slate-100 flex flex-col md:flex-row items-start md:items-center justify-between gap-2">
          <div>
            <p className="text-xs md:text-sm font-medium text-slate-500">Total Installs</p>
            <p className="text-xl md:text-2xl font-bold text-slate-900">{stats.total}</p>
          </div>
          <div className="p-2 md:p-3 bg-blue-50 rounded-lg text-blue-600 self-end md:self-auto">
            <Server size={20} className="md:w-6 md:h-6" />
          </div>
        </div>

        <div className="bg-white p-4 md:p-6 rounded-xl shadow-sm border border-slate-100 flex flex-col md:flex-row items-start md:items-center justify-between gap-2">
          <div>
            <p className="text-xs md:text-sm font-medium text-slate-500">Active Online</p>
            <p className="text-xl md:text-2xl font-bold text-green-600">{stats.online}</p>
          </div>
          <div className="p-2 md:p-3 bg-green-50 rounded-lg text-green-600 self-end md:self-auto">
            <Activity size={20} className="md:w-6 md:h-6" />
          </div>
        </div>

        <div className="bg-white p-4 md:p-6 rounded-xl shadow-sm border border-slate-100 flex flex-col md:flex-row items-start md:items-center justify-between gap-2">
          <div>
            <p className="text-xs md:text-sm font-medium text-slate-500">Critical Issues</p>
            <p className="text-xl md:text-2xl font-bold text-red-600">{stats.critical}</p>
          </div>
          <div className="p-2 md:p-3 bg-red-50 rounded-lg text-red-600 self-end md:self-auto">
            <AlertTriangle size={20} className="md:w-6 md:h-6" />
          </div>
        </div>

        <div className="bg-white p-4 md:p-6 rounded-xl shadow-sm border border-slate-100 flex flex-col md:flex-row items-start md:items-center justify-between gap-2">
          <div>
            <p className="text-xs md:text-sm font-medium text-slate-500">Outdated Vers.</p>
            <p className="text-xl md:text-2xl font-bold text-orange-600">{stats.outdated}</p>
          </div>
          <div className="p-2 md:p-3 bg-orange-50 rounded-lg text-orange-600 self-end md:self-auto">
            <ShieldCheck size={20} className="md:w-6 md:h-6" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Charts */}
        <div className="bg-white p-4 md:p-6 rounded-xl shadow-sm border border-slate-100">
          <h3 className="text-base md:text-lg font-semibold text-slate-800 mb-4">Operating System Distribution</h3>
          <div className="h-56 md:h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={osData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  fill="#8884d8"
                  paddingAngle={5}
                  dataKey="value"
                >
                  {osData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend iconType="circle" />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-4 md:p-6 rounded-xl shadow-sm border border-slate-100">
          <h3 className="text-base md:text-lg font-semibold text-slate-800 mb-4">Device Status Overview</h3>
           <div className="h-56 md:h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={statusData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tick={{fontSize: 12}} />
                <YAxis allowDecimals={false} tick={{fontSize: 12}} />
                <Tooltip cursor={{fill: '#f1f5f9'}} />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={STATUS_COLORS[entry.name] || '#cbd5e1'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Agent Configuration Card */}
      <div className="bg-slate-900 rounded-xl p-6 shadow-sm border border-slate-800 text-white">
        <div className="flex items-center gap-2 mb-6">
            <Terminal className="text-green-400" />
            <h3 className="text-lg font-semibold">Agent Connection Details</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Upload API Endpoint</label>
                <div className="flex items-center gap-2 bg-slate-800 p-3 rounded-lg border border-slate-700 group">
                    <code className="flex-1 font-mono text-sm text-green-300 truncate">
                        {apiBase}/api/upload
                    </code>
                    <button 
                        onClick={() => copyToClipboard(`${apiBase}/api/upload`, 'url')}
                        className="text-slate-400 hover:text-white transition-colors p-1"
                        title="Copy URL"
                    >
                        {copyFeedback === 'url' ? <Check size={16} /> : <Copy size={16} />}
                    </button>
                </div>
            </div>

            <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Authentication Token (x-install-token)</label>
                <div className="flex items-center gap-2 bg-slate-800 p-3 rounded-lg border border-slate-700 group">
                    <code className="flex-1 font-mono text-sm text-blue-300 truncate">
                        dxTLRLGrGg3Jh2ZujTLaavsg
                    </code>
                    <button 
                        onClick={() => copyToClipboard('dxTLRLGrGg3Jh2ZujTLaavsg', 'token')}
                        className="text-slate-400 hover:text-white transition-colors p-1"
                        title="Copy Token"
                    >
                        {copyFeedback === 'token' ? <Check size={16} /> : <Copy size={16} />}
                    </button>
                </div>
            </div>
        </div>

        <div className="mt-6 pt-6 border-t border-slate-800">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">Agent Environment Variable</label>
            <div className="bg-black/50 p-3 rounded-lg border border-slate-700 flex items-center gap-3 group">
                 <code className="flex-1 font-mono text-sm text-yellow-300 truncate">
                    GOLPAC_UPLOAD_TOKEN=dxTLRLGrGg3Jh2ZujTLaavsg
                 </code>
                 <button 
                    onClick={() => copyToClipboard('GOLPAC_UPLOAD_TOKEN=dxTLRLGrGg3Jh2ZujTLaavsg', 'env_var')}
                    className="text-slate-400 hover:text-white transition-colors p-1"
                    title="Copy Environment Variable"
                 >
                    {copyFeedback === 'env_var' ? <Check size={16} /> : <Copy size={16} />}
                 </button>
            </div>
            <p className="text-[10px] text-slate-500 mt-2">
                Set this environment variable in your agent's runtime configuration to authenticate uploads.
            </p>
        </div>
      </div>
    </div>
  );
};

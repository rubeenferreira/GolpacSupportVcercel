
import React, { useMemo } from 'react';
import { Device, DeviceStatus } from '../types';
import { APP_LATEST_VERSION } from '../constants';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend } from 'recharts';
import { Activity, Server, AlertTriangle, ShieldCheck } from 'lucide-react';

interface DashboardProps {
  devices: Device[];
}

export const Dashboard: React.FC<DashboardProps> = ({ devices }) => {
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

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-4">
      {/* KPI Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI Cards - Flat Style */}
        <div className="bg-white p-4 rounded-md border border-slate-200 flex flex-col gap-3 hover:bg-slate-50 transition-colors">
          <div className="flex items-center gap-2 text-slate-500">
             <Server size={16} />
             <span className="text-sm font-medium">Total Installs</span>
          </div>
          <p className="text-3xl font-bold text-slate-800">{stats.total}</p>
        </div>

        <div className="bg-white p-4 rounded-md border border-slate-200 flex flex-col gap-3 hover:bg-slate-50 transition-colors">
          <div className="flex items-center gap-2 text-green-600">
             <Activity size={16} />
             <span className="text-sm font-medium">Active Online</span>
          </div>
          <p className="text-3xl font-bold text-slate-800">{stats.online}</p>
        </div>

        <div className="bg-white p-4 rounded-md border border-slate-200 flex flex-col gap-3 hover:bg-slate-50 transition-colors">
          <div className="flex items-center gap-2 text-red-600">
             <AlertTriangle size={16} />
             <span className="text-sm font-medium">Critical Issues</span>
          </div>
          <p className="text-3xl font-bold text-slate-800">{stats.critical}</p>
        </div>

        <div className="bg-white p-4 rounded-md border border-slate-200 flex flex-col gap-3 hover:bg-slate-50 transition-colors">
          <div className="flex items-center gap-2 text-orange-600">
             <ShieldCheck size={16} />
             <span className="text-sm font-medium">Outdated Vers.</span>
          </div>
          <p className="text-3xl font-bold text-slate-800">{stats.outdated}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Charts */}
        <div className="bg-white p-6 rounded-md border border-slate-200">
          <h3 className="text-base font-semibold text-slate-800 mb-6 flex items-center gap-2">
            OS Distribution
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={osData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  fill="#8884d8"
                  paddingAngle={2}
                  dataKey="value"
                >
                  {osData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} strokeWidth={0} />
                  ))}
                </Pie>
                <Tooltip 
                    contentStyle={{ borderRadius: '6px', border: '1px solid #E9E9E7', boxShadow: 'none' }}
                />
                <Legend iconType="circle" />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-md border border-slate-200">
          <h3 className="text-base font-semibold text-slate-800 mb-6">Device Status Overview</h3>
           <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={statusData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E9E9E7" />
                <XAxis dataKey="name" tick={{fontSize: 12, fill: '#787774'}} axisLine={false} tickLine={false} dy={10} />
                <YAxis allowDecimals={false} tick={{fontSize: 12, fill: '#787774'}} axisLine={false} tickLine={false} dx={-10} />
                <Tooltip 
                    cursor={{fill: '#F7F7F5'}} 
                    contentStyle={{ borderRadius: '6px', border: '1px solid #E9E9E7', boxShadow: 'none' }}
                />
                <Bar dataKey="value" radius={[2, 2, 0, 0]}>
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={STATUS_COLORS[entry.name] || '#cbd5e1'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

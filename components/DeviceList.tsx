
import React, { useState } from 'react';
import { Device } from '../types';
import { Badge } from './ui/Badge';
import { Search, Monitor, Calendar, Hash, Trash2, Building2, Edit2, X, Lock } from 'lucide-react';

interface DeviceListProps {
  devices: Device[];
  companies: string[];
  onDeleteDevice: (id: string) => void;
  onAssignCompany: (id: string, company: string) => void;
  isReadOnly?: boolean;
}

export const DeviceList: React.FC<DeviceListProps> = ({ 
    devices, 
    companies, 
    onDeleteDevice, 
    onAssignCompany, 
    isReadOnly = false 
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [editingDevice, setEditingDevice] = useState<Device | null>(null);

  const filteredDevices = devices.filter(d => 
    d.hostname.toLowerCase().includes(searchTerm.toLowerCase()) ||
    d.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    d.ipAddress.includes(searchTerm) ||
    (d.company && d.company.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden flex flex-col h-full animate-in slide-in-from-bottom-4 duration-500">
      
      {/* Header & Filter */}
      <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <Monitor size={20} className="text-slate-500"/>
            {isReadOnly ? 'Assigned Devices' : 'All Devices'}
        </h2>
        <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input 
                type="text"
                placeholder="Search hostname, user..."
                className="pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 w-full sm:w-64"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
            />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600 font-medium">
                <tr>
                    <th className="px-6 py-3">Hostname</th>
                    <th className="px-6 py-3">Group / Company</th>
                    <th className="px-6 py-3">User</th>
                    <th className="px-6 py-3">OS</th>
                    <th className="px-6 py-3">App Ver.</th>
                    <th className="px-6 py-3">Status</th>
                    <th className="px-6 py-3">Last Seen</th>
                    {!isReadOnly && <th className="px-6 py-3 text-right">Actions</th>}
                </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
                {filteredDevices.map((device) => (
                    <tr key={device.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-3 font-medium text-slate-900">{device.hostname}</td>
                        <td className="px-6 py-3">
                            {device.company ? (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100">
                                    <Building2 size={10} />
                                    {device.company}
                                </span>
                            ) : (
                                <span className="text-slate-400 text-xs italic">Unassigned</span>
                            )}
                        </td>
                        <td className="px-6 py-3 text-slate-600">{device.userName}</td>
                        <td className="px-6 py-3">
                            <div className="flex items-center gap-2">
                                <Badge status={device.os} />
                                <span className="text-slate-400 text-xs hidden lg:inline">{device.osVersion}</span>
                            </div>
                        </td>
                        <td className="px-6 py-3 text-slate-600">
                           <div className="flex items-center gap-1">
                                <Hash size={12} className="text-slate-400" />
                                {device.appVersion}
                           </div>
                        </td>
                        <td className="px-6 py-3">
                            <Badge status={device.status} />
                        </td>
                        <td className="px-6 py-3 text-slate-500">
                            <div className="flex items-center gap-2">
                                <Calendar size={14} className="text-slate-400"/>
                                <span className="text-xs whitespace-nowrap">{new Date(device.lastSeen).toLocaleDateString()}</span>
                            </div>
                        </td>
                        {!isReadOnly && (
                            <td className="px-6 py-3 text-right">
                                 <div className="flex justify-end gap-1">
                                    <button 
                                        onClick={() => setEditingDevice(device)}
                                        className="text-slate-400 hover:text-brand-600 p-1.5 hover:bg-brand-50 rounded-lg transition-colors"
                                        title="Edit Group Assignment"
                                    >
                                        <Edit2 size={16} />
                                    </button>
                                    <button 
                                        onClick={() => {
                                            if(confirm('Are you sure you want to remove this device?')) {
                                                onDeleteDevice(device.id);
                                            }
                                        }}
                                        className="text-slate-400 hover:text-red-600 p-1.5 hover:bg-red-50 rounded-lg transition-colors"
                                        title="Remove Device"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                 </div>
                            </td>
                        )}
                    </tr>
                ))}
                {filteredDevices.length === 0 && (
                    <tr>
                        <td colSpan={isReadOnly ? 7 : 8} className="px-6 py-12 text-center text-slate-400">
                            {devices.length === 0 
                                ? "No devices found assigned to your company." 
                                : `No devices found matching "${searchTerm}"`}
                        </td>
                    </tr>
                )}
            </tbody>
        </table>
      </div>
      <div className="p-4 border-t border-slate-100 text-xs text-slate-400 bg-slate-50">
        Showing {filteredDevices.length} of {devices.length} devices
      </div>

      {/* Group Assignment Modal - Only renders if not read only (redundant check but safe) */}
      {!isReadOnly && editingDevice && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setEditingDevice(null)} />
              <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm relative z-10 animate-in zoom-in-95 duration-200">
                   <div className="p-5 border-b border-slate-100 flex justify-between items-center">
                       <h3 className="font-bold text-slate-800">Assign Group</h3>
                       <button onClick={() => setEditingDevice(null)} className="text-slate-400 hover:text-slate-600">
                           <X size={18} />
                       </button>
                   </div>
                   <div className="p-6">
                       <p className="text-sm text-slate-500 mb-4">
                           Assign <span className="font-semibold text-slate-800">{editingDevice.hostname}</span> to a company group:
                       </p>
                       <div className="space-y-3">
                           {companies.map(company => (
                               <button
                                   key={company}
                                   onClick={() => {
                                       onAssignCompany(editingDevice.id, company);
                                       setEditingDevice(null);
                                   }}
                                   className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-all ${
                                       editingDevice.company === company 
                                       ? 'bg-brand-50 border-brand-200 text-brand-700 ring-1 ring-brand-200' 
                                       : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                                   }`}
                               >
                                   <Building2 size={16} />
                                   <span className="font-medium">{company}</span>
                                   {editingDevice.company === company && (
                                       <span className="ml-auto text-xs bg-brand-200 text-brand-800 px-2 py-0.5 rounded-full">Current</span>
                                   )}
                               </button>
                           ))}
                           <button
                               onClick={() => {
                                   onAssignCompany(editingDevice.id, '');
                                   setEditingDevice(null);
                               }}
                               className="w-full text-xs text-slate-400 hover:text-red-500 mt-2 py-2"
                           >
                               Remove from group
                           </button>
                       </div>
                   </div>
              </div>
          </div>
      )}
    </div>
  );
};

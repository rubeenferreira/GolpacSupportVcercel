
import React, { useState, useMemo } from 'react';
import { Device, AppUsageStat, WebUsageStat } from '../types';
import { Badge } from './ui/Badge';
import { Search, Monitor, Calendar, Hash, Trash2, Building2, Edit2, X, ChevronDown, ChevronUp, Clock, Globe, PieChart as PieChartIcon, LayoutGrid, Filter, RefreshCw, User as UserIcon, Bug, Code, Eye, EyeOff, Layers, MousePointerClick, RotateCcw, AlertTriangle } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend } from 'recharts';

interface DeviceListProps {
  devices: Device[];
  companies: string[];
  onDeleteDevice: (id: string) => void;
  onAssignCompany: (id: string, company: string) => void;
  onRefreshData: () => Promise<void>;
  isReadOnly?: boolean;
}

// Aggressive list of Windows/System background processes to ignore
const SYSTEM_PROCESS_KEYWORDS = [
  'system', 'host', 'service', 'daemon', 'installer', 'update', 'helper', 
  'nvidia', 'intel', 'amd', 'asus', 'realtek', 'audio', 'sound', 'driver',
  'search', 'index', 'logi', 'razer', 'corsair', 'armoury', 'crate', 'synapse',
  'explorer', 'runtime', 'broker', 'background', 'defender', 'antimalware',
  'registry', 'spool', 'print', 'task', 'manager', 'tray', 'notification',
  'wireless', 'bluetooth', 'network', 'security', 'wmi', 'provider', 'policy',
  'local', 'session', 'console', 'window', 'desktop', 'shell', 'dts', 'gamebar',
  'xbox', 'yourphone', 'widget', 'webview', 'edgeupdate', 'crashpad', 'handler',
  // Specific noise from user feedback
  'runner', 'smss', 'mpcmdrun', 'igfx', 'dramhal', 'unsecapp', 'mousocore', 
  'presentation', 'sql', 'armsvc', 'gamesdk', 'memory', 'malwarebytes', 'tiworker', 
  'extensioncard', 'atk', 'sppsvc', 'lghub', 'nissrv', 'websocket', 'nvcontainer', 
  'adobearm', 'cleanmgr', 'vssvc', 'tabtip', 'filecoauth', 'aimgr', 'tv_', 'splwow',
  'golpac', 'rundll', 'compattel', 'officeclick', 'video.ui', 'notepad'
];

// Map ugly process names to professional titles
const PRETTY_NAMES: Record<string, string> = {
    'winword': 'Microsoft Word',
    'excel': 'Microsoft Excel',
    'powerpnt': 'Microsoft PowerPoint',
    'outlook': 'Microsoft Outlook',
    'msedge': 'Microsoft Edge',
    'chrome': 'Google Chrome',
    'brave': 'Brave Browser',
    'firefox': 'Mozilla Firefox',
    'steam': 'Steam',
    'discord': 'Discord',
    'code': 'Visual Studio Code',
    'teams': 'Microsoft Teams',
    'acrobat': 'Adobe Acrobat',
    'notepad': 'Notepad',
    'calc': 'Calculator',
    'spotify': 'Spotify',
    'officeclicktorun': 'Microsoft Office Background',
    'onenote': 'OneNote',
    'mspaint': 'Paint',
    'cmd': 'Command Prompt',
    'powershell': 'PowerShell',
    'teamviewer': 'TeamViewer',
    'onedrive': 'OneDrive'
};

// Helper to format decimal minutes into H m s
const formatDuration = (minutes: number) => {
  const safeMinutes = Number(minutes) || 0;
  if (safeMinutes === 0) return "0s";
  
  const totalSeconds = Math.round(safeMinutes * 60);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
};

// Helper to clean app names (remove .exe, capitalize, map to pretty names)
const cleanAppName = (name: string) => {
    if (!name) return 'Unknown';
    const lowerName = name.toLowerCase().replace('.exe', '');
    
    // Check dictionary first
    if (PRETTY_NAMES[lowerName]) return PRETTY_NAMES[lowerName];

    // Fallback to capitalizing first letter
    return lowerName.charAt(0).toUpperCase() + lowerName.slice(1);
};

// Helper to extract primary domain (e.g. na.myconnectwise.net -> myconnectwise.net)
const getPrimaryDomain = (domain: string) => {
    try {
        const parts = domain.split('.');
        if (parts.length > 2) {
            // Very basic: take last two parts
            return parts.slice(-2).join('.');
        }
        return domain;
    } catch {
        return domain;
    }
};

// Mock Data Generator (Fallback only)
const generateMockData = (os: string, dateRange: string) => {
  const isMac = os === 'macOS';
  
  const apps: AppUsageStat[] = isMac ? [
    { name: 'Xcode', usageMinutes: 340, percentage: 45, color: '#0ea5e9' },
    { name: 'Chrome', usageMinutes: 180, percentage: 24, color: '#8b5cf6' },
    { name: 'Slack', usageMinutes: 120, percentage: 16, color: '#f59e0b' },
    { name: 'Terminal', usageMinutes: 80, percentage: 10, color: '#64748b' },
    { name: 'Zoom', usageMinutes: 40, percentage: 5, color: '#10b981' },
  ] : [
    { name: 'Teams', usageMinutes: 240, percentage: 35, color: '#6366f1' },
    { name: 'Outlook', usageMinutes: 180, percentage: 26, color: '#0ea5e9' },
    { name: 'Excel', usageMinutes: 120, percentage: 18, color: '#10b981' },
    { name: 'Edge', usageMinutes: 90, percentage: 13, color: '#3b82f6' },
    { name: 'PowerPoint', usageMinutes: 50, percentage: 8, color: '#f97316' },
  ];

  const websites: WebUsageStat[] = [
    { domain: 'jira.atlassian.net', visits: 142, category: 'Productivity' },
    { domain: 'github.com', visits: 89, category: 'Dev' },
    { domain: 'stackoverflow.com', visits: 64, category: 'Dev' },
    { domain: 'figma.com', visits: 45, category: 'Design' },
    { domain: 'docs.google.com', visits: 32, category: 'Productivity' },
  ];

  return { apps, websites };
};

// Vibrant but professional palette
const COLORS = [
    '#3b82f6', // Bright Blue
    '#8b5cf6', // Violet
    '#10b981', // Emerald
    '#f59e0b', // Amber
    '#ec4899', // Pink
    '#06b6d4', // Cyan
    '#f97316', // Orange
    '#6366f1', // Indigo
];

const ExpandedDeviceView: React.FC<{ device: Device; onRefresh: () => Promise<void> }> = ({ device, onRefresh }) => {
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [showDebug, setShowDebug] = useState(false);
    const [showSystemApps, setShowSystemApps] = useState(false);
    
    // Logic to determine if we have real data or should simulate
    const hasRealData = (device.appUsage && device.appUsage.length > 0) || (device.webUsage && device.webUsage.length > 0);
    const isOnline = device.status === 'Online';
    const missingPayload = isOnline && !hasRealData;

    const { apps, chartApps, websites } = useMemo(() => {
        if (hasRealData) {
            // --- Process App Usage ---
            let rawApps = [...(device.appUsage || [])];
            
            // 1. Filter Logic:
            let filteredApps = rawApps;
            if (!showSystemApps) {
              filteredApps = rawApps.filter(app => {
                 const name = app.name.toLowerCase();
                 const isSystem = SYSTEM_PROCESS_KEYWORDS.some(k => name.includes(k));
                 // Filter out < 6 seconds noise OR exactly 0 usage if not showing system
                 const isMicro = app.usageMinutes < 0.1; 
                 
                 // Keep it if it's NOT system AND NOT micro
                 return !isSystem && !isMicro;
              });
            }

            // 2. Clean Names & Sort by usage (descending)
            const cleanedApps = filteredApps.map(app => ({
                ...app,
                name: cleanAppName(app.name)
            }));
            cleanedApps.sort((a, b) => b.usageMinutes - a.usageMinutes);

            // 3. Assign colors based on RANKING (Frontend override to ensure consistency)
            const displayApps = cleanedApps.map((app, idx) => ({
                ...app,
                color: COLORS[idx % COLORS.length]
            }));

            // 4. Calculate Percentages for the filtered view
            const totalMinutes = displayApps.reduce((sum, item) => sum + (item.usageMinutes || 0), 0);
            if (totalMinutes > 0) {
                displayApps.forEach(app => {
                    app.percentage = Math.round((app.usageMinutes / totalMinutes) * 100);
                });
            }

            // 5. PREPARE PIE CHART DATA (Group small items into "Others")
            let chartData: any[] = [];
            // Filter out 0 usage items from the chart entirely to look clean
            const activeApps = displayApps.filter(a => a.usageMinutes > 0);
            
            // Limit chart to top 5 + Others to prevent color mess
            if (activeApps.length > 5) {
                const top5 = activeApps.slice(0, 5);
                const others = activeApps.slice(5);
                const othersMinutes = others.reduce((sum, item) => sum + item.usageMinutes, 0);
                const othersPercentage = others.reduce((sum, item) => sum + item.percentage, 0);
                
                chartData = [...top5];
                if (othersMinutes > 0) {
                    chartData.push({
                        name: 'Others',
                        usageMinutes: othersMinutes,
                        percentage: othersPercentage,
                        color: '#94a3b8' // Grey for others
                    });
                }
            } else {
                chartData = activeApps;
            }

            // --- Process Web Usage (Group Subdomains) ---
            const rawWebs = device.webUsage || [];
            const domainMap = new Map<string, WebUsageStat>();

            rawWebs.forEach(site => {
                const primaryDomain = getPrimaryDomain(site.domain);
                const existing = domainMap.get(primaryDomain);

                // Handle legacy data where 'visits' was actually duration in ms
                let duration = site.usageMinutes || 0;
                let visits = site.visits || 0;

                // Fallback logic for old agent data
                if (visits > 1000 && duration === 0) {
                     duration = visits / 1000 / 60;
                     visits = 0; // It was time, not visits
                }

                if (existing) {
                    existing.usageMinutes = (existing.usageMinutes || 0) + duration;
                    existing.visits = (existing.visits || 0) + visits;
                } else {
                    domainMap.set(primaryDomain, {
                        domain: primaryDomain,
                        usageMinutes: duration,
                        visits: visits,
                        category: site.category
                    });
                }
            });

            // Convert map to array and sort
            const groupedWebs = Array.from(domainMap.values());
            // Sort by duration first, then visits
            groupedWebs.sort((a, b) => (b.usageMinutes || 0) - (a.usageMinutes || 0));


            return { apps: displayApps, chartApps: chartData, websites: groupedWebs };
        } else {
            // Fallback to mock data based on OS
            const mock = generateMockData(device.os, date);
            return { apps: mock.apps, chartApps: mock.apps, websites: mock.websites };
        }
    }, [device, date, hasRealData, showSystemApps]);

    const handleRefresh = async () => {
        setIsRefreshing(true);
        await onRefresh();
        setTimeout(() => setIsRefreshing(false), 500);
    };

    const handleResetAnalytics = async () => {
        if (!confirm('Are you sure? This will reset all app and web usage history to zero for this device.')) return;
        setIsRefreshing(true);
        try {
             // Logic to find API Base URL consistent with App.tsx
             const isVercel = typeof window !== 'undefined' && window.location.hostname.endsWith('.vercel.app');
             const API_BASE = isVercel ? '' : 'https://golpac-support-vcercel.vercel.app';
             
             await fetch(`${API_BASE}/api/devices?action=reset_analytics&id=${device.id}`, { method: 'DELETE' });
             await onRefresh();
        } catch (e) {
            console.error("Failed to reset", e);
            alert("Failed to reset analytics");
        } finally {
            setIsRefreshing(false);
        }
    };

    return (
        <div className="bg-slate-50 p-4 md:p-6 border-t border-slate-100 shadow-inner animate-in slide-in-from-top-2 duration-300">
            
            {/* Controls Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                <div>
                    <h3 className="text-xs md:text-sm font-bold text-slate-700 uppercase tracking-wide flex items-center gap-2">
                        <LayoutGrid size={16} className="text-brand-500"/>
                        Usage Analytics
                    </h3>
                    <p className="text-[10px] md:text-xs text-slate-500">
                        {hasRealData ? 'Live reported data' : `Simulated report for ${device.hostname}`}
                    </p>
                </div>
                
                <div className="flex flex-wrap items-center gap-2 self-end sm:self-auto">
                     {/* Debug Button */}
                    <button 
                        onClick={() => setShowDebug(!showDebug)}
                        className={`p-1.5 rounded-lg border transition-all duration-300 ${showDebug || missingPayload ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-400 border-slate-200 hover:text-slate-600'}`}
                        title="View Raw JSON Data"
                    >
                        {missingPayload ? <AlertTriangle size={16} className="text-yellow-500" /> : <Bug size={16} />}
                    </button>

                    <div className="flex items-center gap-2 bg-white p-1.5 rounded-lg border border-slate-200 shadow-sm">
                        <button 
                            onClick={handleRefresh}
                            disabled={isRefreshing}
                            className={`p-1.5 rounded-md transition-all duration-300 ${isRefreshing ? 'text-brand-500 rotate-180' : 'text-slate-400 hover:text-brand-600 hover:bg-slate-50'}`}
                            title="Refresh Analytics"
                        >
                            <RefreshCw size={16} className={isRefreshing ? "animate-spin" : ""} />
                        </button>
                        
                        <div className="w-px h-4 bg-slate-200 mx-1"></div>
                        
                        <button 
                            onClick={handleResetAnalytics}
                            disabled={isRefreshing}
                            className={`p-1.5 rounded-md transition-all duration-300 text-slate-400 hover:text-red-500 hover:bg-red-50`}
                            title="Reset Analytics Data"
                        >
                            <RotateCcw size={16} />
                        </button>

                        <div className="w-px h-4 bg-slate-200 mx-1"></div>

                        <Calendar size={16} className="text-slate-400" />
                        <span className="text-xs font-medium text-slate-600 hidden sm:inline">Date:</span>
                        <input 
                            type="date" 
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                            disabled={hasRealData} 
                            className={`text-sm text-slate-700 focus:outline-none border-none bg-transparent ${hasRealData ? 'opacity-50 cursor-not-allowed' : ''}`}
                        />
                    </div>
                </div>
            </div>

            {/* DEBUG VIEW */}
            {(showDebug || missingPayload) && (
                <div className="mb-6 bg-slate-900 rounded-xl p-4 text-slate-300 border border-slate-700 shadow-inner overflow-hidden animate-in fade-in slide-in-from-top-2">
                    <div className="flex items-center justify-between mb-2 border-b border-slate-700 pb-2">
                        <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
                            <Code size={14} />
                            RAW DATABASE RECORD (ID: {device.id})
                        </div>
                        {missingPayload && (
                            <span className="text-xs font-bold text-yellow-500 flex items-center gap-1 bg-yellow-500/10 px-2 py-0.5 rounded">
                                <AlertTriangle size={12} />
                                WARNING: Device Online but Missing Usage Payload
                            </span>
                        )}
                    </div>
                    {missingPayload && (
                        <div className="mb-3 text-[11px] text-slate-400 bg-slate-800 p-2 rounded border border-slate-700">
                            <p><strong>Diagnosis:</strong> The heartbeat is working (Last Seen is updating), but the <code>appUsage</code> array is empty or undefined.</p>
                            <p className="mt-1"><strong>Fix:</strong> Update your Client <code>sendInstallHeartbeat</code> function to await <code>invoke('get_usage_deltas')</code> and include that data in the <code>fetch</code> body.</p>
                        </div>
                    )}
                    <pre className="font-mono text-[10px] md:text-xs overflow-x-auto max-h-60 custom-scrollbar">
                        {JSON.stringify(device, null, 2)}
                    </pre>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* App Usage Chart */}
                <div className="bg-white p-4 md:p-5 rounded-xl border border-slate-200 shadow-sm">
                    <div className="flex justify-between items-center mb-4">
                        <h4 className="font-semibold text-sm md:text-base text-slate-800 flex items-center gap-2">
                            <PieChartIcon size={18} className="text-purple-500" />
                            Most Used Apps
                        </h4>
                        <button 
                            onClick={() => setShowSystemApps(!showSystemApps)}
                            className={`text-[10px] px-2 py-1 rounded-full border flex items-center gap-1 transition-colors ${showSystemApps ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-slate-50 text-slate-500 border-slate-200'}`}
                        >
                            {showSystemApps ? <Layers size={12}/> : <EyeOff size={12}/>}
                            {showSystemApps ? 'Showing All / System' : 'System Hidden'}
                        </button>
                    </div>

                    {apps.length > 0 ? (
                    <div className="flex flex-col sm:flex-row items-center gap-6">
                        {chartApps.length > 0 && (
                            <div className="h-40 w-40 md:h-48 md:w-48 shrink-0">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={chartApps}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={35}
                                            outerRadius={60}
                                            paddingAngle={5}
                                            dataKey="percentage"
                                        >
                                            {chartApps.map((entry: any, index: number) => (
                                                <Cell key={`cell-${index}`} fill={entry.color} />
                                            ))}
                                        </Pie>
                                        <RechartsTooltip formatter={(value: number) => `${value.toFixed(1)}%`} />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                        )}
                        {/* Scrollable list for ALL apps */}
                        <div className="flex-1 w-full max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                            <ul className="space-y-3">
                                {apps.map((app, idx) => (
                                    <li key={idx} className="flex items-center justify-between text-xs md:text-sm group hover:bg-slate-50 p-1 rounded-lg transition-colors">
                                        <div className="flex items-center gap-2 truncate">
                                            <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${app.usageMinutes === 0 ? 'bg-slate-300' : ''}`} style={{ backgroundColor: app.usageMinutes > 0 ? app.color : undefined }} />
                                            <span className={`font-medium truncate max-w-[100px] sm:max-w-none ${app.usageMinutes === 0 ? 'text-slate-400 italic' : 'text-slate-700'}`} title={app.name}>{app.name}</span>
                                        </div>
                                        <div className="flex items-center gap-2 md:gap-4 text-slate-500">
                                            <span className="text-[10px] md:text-xs flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded tabular-nums">
                                                <Clock size={10} /> {formatDuration(app.usageMinutes)}
                                            </span>
                                            {app.usageMinutes > 0 && <span className="font-bold w-10 text-right">{app.percentage.toFixed(0)}%</span>}
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                    ) : (
                        <div className="h-48 flex items-center justify-center text-slate-400 text-sm italic text-center px-4">
                            No significant user apps detected.<br/>
                            <span className="text-xs text-slate-300 mt-1">
                                {showSystemApps ? 'Even system processes are inactive.' : 'System processes hidden.'}
                            </span>
                        </div>
                    )}
                </div>

                {/* Web Usage List */}
                <div className="bg-white p-4 md:p-5 rounded-xl border border-slate-200 shadow-sm">
                    <h4 className="font-semibold text-sm md:text-base text-slate-800 mb-4 flex items-center gap-2">
                        <Globe size={18} className="text-blue-500" />
                        Most Viewed Websites
                    </h4>
                    {websites.length > 0 ? (
                    <div className="overflow-hidden">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-semibold">
                                <tr>
                                    <th className="px-3 py-2">Domain</th>
                                    <th className="px-3 py-2 text-right">Time Active</th>
                                    <th className="px-3 py-2 text-right">Visits</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {websites.slice(0, 10).map((site, idx) => (
                                    <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-3 py-2.5 font-medium text-slate-700 flex items-center gap-2 max-w-[150px] truncate">
                                            <img 
                                                src={`https://www.google.com/s2/favicons?domain=${site.domain}&sz=32`} 
                                                alt="" 
                                                className="w-4 h-4 opacity-70 shrink-0"
                                            />
                                            <span className="truncate">{site.domain}</span>
                                        </td>
                                        <td className="px-3 py-2.5 text-right font-mono text-slate-600 text-xs">
                                            {formatDuration(site.usageMinutes || 0)}
                                        </td>
                                        <td className="px-3 py-2.5 text-right font-mono text-slate-500 text-xs">
                                            <div className="flex items-center justify-end gap-1">
                                                <MousePointerClick size={10} />
                                                {site.visits?.toLocaleString() || 0}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    ) : (
                        <div className="h-48 flex items-center justify-center text-slate-400 text-sm italic">
                            No web usage data recorded.
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
};

export const DeviceList: React.FC<DeviceListProps> = ({ 
    devices, 
    companies, 
    onDeleteDevice, 
    onAssignCompany, 
    onRefreshData,
    isReadOnly = false 
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCompanyFilter, setSelectedCompanyFilter] = useState('');
  const [editingDevice, setEditingDevice] = useState<Device | null>(null);
  const [expandedDeviceId, setExpandedDeviceId] = useState<string | null>(null);

  const filteredDevices = devices.filter(d => {
    const matchesSearch = d.hostname.toLowerCase().includes(searchTerm.toLowerCase()) ||
    d.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    d.ipAddress.includes(searchTerm) ||
    (d.company && d.company.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesCompany = selectedCompanyFilter === '' || d.company === selectedCompanyFilter;

    return matchesSearch && matchesCompany;
  });

  const toggleExpand = (id: string) => {
      setExpandedDeviceId(prev => prev === id ? null : id);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden flex flex-col h-full animate-in slide-in-from-bottom-4 duration-500">
      
      {/* Header & Filter */}
      <div className="p-4 border-b border-slate-100 flex flex-col gap-4">
        <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Monitor size={20} className="text-slate-500"/>
                {isReadOnly ? 'Assigned Devices' : 'All Devices'}
            </h2>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-3">
            {/* Company Filter Dropdown */}
            <div className="relative w-full sm:w-auto">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Filter size={16} className="text-slate-400" />
                </div>
                <select
                    value={selectedCompanyFilter}
                    onChange={(e) => setSelectedCompanyFilter(e.target.value)}
                    className="pl-9 pr-8 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 w-full sm:w-48 appearance-none bg-white text-slate-700"
                >
                    <option value="">All Companies</option>
                    {companies.map(c => (
                        <option key={c} value={c}>{c}</option>
                    ))}
                </select>
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                    <ChevronDown size={14} className="text-slate-400" />
                </div>
            </div>

            {/* Search Input */}
            <div className="relative w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input 
                    type="text"
                    placeholder="Search hostname, user..."
                    className="pl-9 pr-4 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 w-full"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>
        </div>
      </div>

      {/* MOBILE CARD VIEW (Visible only on small screens) */}
      <div className="block md:hidden bg-slate-50/50 p-4 space-y-3">
          {filteredDevices.map(device => (
              <div key={device.id} className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                  <div 
                    className="p-4 flex items-center justify-between cursor-pointer active:bg-slate-50"
                    onClick={() => toggleExpand(device.id)}
                  >
                      <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-800">{device.hostname}</span>
                              <Badge status={device.status} />
                          </div>
                          <div className="flex items-center gap-3 text-xs text-slate-500">
                              <span className="flex items-center gap-1">
                                  <UserIcon size={12} /> {device.userName}
                              </span>
                              <span className="flex items-center gap-1">
                                  {device.os} {device.osVersion}
                              </span>
                          </div>
                          <div className="flex items-center gap-1 text-xs text-slate-400 mt-1">
                             <Building2 size={10} />
                             {device.company || 'Unassigned'}
                          </div>
                      </div>
                      <div className="text-slate-400">
                          {expandedDeviceId === device.id ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                      </div>
                  </div>
                  
                  {/* Actions Bar for Mobile Card */}
                  {!isReadOnly && expandedDeviceId !== device.id && (
                      <div className="border-t border-slate-100 flex divide-x divide-slate-100">
                          <button 
                            onClick={(e) => { e.stopPropagation(); setEditingDevice(device); }}
                            className="flex-1 py-3 text-xs font-medium text-slate-600 flex items-center justify-center gap-2 hover:bg-slate-50"
                          >
                              <Edit2 size={14} /> Assign Group
                          </button>
                          <button 
                             onClick={(e) => { 
                                 e.stopPropagation(); 
                                 if(confirm('Are you sure you want to remove this device?')) onDeleteDevice(device.id); 
                             }}
                             className="flex-1 py-3 text-xs font-medium text-red-500 flex items-center justify-center gap-2 hover:bg-red-50"
                          >
                              <Trash2 size={14} /> Remove
                          </button>
                      </div>
                  )}

                  {expandedDeviceId === device.id && (
                      <div className="border-t border-slate-100">
                           <ExpandedDeviceView device={device} onRefresh={onRefreshData} />
                           {!isReadOnly && (
                               <div className="p-4 bg-slate-50 border-t border-slate-100 flex gap-3">
                                   <button 
                                      onClick={() => setEditingDevice(device)}
                                      className="flex-1 bg-white border border-slate-200 py-2 rounded-lg text-sm font-medium text-slate-700 shadow-sm"
                                    >
                                       Edit Group
                                   </button>
                                   <button 
                                      onClick={() => { if(confirm('Delete?')) onDeleteDevice(device.id); }}
                                      className="flex-1 bg-red-50 border border-red-200 py-2 rounded-lg text-sm font-medium text-red-600 shadow-sm"
                                    >
                                       Remove
                                   </button>
                               </div>
                           )}
                      </div>
                  )}
              </div>
          ))}
          {filteredDevices.length === 0 && (
              <div className="text-center py-10 text-slate-400 text-sm">No devices found.</div>
          )}
      </div>

      {/* DESKTOP TABLE VIEW (Hidden on mobile) */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600 font-medium">
                <tr>
                    <th className="px-4 py-3 w-8"></th> {/* Expansion Chevron */}
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
                    <React.Fragment key={device.id}>
                        <tr 
                            className={`transition-colors cursor-pointer ${expandedDeviceId === device.id ? 'bg-blue-50/50' : 'hover:bg-slate-50'}`}
                            onClick={() => toggleExpand(device.id)}
                        >
                            <td className="px-4 py-3 text-slate-400">
                                {expandedDeviceId === device.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                            </td>
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
                                <td className="px-6 py-3 text-right" onClick={(e) => e.stopPropagation()}>
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
                        {expandedDeviceId === device.id && (
                            <tr>
                                <td colSpan={isReadOnly ? 8 : 9} className="p-0">
                                    <ExpandedDeviceView device={device} onRefresh={onRefreshData} />
                                </td>
                            </tr>
                        )}
                    </React.Fragment>
                ))}
                {filteredDevices.length === 0 && (
                    <tr>
                        <td colSpan={isReadOnly ? 8 : 9} className="px-6 py-12 text-center text-slate-400">
                            {devices.length === 0 
                                ? "No devices found assigned to your company." 
                                : `No devices found matching your filters.`}
                        </td>
                    </tr>
                )}
            </tbody>
        </table>
      </div>
      <div className="hidden md:block p-4 border-t border-slate-100 text-xs text-slate-400 bg-slate-50">
        Showing {filteredDevices.length} of {devices.length} devices
      </div>

      {/* Group Assignment Modal (Responsive) */}
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
                                       ? 'bg-brand-50 border-brand-200 text-brand-700' 
                                       : 'bg-white border-slate-200 text-slate-600 hover:border-brand-200 hover:shadow-sm'
                                   }`}
                               >
                                   <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                                       editingDevice.company === company ? 'border-brand-500' : 'border-slate-300'
                                   }`}>
                                       {editingDevice.company === company && <div className="w-2 h-2 rounded-full bg-brand-500" />}
                                   </div>
                                   <span className="font-medium">{company}</span>
                               </button>
                           ))}
                       </div>
                   </div>
              </div>
          </div>
      )}
    </div>
  );
};

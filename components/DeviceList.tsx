
import React, { useState, useMemo } from 'react';
import { Device, AppUsageStat, WebUsageStat, VideoRecording } from '../types';
import { Badge } from './ui/Badge';
import { Search, Monitor, Calendar, Hash, Trash2, Building2, Edit2, X, ChevronDown, ChevronUp, Clock, Globe, PieChart as PieChartIcon, LayoutGrid, Filter, RefreshCw, User as UserIcon, Bug, Code, Eye, EyeOff, Layers, MousePointerClick, RotateCcw, AlertTriangle, Image as ImageIcon, Video, PlayCircle, Download, Terminal, Copy, Check, Info } from 'lucide-react';
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
  'golpac', 'rundll', 'compattel', 'officeclick', 'video.ui', 'notepad', 'lockapp', 
  'smartscreen', 'csrss', 'lsass', 'winlogon', 'services', 'conhost'
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
    'acrord32': 'Adobe Reader',
    'photoshop': 'Adobe Photoshop',
    'illustrator': 'Adobe Illustrator',
    'calc': 'Calculator',
    'spotify': 'Spotify',
    'onenote': 'OneNote',
    'mspaint': 'Paint',
    'cmd': 'Command Prompt',
    'powershell': 'PowerShell',
    'teamviewer': 'TeamViewer',
    'onedrive': 'OneDrive'
};

// Brand Colors for Specific Apps (Overrides the generic palette)
const BRAND_COLORS: Record<string, string> = {
    'Microsoft Excel': '#107c41', // Excel Green
    'Microsoft Word': '#2b579a',  // Word Blue
    'Microsoft PowerPoint': '#d24726', // PPT Orange
    'Microsoft Outlook': '#0078d4', // Outlook Blue
    'Microsoft Teams': '#6264a7', // Teams Purple
    'Microsoft Edge': '#0078d7', // Edge Blue
    'Google Chrome': '#facc15', // Chrome Yellow/Gold
    'Brave Browser': '#f97316', // Brave Orange
    'Mozilla Firefox': '#f97316', // Firefox Orange
    'Adobe Acrobat': '#ef4444', // Adobe Red
    'Adobe Reader': '#ef4444', 
    'Adobe Photoshop': '#31a8ff',
    'Spotify': '#1db954', // Spotify Green
    'Discord': '#5865f2', // Discord Blurple
    'Steam': '#171a21', // Steam Dark
    'Visual Studio Code': '#007acc', // VS Code Blue
    'Slack': '#4a154b', // Slack Purple
    'WhatsApp': '#25d366', // WhatsApp Green
    'Zoom': '#2d8cff', // Zoom Blue
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

// Helper to clean app names
const cleanAppName = (name: string) => {
    if (!name) return 'Unknown';
    const lowerName = name.toLowerCase().replace('.exe', '');
    
    // Check dictionary first
    if (PRETTY_NAMES[lowerName]) return PRETTY_NAMES[lowerName];

    // Fallback to capitalizing first letter
    return lowerName.charAt(0).toUpperCase() + lowerName.slice(1);
};

// Helper to extract primary domain
const getPrimaryDomain = (domain: string) => {
    try {
        const parts = domain.split('.');
        if (parts.length > 2) {
            return parts.slice(-2).join('.');
        }
        return domain;
    } catch {
        return domain;
    }
};

// Vibrant palette for non-branded apps
const GENERIC_COLORS = [
    '#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ec4899', '#06b6d4', '#6366f1'
];

const ExpandedDeviceView: React.FC<{ device: Device; onRefresh: () => Promise<void> }> = ({ device, onRefresh }) => {
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [showDebug, setShowDebug] = useState(false);
    const [showSystemApps, setShowSystemApps] = useState(false);
    const [showScreenshot, setShowScreenshot] = useState(false);
    const [activeTab, setActiveTab] = useState<'overview' | 'videos'>('overview');
    
    const hasRealData = (device.appUsage && device.appUsage.length > 0) || (device.webUsage && device.webUsage.length > 0);
    const isOnline = device.status === 'Online';
    const missingPayload = isOnline && !hasRealData;
    const videos = device.videos || [];

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
                 // Filter out < 6 seconds noise
                 const isMicro = app.usageMinutes < 0.1; 
                 return !isSystem && !isMicro;
              });
            }

            // 2. Clean Names & Sort
            const cleanedApps = filteredApps.map(app => {
                const prettyName = cleanAppName(app.name);
                return {
                    ...app,
                    name: prettyName,
                    // Assign Brand Color if available, otherwise generic
                    color: BRAND_COLORS[prettyName] || GENERIC_COLORS[0] 
                };
            });
            cleanedApps.sort((a, b) => b.usageMinutes - a.usageMinutes);

            // 3. Assign generic colors to ranked items if no brand color
            const displayApps = cleanedApps.map((app, idx) => ({
                ...app,
                color: BRAND_COLORS[app.name] || GENERIC_COLORS[idx % GENERIC_COLORS.length]
            }));

            // 4. Calculate Percentages
            const totalMinutes = displayApps.reduce((sum, item) => sum + (item.usageMinutes || 0), 0);
            if (totalMinutes > 0) {
                displayApps.forEach(app => {
                    app.percentage = Math.round((app.usageMinutes / totalMinutes) * 100);
                });
            }

            // 5. Pie Chart Data
            let chartData: any[] = [];
            const activeApps = displayApps.filter(a => a.usageMinutes > 0);
            
            if (activeApps.length > 6) {
                const topItems = activeApps.slice(0, 6);
                const others = activeApps.slice(6);
                const othersMinutes = others.reduce((sum, item) => sum + item.usageMinutes, 0);
                const othersPercentage = others.reduce((sum, item) => sum + item.percentage, 0);
                
                chartData = [...topItems];
                if (othersMinutes > 0) {
                    chartData.push({
                        name: 'Others',
                        usageMinutes: othersMinutes,
                        percentage: othersPercentage,
                        color: '#94a3b8'
                    });
                }
            } else {
                chartData = activeApps;
            }

            // --- Process Web Usage ---
            const rawWebs = device.webUsage || [];
            const domainMap = new Map<string, WebUsageStat>();

            rawWebs.forEach(site => {
                const primaryDomain = getPrimaryDomain(site.domain);
                const existing = domainMap.get(primaryDomain);

                let duration = Number(site.usageMinutes) || 0;
                let visits = Number(site.visits) || 0;

                // Legacy Fallback
                if (visits > 1000 && duration === 0) {
                     duration = visits / 1000 / 60;
                     visits = 0; 
                }

                if (existing) {
                    existing.usageMinutes = (Number(existing.usageMinutes) || 0) + duration;
                    existing.visits = (Number(existing.visits) || 0) + visits;
                } else {
                    domainMap.set(primaryDomain, {
                        domain: primaryDomain,
                        usageMinutes: duration,
                        visits: visits,
                        category: site.category
                    });
                }
            });

            const groupedWebs = Array.from(domainMap.values());
            groupedWebs.sort((a, b) => (b.usageMinutes || 0) - (a.usageMinutes || 0));

            return { apps: displayApps, chartApps: chartData, websites: groupedWebs };
        } else {
            return { apps: [], chartApps: [], websites: [] };
        }
    }, [device, hasRealData, showSystemApps]);

    const handleRefresh = async () => {
        setIsRefreshing(true);
        await onRefresh();
        setTimeout(() => setIsRefreshing(false), 500);
    };

    const handleResetAnalytics = async () => {
        if (!confirm('Are you sure? This will reset all app and web usage history to zero for this device.')) return;
        setIsRefreshing(true);
        try {
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
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                <div className="flex items-center gap-4">
                    <div>
                        <h3 className="text-xs md:text-sm font-bold text-slate-700 uppercase tracking-wide flex items-center gap-2">
                            <LayoutGrid size={16} className="text-brand-500"/>
                            Usage Analytics
                        </h3>
                        <p className="text-[10px] md:text-xs text-slate-500">
                            {hasRealData ? 'Live reported data' : `Waiting for first report...`}
                        </p>
                    </div>

                    {/* Tabs */}
                    <div className="flex items-center bg-white p-1 rounded-lg border border-slate-200">
                        <button
                            onClick={() => setActiveTab('overview')}
                            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${activeTab === 'overview' ? 'bg-slate-100 text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            Overview
                        </button>
                        <button
                            onClick={() => setActiveTab('videos')}
                            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-2 ${activeTab === 'videos' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            <Video size={12} />
                            Recordings ({videos.length})
                        </button>
                    </div>
                </div>
                
                <div className="flex flex-wrap items-center gap-2 self-end sm:self-auto">
                    {device.lastScreenshot && (
                         <button 
                            onClick={() => setShowScreenshot(true)}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg border border-indigo-700 shadow-sm flex items-center gap-2 text-xs font-medium transition-all"
                         >
                             <ImageIcon size={14} />
                             View Screen
                         </button>
                    )}

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
                    </div>
                </div>
            </div>

            {/* Screenshot Modal */}
            {showScreenshot && device.lastScreenshot && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={() => setShowScreenshot(false)}>
                    <div className="bg-slate-900 p-2 rounded-xl max-w-5xl w-full max-h-[90vh] flex flex-col relative" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center px-2 py-2 mb-2 text-white">
                            <div>
                                <h3 className="font-bold text-sm">{device.hostname} - Screen Capture</h3>
                                <p className="text-xs text-slate-400">Captured: {device.lastScreenshotTime ? new Date(device.lastScreenshotTime).toLocaleString() : 'Unknown'}</p>
                            </div>
                            <button onClick={() => setShowScreenshot(false)} className="bg-white/10 hover:bg-white/20 p-2 rounded-full transition-colors">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="flex-1 overflow-auto rounded-lg bg-black border border-slate-700 flex items-center justify-center">
                            <img 
                                src={`data:image/png;base64,${device.lastScreenshot}`} 
                                alt="Screen Capture" 
                                className="max-w-full max-h-full object-contain"
                            />
                        </div>
                    </div>
                </div>
            )}

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
                                PAYLOAD EMPTY
                            </span>
                        )}
                    </div>
                    {missingPayload && (
                         <div className="mb-3 text-[11px] text-slate-400 bg-slate-800 p-2 rounded border border-slate-700">
                             <p><strong>Status:</strong> Device is ONLINE but usage data is empty.</p>
                             <p className="mt-1">The Agent is sending heartbeat but missing the usage payload.</p>
                         </div>
                    )}
                    <pre className="font-mono text-[10px] md:text-xs overflow-x-auto max-h-60 custom-scrollbar">
                        {JSON.stringify(device, null, 2)}
                    </pre>
                </div>
            )}

            {/* Content Switcher */}
            {activeTab === 'videos' ? (
                <div className="bg-white p-4 md:p-5 rounded-xl border border-slate-200 shadow-sm animate-in fade-in slide-in-from-right-2">
                    <h4 className="font-semibold text-sm md:text-base text-slate-800 mb-4 flex items-center gap-2">
                        <Video size={18} className="text-indigo-500" />
                        Uploaded Recordings
                    </h4>
                    {videos.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                            {videos.map((vid, idx) => (
                                <div key={idx} className="border border-slate-200 rounded-lg p-3 hover:border-indigo-200 transition-all group">
                                    <div className="aspect-video bg-black rounded-lg mb-2 relative overflow-hidden flex items-center justify-center">
                                        <video 
                                            src={vid.url} 
                                            controls 
                                            className="w-full h-full object-contain"
                                            preload="metadata"
                                        >
                                            Your browser does not support the video tag.
                                        </video>
                                    </div>
                                    <div className="flex justify-between items-start">
                                        <div className="overflow-hidden">
                                            <p className="text-xs font-medium text-slate-700 truncate" title={vid.filename}>{vid.filename}</p>
                                            <p className="text-[10px] text-slate-400">{new Date(vid.timestamp).toLocaleString()}</p>
                                        </div>
                                        <a href={vid.url} download className="text-slate-400 hover:text-indigo-600">
                                            <Download size={14} />
                                        </a>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="h-48 flex flex-col items-center justify-center text-slate-400 text-sm italic border-2 border-dashed border-slate-100 rounded-lg">
                            <Video size={32} className="mb-2 opacity-50" />
                            <p>No recordings uploaded yet.</p>
                            <p className="text-xs mt-1">Configure your agent to upload mp4 segments.</p>
                        </div>
                    )}
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in fade-in slide-in-from-left-2">
                    {/* App Usage */}
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
                                {showSystemApps ? 'Showing System Noise' : 'System Hidden'}
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
                            <div className="flex-1 w-full max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                                <ul className="space-y-3">
                                    {apps.map((app, idx) => (
                                        <li key={idx} className="flex items-center justify-between text-xs md:text-sm group hover:bg-slate-50 p-1 rounded-lg transition-colors">
                                            <div className="flex items-center gap-2 truncate">
                                                <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: app.color }} />
                                                <span className="font-medium truncate max-w-[100px] sm:max-w-none text-slate-700" title={app.name}>{app.name}</span>
                                            </div>
                                            <div className="flex items-center gap-2 md:gap-4 text-slate-500">
                                                <span className="text-[10px] md:text-xs flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded tabular-nums">
                                                    <Clock size={10} /> {formatDuration(app.usageMinutes)}
                                                </span>
                                                {app.percentage > 0 && <span className="font-bold w-8 text-right">{app.percentage}%</span>}
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                        ) : (
                            <div className="h-48 flex items-center justify-center text-slate-400 text-sm italic text-center px-4">
                                No significant usage detected.<br/>
                                <span className="text-xs text-slate-300 mt-1">
                                    {showSystemApps ? 'Even system processes are inactive.' : 'Waiting for focus time tracking...'}
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Web Usage */}
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
                                        <th className="px-3 py-2 text-right">Time</th>
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
                                No web usage recorded.
                            </div>
                        )}
                    </div>
                </div>
            )}
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
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState<string|null>(null);

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

  const copyToClipboard = (text: string, type: string) => {
      navigator.clipboard.writeText(text);
      setCopyFeedback(type);
      setTimeout(() => setCopyFeedback(null), 2000);
  };

  // Determine API base for display
  // Use the hardcoded user Vercel URL for localhost fallback
  const apiBase = useMemo(() => {
    if (typeof window === 'undefined') return 'https://golpac-support-vcercel.vercel.app';
    const origin = window.location.origin;
    if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
        return 'https://golpac-support-vcercel.vercel.app';
    }
    return origin;
  }, []);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden flex flex-col h-full animate-in slide-in-from-bottom-4 duration-500">
      
      {/* Header & Filter */}
      <div className="p-4 border-b border-slate-100 flex flex-col gap-4">
        <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Monitor size={20} className="text-slate-500"/>
                {isReadOnly ? 'Assigned Devices' : 'All Devices'}
            </h2>
            
            {!isReadOnly && (
                <button 
                    onClick={() => setShowConnectModal(true)}
                    className="text-xs font-medium text-brand-600 hover:text-brand-700 flex items-center gap-1 bg-brand-50 hover:bg-brand-100 px-3 py-1.5 rounded-lg border border-brand-100 transition-colors"
                >
                    <Terminal size={14} />
                    Agent Setup Info
                </button>
            )}
        </div>
        
        <div className="flex flex-col sm:flex-row gap-3">
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

      {/* MOBILE CARD VIEW */}
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
              <div className="text-center py-10 flex flex-col items-center justify-center">
                  <div className="text-slate-400 text-sm mb-4">No devices found.</div>
                  <button 
                      onClick={() => setShowConnectModal(true)}
                      className="bg-brand-600 hover:bg-brand-700 text-white px-5 py-3 rounded-xl shadow-lg shadow-brand-500/30 flex items-center gap-2 font-bold transition-all"
                  >
                      <Terminal size={18} />
                      Get Connection Info
                  </button>
              </div>
          )}
      </div>

      {/* DESKTOP TABLE VIEW */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600 font-medium">
                <tr>
                    <th className="px-4 py-3 w-8"></th>
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
                        <td colSpan={isReadOnly ? 8 : 9} className="px-6 py-12">
                             <div className="flex flex-col items-center justify-center">
                                  <div className="text-slate-400 text-sm mb-4">
                                      {devices.length === 0 
                                          ? "No devices found. Connect your first agent to get started." 
                                          : `No devices found matching your filters.`}
                                  </div>
                                  {devices.length === 0 && (
                                      <button 
                                          onClick={() => setShowConnectModal(true)}
                                          className="bg-brand-600 hover:bg-brand-700 text-white px-5 py-3 rounded-xl shadow-lg shadow-brand-500/30 flex items-center gap-2 font-bold transition-all hover:scale-105 active:scale-95"
                                      >
                                          <Terminal size={18} />
                                          Get Connection Info
                                      </button>
                                  )}
                             </div>
                        </td>
                    </tr>
                )}
            </tbody>
        </table>
      </div>
      <div className="hidden md:block p-4 border-t border-slate-100 text-xs text-slate-400 bg-slate-50">
        Showing {filteredDevices.length} of {devices.length} devices
      </div>

      {/* Group Assignment Modal */}
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

      {/* Connection Info Modal */}
      {showConnectModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setShowConnectModal(false)} />
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl relative z-10 animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
                   <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                       <div className="flex items-center gap-2">
                           <Terminal size={20} className="text-slate-700" />
                           <h3 className="font-bold text-slate-800">Backend Connection Details</h3>
                       </div>
                       <button onClick={() => setShowConnectModal(false)} className="text-slate-400 hover:text-slate-600">
                           <X size={20} />
                       </button>
                   </div>
                   <div className="p-6 overflow-y-auto">
                        <p className="text-sm text-slate-600 mb-6">
                            Use these parameters to configure your remote agents (Rust/Go) to report data to this panel.
                        </p>

                        <div className="space-y-6">
                            {/* URLs */}
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Endpoints</label>
                                <div className="bg-slate-900 rounded-lg p-3 relative group">
                                     <div className="text-xs text-slate-400 mb-1">Upload Video Route</div>
                                     <div className="font-mono text-sm text-green-400 break-all">{apiBase}/api/upload</div>
                                     <button 
                                        onClick={() => copyToClipboard(`${apiBase}/api/upload`, 'url_up')}
                                        className="absolute right-2 top-2 p-1.5 text-slate-400 hover:text-white rounded bg-white/10 opacity-0 group-hover:opacity-100 transition-all"
                                     >
                                        {copyFeedback === 'url_up' ? <Check size={14}/> : <Copy size={14}/>}
                                     </button>
                                </div>
                                <div className="bg-slate-900 rounded-lg p-3 relative group">
                                     <div className="text-xs text-slate-400 mb-1">Heartbeat / Install Route</div>
                                     <div className="font-mono text-sm text-blue-400 break-all">{apiBase}/api/install</div>
                                     <button 
                                        onClick={() => copyToClipboard(`${apiBase}/api/install`, 'url_in')}
                                        className="absolute right-2 top-2 p-1.5 text-slate-400 hover:text-white rounded bg-white/10 opacity-0 group-hover:opacity-100 transition-all"
                                     >
                                        {copyFeedback === 'url_in' ? <Check size={14}/> : <Copy size={14}/>}
                                     </button>
                                </div>
                            </div>

                            {/* AUTH */}
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Authentication</label>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="bg-slate-50 border border-slate-200 p-3 rounded-lg">
                                        <div className="text-xs text-slate-500 mb-1">Header Name</div>
                                        <div className="font-mono text-sm font-bold text-slate-800">x-install-token</div>
                                    </div>
                                    <div className="bg-slate-50 border border-slate-200 p-3 rounded-lg flex justify-between items-center group">
                                        <div>
                                            <div className="text-xs text-slate-500 mb-1">Token Value (Default)</div>
                                            <div className="font-mono text-sm font-bold text-slate-800">dxTLRLGrGg3Jh2ZujTLaavsg</div>
                                        </div>
                                        <button 
                                            onClick={() => copyToClipboard('dxTLRLGrGg3Jh2ZujTLaavsg', 'token')}
                                            className="text-slate-400 hover:text-brand-600 opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            {copyFeedback === 'token' ? <Check size={14}/> : <Copy size={14}/>}
                                        </button>
                                    </div>
                                </div>
                            </div>

                             {/* ENV VAR - ADDED FOR CONSISTENCY */}
                             <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Environment Variable</label>
                                <div className="bg-slate-900 p-3 rounded-lg border border-slate-800 flex items-center gap-3 group">
                                     <code className="flex-1 font-mono text-sm text-yellow-300 truncate">
                                        GOLPAC_UPLOAD_TOKEN=dxTLRLGrGg3Jh2ZujTLaavsg
                                     </code>
                                     <button 
                                        onClick={() => copyToClipboard('GOLPAC_UPLOAD_TOKEN=dxTLRLGrGg3Jh2ZujTLaavsg', 'env_var_modal')}
                                        className="text-slate-400 hover:text-white transition-colors p-1"
                                        title="Copy Environment Variable"
                                     >
                                        {copyFeedback === 'env_var_modal' ? <Check size={16} /> : <Copy size={16} />}
                                     </button>
                                </div>
                            </div>

                            {/* PAYLOAD SPECS */}
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Multipart Upload Spec</label>
                                <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-sm text-slate-700 space-y-2">
                                    <div className="flex gap-2">
                                        <span className="font-mono text-xs bg-slate-200 px-1.5 py-0.5 rounded">file</span>
                                        <span className="text-slate-500">Binary MP4 data</span>
                                    </div>
                                    <div className="flex gap-2">
                                        <span className="font-mono text-xs bg-slate-200 px-1.5 py-0.5 rounded">installId</span>
                                        <span className="text-slate-500">Device ID string</span>
                                    </div>
                                    <div className="flex gap-2">
                                        <span className="font-mono text-xs bg-slate-200 px-1.5 py-0.5 rounded">timestamp</span>
                                        <span className="text-slate-500">ISO 8601 Date String</span>
                                    </div>
                                    <div className="flex gap-2">
                                        <span className="font-mono text-xs bg-slate-200 px-1.5 py-0.5 rounded">filename</span>
                                        <span className="text-slate-500">Original filename</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                   </div>
              </div>
          </div>
      )}

    </div>
  );
};

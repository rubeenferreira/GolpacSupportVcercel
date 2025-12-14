
import React, { useState, useMemo } from 'react';
import { Device, AppUsageStat, WebUsageStat, VideoRecording } from '../types';
import { Badge } from './ui/Badge';
import { Search, Monitor, Calendar, Hash, Trash2, Building2, Edit2, X, ChevronDown, ChevronUp, Clock, Globe, PieChart as PieChartIcon, LayoutGrid, Filter, RefreshCw, User as UserIcon, Bug, Code, Eye, EyeOff, Layers, MousePointerClick, RotateCcw, AlertTriangle, Image as ImageIcon, Video, PlayCircle, Download, Terminal, Copy, Check, Info, ExternalLink, Play } from 'lucide-react';
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
    const [playingVideo, setPlayingVideo] = useState<VideoRecording | null>(null);
    
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
            
            {/* Video Player Modal */}
            {playingVideo && (
                <div className="fixed inset-0 z-[110] bg-black/95 backdrop-blur-md flex items-center justify-center p-0 md:p-6" onClick={() => setPlayingVideo(null)}>
                    <div 
                        className="w-full h-full md:h-auto md:max-h-[90vh] md:max-w-5xl bg-black md:rounded-2xl overflow-hidden shadow-2xl flex flex-col relative" 
                        onClick={e => e.stopPropagation()}
                    >
                         {/* Header (Mobile) / Close Button */}
                         <div className="absolute top-0 left-0 right-0 z-20 flex justify-between items-center p-4 bg-gradient-to-b from-black/80 to-transparent pointer-events-none">
                             <div className="text-white pointer-events-auto md:hidden">
                                 <h3 className="text-sm font-semibold truncate max-w-[200px]">{playingVideo.filename}</h3>
                             </div>
                             <button 
                                onClick={() => setPlayingVideo(null)} 
                                className="text-white/80 hover:text-white bg-black/40 hover:bg-black/60 p-2 rounded-full backdrop-blur-md pointer-events-auto transition-all"
                             >
                                 <X size={24} />
                             </button>
                         </div>
                         
                         {/* Player Container */}
                         <div className="flex-1 flex items-center justify-center bg-black relative">
                            <video 
                                src={playingVideo.url} 
                                className="w-full h-full object-contain" 
                                controls 
                                autoPlay 
                                playsInline
                            />
                         </div>
                         
                         {/* Footer */}
                         <div className="bg-slate-900 border-t border-slate-800 p-4 flex flex-col sm:flex-row justify-between items-center gap-4 text-white shrink-0">
                             <div className="text-center sm:text-left overflow-hidden">
                                 <p className="font-medium text-sm truncate max-w-md">{playingVideo.filename}</p>
                                 <p className="text-xs text-slate-400 flex items-center justify-center sm:justify-start gap-2">
                                     <Calendar size={12} />
                                     {new Date(playingVideo.timestamp).toLocaleString()}
                                 </p>
                             </div>
                             <div className="flex items-center gap-3">
                                 <a 
                                    href={playingVideo.url} 
                                    target="_blank"
                                    rel="noreferrer"
                                    className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-300 transition-colors flex items-center gap-2"
                                 >
                                     <ExternalLink size={14} />
                                     New Tab
                                 </a>
                                 <a 
                                    href={playingVideo.url} 
                                    download 
                                    className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-xs font-bold text-white transition-colors flex items-center gap-2"
                                 >
                                     <Download size={14} />
                                     Download
                                 </a>
                             </div>
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
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {videos.map((vid, idx) => (
                                <div key={idx} className="bg-white border border-slate-200 rounded-xl overflow-hidden hover:border-indigo-300 transition-all group shadow-sm flex flex-col">
                                    {/* Thumbnail / Player Preview */}
                                    <div 
                                        className="aspect-video bg-black relative cursor-pointer group-hover:opacity-95 transition-opacity overflow-hidden"
                                        onClick={() => setPlayingVideo(vid)}
                                    >
                                        <video 
                                            src={vid.url} 
                                            className="w-full h-full object-contain bg-slate-900"
                                            preload="metadata"
                                            playsInline
                                            muted // Essential for autoplay policies if we wanted to hover-play, but also good for performance
                                        />
                                        {/* Play Overlay */}
                                        <div className="absolute inset-0 flex items-center justify-center bg-black/10 group-hover:bg-black/30 transition-colors">
                                            <div className="bg-white/90 text-indigo-600 rounded-full p-3 shadow-xl transform scale-90 group-hover:scale-110 transition-all duration-300">
                                                 <Play size={24} fill="currentColor" className="ml-0.5" /> 
                                            </div>
                                        </div>
                                        {/* Timestamp Badge */}
                                        <div className="absolute bottom-2 right-2 bg-black/70 text-white text-[10px] px-1.5 py-0.5 rounded backdrop-blur-sm font-mono">
                                            MP4
                                        </div>
                                    </div>
                                    
                                    {/* Info Area */}
                                    <div className="p-3 flex flex-col flex-1 justify-between bg-slate-50/30">
                                        <div className="flex justify-between items-start gap-3 mb-2">
                                            <div className="min-w-0">
                                                <p className="text-sm font-semibold text-slate-700 truncate mb-1" title={vid.filename}>{vid.filename}</p>
                                                <p className="text-[10px] text-slate-500 flex items-center gap-1">
                                                    <Clock size={10} />
                                                    {new Date(vid.timestamp).toLocaleString()}
                                                </p>
                                            </div>
                                        </div>
                                        
                                        <div className="flex items-center gap-2 pt-2 border-t border-slate-100 mt-1">
                                             <button 
                                                onClick={() => setPlayingVideo(vid)}
                                                className="flex-1 flex items-center justify-center gap-1.5 bg-white border border-slate-200 hover:bg-slate-50 hover:border-indigo-200 text-slate-600 text-xs py-1.5 rounded-lg transition-colors font-medium"
                                             >
                                                <PlayCircle size={14} className="text-indigo-500"/>
                                                Play
                                             </button>
                                             <a 
                                                href={vid.url} 
                                                download 
                                                className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                                title="Download"
                                             >
                                                 <Download size={16} />
                                             </a>
                                        </div>
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
    isReadOnly 
}) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [expandedDeviceId, setExpandedDeviceId] = useState<string | null>(null);

    const filteredDevices = useMemo(() => {
        return devices.filter(d => 
            d.hostname.toLowerCase().includes(searchTerm.toLowerCase()) ||
            d.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (d.company || '').toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [devices, searchTerm]);

    const toggleExpand = (id: string) => {
        setExpandedDeviceId(expandedDeviceId === id ? null : id);
    };

    return (
        <div className="space-y-4 pb-20 md:pb-0">
            {/* Search Bar */}
            <div className="flex items-center gap-2 bg-white p-3 rounded-xl border border-slate-200 shadow-sm sticky top-[72px] z-20 md:static">
                 <Search className="text-slate-400" size={20} />
                 <input 
                    type="text"
                    placeholder="Search devices, users, or companies..."
                    className="flex-1 outline-none text-sm text-slate-700 placeholder:text-slate-400"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                 />
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                {/* Desktop Header */}
                <div className="hidden md:grid grid-cols-12 gap-4 p-4 bg-slate-50 border-b border-slate-100 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    <div className="col-span-3">Device / User</div>
                    <div className="col-span-2">Status</div>
                    <div className="col-span-2">OS & Ver</div>
                    <div className="col-span-3">Company</div>
                    <div className="col-span-2 text-right">Actions</div>
                </div>

                {/* List Items */}
                {filteredDevices.length > 0 ? (
                    <div className="divide-y divide-slate-100">
                        {filteredDevices.map(device => (
                            <React.Fragment key={device.id}>
                                <div 
                                    className={`
                                        flex flex-col md:grid md:grid-cols-12 gap-4 p-4 transition-all cursor-pointer
                                        ${expandedDeviceId === device.id ? 'bg-slate-50' : 'hover:bg-slate-50/50'}
                                    `}
                                    onClick={() => toggleExpand(device.id)}
                                >
                                    {/* Mobile Top Row */}
                                    <div className="col-span-3 flex items-center gap-3">
                                        <div className={`
                                            w-10 h-10 rounded-lg flex items-center justify-center text-slate-500 shrink-0
                                            ${device.os === 'Windows' ? 'bg-blue-50 text-blue-600' : ''}
                                            ${device.os === 'macOS' ? 'bg-purple-50 text-purple-600' : ''}
                                            ${device.os === 'Linux' ? 'bg-orange-50 text-orange-600' : ''}
                                            ${device.os === 'Unknown' ? 'bg-slate-100' : ''}
                                        `}>
                                            <Monitor size={20} />
                                        </div>
                                        <div className="overflow-hidden">
                                            <p className="font-semibold text-slate-800 text-sm truncate" title={device.hostname}>{device.hostname}</p>
                                            <p className="text-xs text-slate-500 flex items-center gap-1">
                                                <UserIcon size={10} />
                                                {device.userName}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="col-span-2 flex items-center">
                                        <Badge status={device.status} />
                                    </div>

                                    <div className="col-span-2 flex flex-col justify-center text-xs text-slate-600">
                                        <span className="font-medium">{device.os} {device.osVersion}</span>
                                        <span className="text-slate-400">v{device.appVersion}</span>
                                    </div>

                                    <div className="col-span-3 flex items-center" onClick={e => e.stopPropagation()}>
                                        {isReadOnly ? (
                                            <div className="flex items-center gap-2 text-sm text-slate-600">
                                                <Building2 size={14} className="text-slate-400"/>
                                                {device.company || <span className="text-slate-400 italic">Unassigned</span>}
                                            </div>
                                        ) : (
                                            <div className="relative group w-full max-w-[200px]">
                                                <select 
                                                    className="w-full appearance-none bg-white border border-slate-200 text-slate-700 text-xs rounded-lg py-1.5 pl-2 pr-8 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer hover:border-slate-300"
                                                    value={device.company || ''}
                                                    onChange={(e) => onAssignCompany(device.id, e.target.value)}
                                                >
                                                    <option value="" disabled>Assign Company</option>
                                                    {companies.map(c => (
                                                        <option key={c} value={c}>{c}</option>
                                                    ))}
                                                </select>
                                                <Building2 size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                            </div>
                                        )}
                                    </div>

                                    <div className="col-span-2 flex items-center justify-end gap-2" onClick={e => e.stopPropagation()}>
                                        <button 
                                            onClick={() => toggleExpand(device.id)}
                                            className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                            title="View Analytics"
                                        >
                                            {expandedDeviceId === device.id ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                                        </button>
                                        {!isReadOnly && (
                                            <button 
                                                onClick={() => {
                                                    if(confirm('Delete this device?')) onDeleteDevice(device.id);
                                                }}
                                                className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                title="Delete Device"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                                {expandedDeviceId === device.id && (
                                    <div className="border-t border-slate-100">
                                        <ExpandedDeviceView device={device} onRefresh={onRefreshData} />
                                    </div>
                                )}
                            </React.Fragment>
                        ))}
                    </div>
                ) : (
                    <div className="p-12 text-center text-slate-400">
                         <Search size={32} className="mx-auto mb-2 opacity-50" />
                         <p>No devices found.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

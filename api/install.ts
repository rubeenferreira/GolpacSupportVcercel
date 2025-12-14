
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@vercel/kv';

export default async function handler(
  request: VercelRequest,
  response: VercelResponse
) {
  // CORS Configuration: Allow all origins
  const origin = request.headers.origin || '*';
  
  response.setHeader('Access-Control-Allow-Origin', origin);
  response.setHeader('Access-Control-Allow-Credentials', 'true');
  response.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-install-token');

  if (request.method === 'OPTIONS') {
    return response.status(200).end();
  }

  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Method Not Allowed' });
  }

  const token = request.headers['x-install-token'];
  const validToken = process.env.INSTALL_TOKEN || 'dxTLRLGrGg3Jh2ZujTLaavsg';

  if (token !== validToken) {
    return response.status(401).json({ error: 'Unauthorized' });
  }

  const kvUrl = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const kvToken = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!kvUrl || !kvToken) {
    return response.status(503).json({ error: "Database not connected." });
  }

  const kv = createClient({
    url: kvUrl,
    token: kvToken,
  });

  try {
    const data = request.body;
    
    // DEBUGGING: Log the incoming payload
    console.log("Incoming Heartbeat Payload:", JSON.stringify(data).substring(0, 500));
    
    if (!data || !data.installId || !data.hostname) {
        return response.status(400).json({ error: "Missing required fields (installId, hostname)" });
    }

    const key = `device:${data.installId}`;
    await kv.sadd('device_ids', data.installId);

    // Fetch existing data
    const existingData: any = await kv.get(key) || {};

    // Normalization
    const appUsageRaw = data.appUsage || data.AppUsage || data.app_usage;
    const webUsageRaw = data.webUsage || data.webUsage || data.web_usage;
    const userName = data.userName || data.UserName || data.username || data.user;
    const osVersion = data.osVersion || data.OsVersion || data.OSVersion;
    
    // Screenshot Logic (Replace existing if provided)
    const lastScreenshot = data.lastScreenshot || existingData.lastScreenshot;
    const lastScreenshotTime = data.lastScreenshot ? new Date().toISOString() : existingData.lastScreenshotTime;

    // --- ACCUMULATION LOGIC ---

    // 1. Apps
    let mergedAppUsage = existingData.appUsage || [];
    if (Array.isArray(appUsageRaw) && appUsageRaw.length > 0) {
        const usageMap = new Map();
        
        // Load existing
        mergedAppUsage.forEach((app: any) => usageMap.set(app.name, { ...app }));
        
        // Merge incoming deltas
        appUsageRaw.forEach((incApp: any) => {
            // Helper to get minutes from various possible input fields
            const minutesIn = Number(incApp.usageMinutes) || 
                              Number(incApp.usage_minutes) || 
                              (Number(incApp.usageSeconds) / 60) || 
                              (Number(incApp.usage_seconds) / 60) || 
                              0;

            if (minutesIn > 0) {
                const existing = usageMap.get(incApp.name);
                if (existing) {
                    existing.usageMinutes = (Number(existing.usageMinutes) || 0) + minutesIn;
                } else {
                    usageMap.set(incApp.name, { 
                        name: incApp.name, 
                        usageMinutes: minutesIn,
                        color: incApp.color 
                    });
                }
            }
        });
        mergedAppUsage = Array.from(usageMap.values());
    }

    // 2. Websites
    let mergedWebUsage = existingData.webUsage || [];
    if (Array.isArray(webUsageRaw) && webUsageRaw.length > 0) {
        const webMap = new Map();
        mergedWebUsage.forEach((site: any) => webMap.set(site.domain, { ...site }));
        
        webUsageRaw.forEach((incSite: any) => {
             const existing = webMap.get(incSite.domain);
             
             let incVisits = Number(incSite.visits) || 0;
             let incMinutes = Number(incSite.usageMinutes) || 
                              Number(incSite.usage_minutes) || 
                              (Number(incSite.usageSeconds) / 60) || 
                              (Number(incSite.usage_seconds) / 60) || 
                              0;

             // Fallback for legacy agents sending milliseconds in 'visits'
             if (incVisits > 1000 && incMinutes === 0) {
                 incMinutes = incVisits / 1000 / 60; 
                 incVisits = 0; 
             }

             if (existing) {
                 existing.visits = (Number(existing.visits) || 0) + incVisits;
                 existing.usageMinutes = (Number(existing.usageMinutes) || 0) + incMinutes;
             } else {
                 webMap.set(incSite.domain, {
                     domain: incSite.domain,
                     visits: incVisits,
                     usageMinutes: incMinutes,
                     category: incSite.category || 'Browsing'
                 });
             }
        });
        mergedWebUsage = Array.from(webMap.values());
    }

    // VIDEO PROTECTION:
    // If the agent sends a payload without videos (or empty), do NOT overwrite the existing videos
    // which may have been populated by the independent /api/upload endpoint.
    const existingVideos = existingData.videos || [];
    // Only accept videos from payload if they are non-empty
    const payloadVideos = data.videos;
    const hasPayloadVideos = Array.isArray(payloadVideos) && payloadVideos.length > 0;
    
    const finalVideos = hasPayloadVideos ? payloadVideos : existingVideos;

    const updatedData = {
        ...existingData,
        ...data,
        appUsage: mergedAppUsage,
        webUsage: mergedWebUsage,
        videos: finalVideos,
        userName: userName || existingData.userName,
        osVersion: osVersion || existingData.osVersion,
        lastScreenshot: lastScreenshot,
        lastScreenshotTime: lastScreenshotTime,
        lastSeen: new Date().toISOString()
    };

    await kv.set(key, updatedData);

    return response.status(200).json({ ok: true });
  } catch (error) {
    console.error("API Error:", error);
    return response.status(500).json({ error: "Internal Server Error" });
  }
}
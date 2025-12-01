
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@vercel/kv';

export default async function handler(
  request: VercelRequest,
  response: VercelResponse
) {
  // Allow any origin to hit the install endpoint (protected by Token anyway)
  const origin = request.headers.origin || '*';

  response.setHeader('Access-Control-Allow-Origin', origin);
  response.setHeader('Access-Control-Allow-Credentials', 'true');
  response.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  response.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, x-install-token'
  );

  // Handle preflight requests
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

  // Initialize KV client
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
    console.log("Incoming Heartbeat:", JSON.stringify(data));
    
    // Basic validation
    if (!data || !data.installId || !data.hostname) {
        return response.status(400).json({ error: "Missing required fields (installId, hostname)" });
    }

    const key = `device:${data.installId}`;

    // 1. Add ID to a set of all device IDs (idempotent)
    await kv.sadd('device_ids', data.installId);

    // 2. Fetch existing data for MERGE
    const existingData: any = await kv.get(key) || {};

    // 3. Normalization (Handle Go casing)
    const appUsageRaw = data.appUsage || data.AppUsage || data.app_usage;
    const webUsageRaw = data.webUsage || data.WebUsage || data.web_usage;
    const userName = data.userName || data.UserName || data.username || data.user;
    const osVersion = data.osVersion || data.OsVersion || data.OSVersion;

    // 4. ACCUMULATION LOGIC
    // Since the agent sends DELTAS (usage since last tick) and resets, we must SUM values.
    
    // -- Apps --
    let mergedAppUsage = existingData.appUsage || [];
    if (Array.isArray(appUsageRaw) && appUsageRaw.length > 0) {
        const usageMap = new Map();
        
        // Load existing
        mergedAppUsage.forEach((app: any) => usageMap.set(app.name, { ...app }));
        
        // Merge incoming deltas
        appUsageRaw.forEach((incApp: any) => {
            const existing = usageMap.get(incApp.name);
            if (existing) {
                // Add new minutes to existing minutes
                existing.usageMinutes = (Number(existing.usageMinutes) || 0) + (Number(incApp.usageMinutes) || 0);
            } else {
                // New app detected
                usageMap.set(incApp.name, { 
                    name: incApp.name, 
                    usageMinutes: Number(incApp.usageMinutes) || 0,
                    color: incApp.color 
                });
            }
        });
        mergedAppUsage = Array.from(usageMap.values());
    }

    // -- Websites --
    let mergedWebUsage = existingData.webUsage || [];
    if (Array.isArray(webUsageRaw) && webUsageRaw.length > 0) {
        const webMap = new Map();
        mergedWebUsage.forEach((site: any) => webMap.set(site.domain, { ...site }));
        
        webUsageRaw.forEach((incSite: any) => {
             const existing = webMap.get(incSite.domain);
             if (existing) {
                 existing.visits = (Number(existing.visits) || 0) + (Number(incSite.visits) || 0);
             } else {
                 webMap.set(incSite.domain, {
                     domain: incSite.domain,
                     visits: Number(incSite.visits) || 0,
                     category: incSite.category || 'Browsing'
                 });
             }
        });
        mergedWebUsage = Array.from(webMap.values());
    }

    // 5. Construct Final Object
    const updatedData = {
        ...existingData,       // Keep old fields (company, notes, etc.)
        ...data,               // Update basic fields (IP, OS, etc)
        appUsage: mergedAppUsage, // Save the ACCUMULATED arrays
        webUsage: mergedWebUsage,
        userName: userName || existingData.userName,
        osVersion: osVersion || existingData.osVersion,
        lastSeen: new Date().toISOString()
    };

    // Store the merged object
    await kv.set(key, updatedData);

    return response.status(200).json({ ok: true });
  } catch (error) {
    console.error("API Error:", error);
    return response.status(500).json({ error: "Internal Server Error" });
  }
}

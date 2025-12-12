
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@vercel/kv';
import { list } from '@vercel/blob';

export default async function handler(
  request: VercelRequest,
  response: VercelResponse
) {
  // Dynamic CORS: Automatically allow the requesting origin if it's a Vercel app or Localhost
  const origin = request.headers.origin;
  const allowedOrigin = origin && (origin.endsWith('.vercel.app') || origin.includes('localhost')) 
    ? origin 
    : "https://golpac-support-vcercel.vercel.app"; // Fallback to production domain

  response.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  response.setHeader('Access-Control-Allow-Credentials', 'true');
  response.setHeader('Access-Control-Allow-Methods', 'GET, DELETE, PATCH, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (request.method === 'OPTIONS') return response.status(200).end();

  // Initialize KV client using the keys you provided
  const kvUrl = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const kvToken = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!kvUrl || !kvToken) {
    console.warn("Database credentials missing");
    // Return empty list to prevent frontend crash if DB isn't linked yet
    return response.status(200).json([]);
  }

  const kv = createClient({
    url: kvUrl,
    token: kvToken,
  });

  // Handle Delete Device OR Reset Analytics
  if (request.method === 'DELETE') {
      const { id, action } = request.query;
      
      if (!id || Array.isArray(id)) return response.status(400).json({ error: 'Invalid ID' });
      
      try {
          // Special Action: Reset Analytics only (keep device)
          if (action === 'reset_analytics') {
              const existingData: any = await kv.get(`device:${id}`);
              if (existingData) {
                  const resetData = {
                      ...existingData,
                      appUsage: [],
                      webUsage: []
                  };
                  await kv.set(`device:${id}`, resetData);
                  return response.status(200).json({ ok: true, message: "Analytics reset" });
              }
              return response.status(404).json({ error: "Device not found" });
          }

          // Default Action: Delete entire device
          await kv.srem('device_ids', id);
          await kv.del(`device:${id}`);
          return response.status(200).json({ ok: true });
      } catch (error) {
          console.error("Delete failed:", error);
          return response.status(500).json({ error: 'Failed to delete' });
      }
  }

  // Handle Update Device (Assign Group/Company)
  if (request.method === 'PATCH') {
      const { id, company } = request.body;
      if (!id) return response.status(400).json({ error: 'Missing Device ID' });

      try {
          const existingData: any = await kv.get(`device:${id}`);
          if (!existingData) {
              return response.status(404).json({ error: 'Device not found' });
          }

          // Merge new company data with existing data
          const updatedData = {
              ...existingData,
              company: company
          };

          await kv.set(`device:${id}`, updatedData);
          return response.status(200).json({ ok: true });
      } catch (error) {
          console.error("Update failed:", error);
          return response.status(500).json({ error: 'Failed to update device' });
      }
  }

  // Handle Get Devices
  if (request.method !== 'GET') {
    return response.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    // 1. Get all device IDs
    const ids = await kv.smembers('device_ids');
    
    if (!ids || ids.length === 0) {
        return response.status(200).json([]);
    }

    // 2. Fetch all device details from KV
    const pipeline = kv.pipeline();
    ids.forEach(id => pipeline.get(`device:${id}`));
    const results = await pipeline.exec();

    // 3. Fetch blobs from Vercel Blob Storage to find direct uploads
    // We look for files in the 'recordings/' prefix
    let blobVideos: any[] = [];
    try {
        if (process.env.BLOB_READ_WRITE_TOKEN) {
            const { blobs } = await list({ 
                prefix: 'recordings/', 
                limit: 1000, 
                token: process.env.BLOB_READ_WRITE_TOKEN 
            });
            blobVideos = blobs;
        }
    } catch (e) {
        console.error("Failed to list blobs:", e);
    }

    // 4. Map to UI format and merge videos
    const devices = results.map((data: any) => {
        if (!data) return null;
        
        // Detect OS
        let osType = 'Unknown';
        if (data.osVersion?.toLowerCase().includes('win')) osType = 'Windows';
        else if (data.osVersion?.toLowerCase().includes('mac')) osType = 'macOS';
        else if (data.osVersion?.toLowerCase().includes('nix') || data.osVersion?.toLowerCase().includes('ux')) osType = 'Linux';

        // Calculate Status based on lastSeen (Threshold: 5 minutes)
        const lastSeenDate = new Date(data.lastSeen || 0);
        const diffMinutes = (new Date().getTime() - lastSeenDate.getTime()) / 1000 / 60;
        let status = 'Offline';
        // If seen within last 5 minutes, consider Online
        if (diffMinutes < 5) status = 'Online'; 
        
        const hostname = data.hostname || 'Unknown';
        const hostnameLower = hostname.toLowerCase();

        // Find blobs that belong to this device based on folder structure: recordings/<hostname>/...
        const directUploads = blobVideos
            .filter(blob => {
                const parts = blob.pathname.split('/');
                // Check if the folder name matches the hostname (case-insensitive)
                return parts.length >= 3 && parts[1].toLowerCase() === hostnameLower;
            })
            .map(blob => {
                const filename = blob.pathname.split('/').pop() || '';
                // Try to parse timestamp from filename: YYYYMMDDTHHMMSS_video.mp4
                let timestamp = blob.uploadedAt.toISOString();
                const match = filename.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})/);
                
                if (match) {
                    // Reconstruct ISO string from compact format
                    timestamp = `${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${match[6]}Z`;
                }

                return {
                    url: blob.url,
                    timestamp: timestamp,
                    filename: filename,
                    size: blob.size
                };
            });

        // Merge KV videos with Direct Uploads (deduplicate by URL)
        const kvVideos = data.videos || [];
        const existingUrls = new Set(kvVideos.map((v: any) => v.url));
        const newUniqueVideos = directUploads.filter((v: any) => !existingUrls.has(v.url));
        
        // Combine and sort by newest first
        const allVideos = [...newUniqueVideos, ...kvVideos].sort((a: any, b: any) => 
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );

        return {
            id: data.installId,
            hostname: hostname,
            os: osType,
            osVersion: data.osVersion || 'N/A',
            appVersion: data.appVersion || '1.0.0',
            ipAddress: data.ipv4 || '0.0.0.0',
            lastSeen: data.lastSeen || new Date().toISOString(),
            status: status, 
            userId: data.userId || data.installId.substring(0, 5),
            userName: data.userName || 'System User',
            company: data.company || '', // Return the stored company
            appUsage: data.appUsage || [], // Pass through usage data
            webUsage: data.webUsage || [],  // Pass through usage data
            videos: allVideos.slice(0, 50), // Return combined videos, limit to 50
            lastScreenshot: data.lastScreenshot,
            lastScreenshotTime: data.lastScreenshotTime
        };
    })
    .filter(Boolean)
    // Sort by last seen (newest first)
    .sort((a: any, b: any) => new Date(b.lastSeen).getTime() - new Date(a.lastSeen).getTime());

    return response.status(200).json(devices);

  } catch (error) {
    console.error("API Error:", error);
    return response.status(500).json({ error: "Internal Server Error" });
  }
}

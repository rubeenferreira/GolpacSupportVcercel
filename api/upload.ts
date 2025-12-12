
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { put } from '@vercel/blob';
import { createClient } from '@vercel/kv';
import Busboy from 'busboy';

export const config = {
  api: {
    bodyParser: false, // Disable default parsing to handle streams
  },
};

export default async function handler(
  request: VercelRequest,
  response: VercelResponse
) {
  // CORS Configuration
  // If an origin is present, reflect it. Otherwise, assume server-to-server and allow *.
  // Crucially, if we allow *, we MUST NOT set Credentials to true.
  const reqOrigin = request.headers.origin;
  
  if (reqOrigin) {
      response.setHeader('Access-Control-Allow-Origin', reqOrigin);
      response.setHeader('Access-Control-Allow-Credentials', 'true');
  } else {
      response.setHeader('Access-Control-Allow-Origin', '*');
      // Do NOT set Access-Control-Allow-Credentials for wildcard origin
  }
  
  response.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-install-token');

  if (request.method === 'OPTIONS') return response.status(200).end();
  
  if (request.method !== 'POST') {
      return response.status(405).json({ error: 'Method Not Allowed' });
  }

  // Token Validation
  const token = request.headers['x-install-token'];
  const validToken = process.env.INSTALL_TOKEN || 'dxTLRLGrGg3Jh2ZujTLaavsg';
  if (token !== validToken) {
      console.error("Upload attempt with invalid token:", token);
      // Explicitly return 401, not 403, to differentiate from firewall blocks
      return response.status(401).json({ error: 'Unauthorized' });
  }

  // Database Setup
  const kvUrl = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const kvToken = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!kvUrl || !kvToken) {
      console.error("KV Database credentials missing.");
      return response.status(503).json({ error: "Database not connected." });
  }
  const kv = createClient({ url: kvUrl, token: kvToken });

  // Blob Token Check
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
      console.error("BLOB_READ_WRITE_TOKEN is missing.");
      return response.status(500).json({ error: "Storage configuration missing" });
  }

  // Parse Multipart Request
  let busboy;
  try {
      busboy = Busboy({ headers: request.headers });
  } catch (e) {
      console.error("Failed to initialize Busboy:", e);
      return response.status(400).json({ error: "Invalid multipart headers" });
  }
  
  const fields: Record<string, string> = {};
  let fileUploadPromise: Promise<any> | null = null;
  let videoUrl: string | null = null;
  let fileProcessed = false;

  console.log(`[Upload] Starting upload from ${request.headers['user-agent'] || 'unknown agent'}`);

  busboy.on('field', (name, value) => {
    fields[name] = value;
  });

  busboy.on('file', (name, file, info) => {
    fileProcessed = true;
    const { filename } = info;
    console.log(`[Upload] Stream received for file: ${filename}`);
    
    // Upload to Vercel Blob
    const uniqueName = `${Date.now()}-${Math.random().toString(36).substring(7)}-${filename}`;
    
    fileUploadPromise = put(`recordings/${uniqueName}`, file, {
      access: 'public',
      token: process.env.BLOB_READ_WRITE_TOKEN, 
    }).then((blob) => {
      videoUrl = blob.url;
      console.log(`[Upload] Blob success: ${videoUrl}`);
    }).catch(err => {
        console.error("[Upload] Blob put failed:", err);
        throw err;
    });
  });

  busboy.on('finish', async () => {
    try {
      if (!fileProcessed) {
          return response.status(400).json({ error: 'No file found in request' });
      }

      if (fileUploadPromise) await fileUploadPromise;

      const deviceId = fields['installId'] || fields['device'];
      const timestamp = fields['timestamp'] || new Date().toISOString();
      const filename = fields['filename'] || 'recording.mp4';

      if (!deviceId) {
         console.error("[Upload] Missing installId");
         return response.status(400).json({ error: 'Missing installId field' });
      }

      if (!videoUrl) {
         return response.status(500).json({ error: 'File upload failed to generate URL' });
      }

      console.log(`[Upload] Linking video to device ${deviceId}`);

      // Update Device Record in KV
      const deviceKey = `device:${deviceId}`;
      
      await kv.sadd('device_ids', deviceId);
      const existingDevice: any = await kv.get(deviceKey) || {};
      
      const newVideo = {
        url: videoUrl,
        timestamp,
        filename,
      };

      const baseDevice = {
          installId: deviceId,
          hostname: existingDevice.hostname || `Device-${deviceId.substring(0,6)}`,
          status: existingDevice.status || 'Online',
          lastSeen: new Date().toISOString(),
          appUsage: existingDevice.appUsage || [],
          webUsage: existingDevice.webUsage || [],
          ...existingDevice
      };

      const videos = [newVideo, ...(existingDevice.videos || [])].slice(0, 50);

      await kv.set(deviceKey, {
        ...baseDevice,
        videos
      });

      return response.status(200).json({ ok: true, url: videoUrl });
    } catch (error) {
      console.error("[Upload] Processing failed:", error);
      return response.status(500).json({ error: 'Internal Server Error during upload' });
    }
  });

  busboy.on('error', (error) => {
      console.error("[Upload] Busboy stream error:", error);
      response.status(500).json({ error: 'Upload stream failed' });
  });

  request.pipe(busboy);
}

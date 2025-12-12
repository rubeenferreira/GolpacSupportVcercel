
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
  // CORS Configuration - SIMPLIFIED for maximum compatibility
  // Agents/CLI tools do not use cookies/credentials, so we can safely use *
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-install-token');
  // Note: We deliberately DO NOT set Access-Control-Allow-Credentials to true when using *

  if (request.method === 'OPTIONS') return response.status(200).end();
  
  if (request.method !== 'POST') {
      return response.status(405).json({ error: 'Method Not Allowed' });
  }

  // Token Validation
  const token = request.headers['x-install-token'];
  const validToken = process.env.INSTALL_TOKEN || 'dxTLRLGrGg3Jh2ZujTLaavsg';
  if (token !== validToken) {
      console.error("[Upload] Unauthorized attempt. Token:", token ? 'HIDDEN' : 'MISSING');
      return response.status(401).json({ error: 'Unauthorized' });
  }

  // Database Setup
  const kvUrl = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const kvToken = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!kvUrl || !kvToken) {
      console.error("[Upload] KV Database credentials missing.");
      return response.status(503).json({ error: "Database not connected." });
  }
  const kv = createClient({ url: kvUrl, token: kvToken });

  // Blob Token Check
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
      console.error("[Upload] BLOB_READ_WRITE_TOKEN is missing.");
      return response.status(500).json({ error: "Storage configuration missing" });
  }

  // Parse Multipart Request
  let busboy;
  try {
      busboy = Busboy({ headers: request.headers });
  } catch (e) {
      console.error("[Upload] Failed to initialize Busboy:", e);
      return response.status(400).json({ error: "Invalid multipart headers" });
  }
  
  const fields: Record<string, string> = {};
  let fileUploadPromise: Promise<any> | null = null;
  let videoUrl: string | null = null;
  let fileProcessed = false;

  console.log(`[Upload] Incoming request from ${request.headers['user-agent'] || 'unknown agent'}`);

  busboy.on('field', (name, value) => {
    fields[name] = value;
  });

  busboy.on('file', (name, file, info) => {
    fileProcessed = true;
    const { filename, mimeType } = info;
    
    // Force MP4 if detected type is generic or missing, otherwise trust the client
    const finalContentType = (!mimeType || mimeType === 'application/octet-stream') 
        ? 'video/mp4' 
        : mimeType;

    console.log(`[Upload] Processing file: ${filename}, Type: ${finalContentType}`);
    
    const uniqueName = `${Date.now()}-${Math.random().toString(36).substring(7)}-${filename}`;
    
    fileUploadPromise = put(`recordings/${uniqueName}`, file, {
      access: 'public',
      token: process.env.BLOB_READ_WRITE_TOKEN,
      contentType: finalContentType, 
    }).then((blob) => {
      videoUrl = blob.url;
      console.log(`[Upload] Blob stored successfully: ${videoUrl}`);
    }).catch(err => {
        console.error("[Upload] Blob put failed:", err);
        throw err;
    });
  });

  busboy.on('finish', async () => {
    try {
      if (!fileProcessed) {
          console.warn("[Upload] Request finished but no file was processed.");
          return response.status(400).json({ error: 'No file found in request' });
      }

      if (fileUploadPromise) await fileUploadPromise;

      const deviceId = fields['installId'] || fields['device'];
      const timestamp = fields['timestamp'] || new Date().toISOString();
      const filename = fields['filename'] || 'recording.mp4';

      if (!deviceId) {
         console.error("[Upload] Missing installId in form fields");
         return response.status(400).json({ error: 'Missing installId field' });
      }

      if (!videoUrl) {
         console.error("[Upload] No Video URL generated (upload might have failed silently)");
         return response.status(500).json({ error: 'File upload failed to generate URL' });
      }

      console.log(`[Upload] Linking video ${videoUrl} to device ${deviceId}`);

      const deviceKey = `device:${deviceId}`;
      
      // Ensure device exists in set
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

      // Keep last 50 videos
      const videos = [newVideo, ...(existingDevice.videos || [])].slice(0, 50);

      await kv.set(deviceKey, {
        ...baseDevice,
        videos
      });

      return response.status(200).json({ ok: true, url: videoUrl });
    } catch (error) {
      console.error("[Upload] Internal Processing Error:", error);
      return response.status(500).json({ error: 'Internal Server Error during upload' });
    }
  });

  busboy.on('error', (error) => {
      console.error("[Upload] Busboy stream error:", error);
      response.status(500).json({ error: 'Upload stream failed' });
  });

  request.pipe(busboy);
}

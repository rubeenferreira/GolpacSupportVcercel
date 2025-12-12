
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
  // CORS
  const origin = request.headers.origin || '*';
  response.setHeader('Access-Control-Allow-Origin', origin);
  response.setHeader('Access-Control-Allow-Credentials', 'true');
  response.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-install-token');

  if (request.method === 'OPTIONS') return response.status(200).end();
  if (request.method !== 'POST') return response.status(405).json({ error: 'Method Not Allowed' });

  // Token Validation
  const token = request.headers['x-install-token'];
  const validToken = process.env.INSTALL_TOKEN || 'dxTLRLGrGg3Jh2ZujTLaavsg';
  if (token !== validToken) {
      console.error("Upload attempt with invalid token:", token);
      return response.status(401).json({ error: 'Unauthorized' });
  }

  // Database Setup
  const kvUrl = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const kvToken = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!kvUrl || !kvToken) {
      console.error("KV Database credentials missing in environment variables.");
      return response.status(503).json({ error: "Database not connected." });
  }
  const kv = createClient({ url: kvUrl, token: kvToken });

  // Blob Token Check
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
      console.error("BLOB_READ_WRITE_TOKEN is missing. Cannot upload files.");
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

  busboy.on('field', (name, value) => {
    fields[name] = value;
  });

  busboy.on('file', (name, file, info) => {
    fileProcessed = true;
    const { filename } = info;
    console.log(`Receiving file: ${filename}`);
    
    // Upload to Vercel Blob
    // We construct a path: recordings/<random_suffix>-<filename> to avoid collisions if multiple devices upload same filename
    const uniqueName = `${Date.now()}-${Math.random().toString(36).substring(7)}-${filename}`;
    
    fileUploadPromise = put(`recordings/${uniqueName}`, file, {
      access: 'public',
      token: process.env.BLOB_READ_WRITE_TOKEN, 
    }).then((blob) => {
      videoUrl = blob.url;
      console.log(`File uploaded to Blob: ${videoUrl}`);
    }).catch(err => {
        console.error("Blob put failed:", err);
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
         console.error("Missing installId in fields:", fields);
         return response.status(400).json({ error: 'Missing installId field' });
      }

      if (!videoUrl) {
         return response.status(500).json({ error: 'File upload failed to generate URL' });
      }

      console.log(`Linking video ${videoUrl} to device ${deviceId}`);

      // Update Device Record in KV
      const deviceKey = `device:${deviceId}`;
      
      // CRITICAL FIX: Ensure device is registered in the set, otherwise it won't show in lists
      await kv.sadd('device_ids', deviceId);

      const existingDevice: any = await kv.get(deviceKey) || {};
      
      const newVideo = {
        url: videoUrl,
        timestamp,
        filename,
      };

      // Ensure we have minimal device fields if this is the first time we see it
      const baseDevice = {
          installId: deviceId,
          hostname: existingDevice.hostname || `Device-${deviceId.substring(0,6)}`,
          status: existingDevice.status || 'Online',
          lastSeen: new Date().toISOString(),
          appUsage: existingDevice.appUsage || [],
          webUsage: existingDevice.webUsage || [],
          ...existingDevice
      };

      // Append to videos array (keep last 50)
      const videos = [newVideo, ...(existingDevice.videos || [])].slice(0, 50);

      await kv.set(deviceKey, {
        ...baseDevice,
        videos
      });

      return response.status(200).json({ ok: true, url: videoUrl });
    } catch (error) {
      console.error("Upload processing failed:", error);
      return response.status(500).json({ error: 'Internal Server Error during upload' });
    }
  });

  busboy.on('error', (error) => {
      console.error("Busboy stream error:", error);
      response.status(500).json({ error: 'Upload stream failed' });
  });

  request.pipe(busboy);
}

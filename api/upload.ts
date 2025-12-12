
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
  if (token !== validToken) return response.status(401).json({ error: 'Unauthorized' });

  // Database Setup
  const kvUrl = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const kvToken = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!kvUrl || !kvToken) return response.status(503).json({ error: "Database not connected." });
  const kv = createClient({ url: kvUrl, token: kvToken });

  // Parse Multipart Request
  const busboy = Busboy({ headers: request.headers });
  
  const fields: Record<string, string> = {};
  let fileUploadPromise: Promise<any> | null = null;
  let videoUrl: string | null = null;

  busboy.on('field', (name, value) => {
    fields[name] = value;
  });

  busboy.on('file', (name, file, info) => {
    const { filename } = info;
    // Upload to Vercel Blob
    // We construct a path: recordings/<device_id>/<timestamp>-<filename>
    // Since we might not have device_id yet (async field parsing), we use a generic name first or rely on client naming
    fileUploadPromise = put(`recordings/${filename}`, file, {
      access: 'public',
      token: process.env.BLOB_READ_WRITE_TOKEN, // Ensure this env var exists
    }).then((blob) => {
      videoUrl = blob.url;
    });
  });

  busboy.on('finish', async () => {
    try {
      if (fileUploadPromise) await fileUploadPromise;

      const deviceId = fields['installId'] || fields['device'];
      const timestamp = fields['timestamp'] || new Date().toISOString();
      const filename = fields['filename'] || 'recording.mp4';

      if (!deviceId || !videoUrl) {
         return response.status(400).json({ error: 'Missing device ID or file' });
      }

      // Update Device Record in KV
      const deviceKey = `device:${deviceId}`;
      const existingDevice: any = await kv.get(deviceKey) || {};
      
      const newVideo = {
        url: videoUrl,
        timestamp,
        filename,
      };

      // Append to videos array (keep last 50)
      const videos = [newVideo, ...(existingDevice.videos || [])].slice(0, 50);

      await kv.set(deviceKey, {
        ...existingDevice,
        videos
      });

      return response.status(200).json({ ok: true, url: videoUrl });
    } catch (error) {
      console.error("Upload processing failed:", error);
      return response.status(500).json({ error: 'Internal Server Error during upload' });
    }
  });

  busboy.on('error', (error) => {
      console.error("Busboy error:", error);
      response.status(500).json({ error: 'Upload stream failed' });
  });

  request.pipe(busboy);
}

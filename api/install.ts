import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@vercel/kv';

// The specific origin allowed to access this API
const ALLOWED_ORIGIN = "https://golpac-support-vcercel-ctw3c3cce.vercel.app";

export default async function handler(
  request: VercelRequest,
  response: VercelResponse
) {
  // Set CORS headers
  response.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
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

  // Initialize KV client with fallback to Upstash env vars
  const kvUrl = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const kvToken = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!kvUrl || !kvToken) {
    return response.status(503).json({ error: "Database not connected. Please connect Upstash or Vercel KV." });
  }

  const kv = createClient({
    url: kvUrl,
    token: kvToken,
  });

  try {
    const data = request.body;
    
    // Basic validation
    if (!data || !data.installId || !data.hostname) {
        return response.status(400).json({ error: "Missing required fields (installId, hostname)" });
    }

    // Save to Database
    // 1. Add ID to a set of all device IDs
    await kv.sadd('device_ids', data.installId);
    
    // 2. Store the device data object
    await kv.set(`device:${data.installId}`, {
      ...data,
      lastSeen: new Date().toISOString()
    });

    return response.status(200).json({ ok: true });
  } catch (error) {
    console.error("API Error:", error);
    return response.status(500).json({ error: "Internal Server Error" });
  }
}
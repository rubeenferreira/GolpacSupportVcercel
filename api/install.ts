import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(
  request: VercelRequest,
  response: VercelResponse
) {
  // CORS handling to ensure the app or other clients can call this if needed
  response.setHeader('Access-Control-Allow-Credentials', 'true');
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  response.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, x-install-token'
  );

  // Handle preflight requests
  if (request.method === 'OPTIONS') {
    return response.status(200).end();
  }

  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Method Not Allowed' });
  }

  const token = request.headers['x-install-token'];
  // Fallback to the hardcoded token for testing if env var is missing, 
  // but in production ensure INSTALL_TOKEN is set in Vercel.
  const validToken = process.env.INSTALL_TOKEN || 'dxTLRLGrGg3Jh2ZujTLaavsg';

  if (token !== validToken) {
    return response.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const data = request.body;
    
    // Basic validation
    // Payload: { installId, hostname, osVersion, ipv4, domain, appVersion, timestamp }
    if (!data || !data.installId || !data.hostname) {
        return response.status(400).json({ error: "Missing required fields (installId, hostname)" });
    }

    // TODO: PERSIST DATA HERE
    // Example with Vercel KV: 
    // await kv.hset(`device:${data.installId}`, data);
    // Example with Postgres:
    // await sql`INSERT INTO devices ...`;

    console.log('Received valid install payload:', JSON.stringify(data, null, 2));

    return response.status(200).json({ ok: true, message: "Install registered successfully" });
  } catch (error) {
    console.error("API Error:", error);
    return response.status(500).json({ error: "Internal Server Error" });
  }
}
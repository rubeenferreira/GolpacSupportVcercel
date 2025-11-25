import type { VercelRequest, VercelResponse } from '@vercel/node';

// The specific origin allowed to access this API
const ALLOWED_ORIGIN = "https://golpac-support-vcercel-ctw3c3cce.vercel.app";

export default async function handler(
  request: VercelRequest,
  response: VercelResponse
) {
  // Set CORS headers
  // When Credentials are set to true, Origin cannot be '*'
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
  // Fallback to hardcoded token if env var is missing, but prefer env var
  const validToken = process.env.INSTALL_TOKEN || 'dxTLRLGrGg3Jh2ZujTLaavsg';

  if (token !== validToken) {
    return response.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const data = request.body;
    
    // Basic validation
    if (!data || !data.installId || !data.hostname) {
        return response.status(400).json({ error: "Missing required fields (installId, hostname)" });
    }

    // Log the data (In a real app, you would save this to Vercel KV or Postgres)
    // console.log('Received install:', data);

    return response.status(200).json({ ok: true });
  } catch (error) {
    console.error("API Error:", error);
    return response.status(500).json({ error: "Internal Server Error" });
  }
}
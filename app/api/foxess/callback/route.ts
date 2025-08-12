import { NextRequest, NextResponse } from "next/server";
import { saveToken } from "@/src/db/oauth";

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code');
  if (!code) return NextResponse.json({ error: 'Missing code' }, { status: 400 });

  const tokenUrl = process.env.FOXESS_OAUTH_TOKEN_URL || "https://www.foxesscloud.com/oauth2/token";
  const clientId = process.env.FOXESS_OAUTH_CLIENT_ID || "";
  const clientSecret = process.env.FOXESS_OAUTH_CLIENT_SECRET || "";
  const redirectUri = process.env.FOXESS_OAUTH_REDIRECT || "";

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri
  });

  const res = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body
  });
  const data = await res.json();

  if (!res.ok) {
    return NextResponse.json({ error: "token exchange failed", details: data }, { status: 500 });
  }

  await saveToken("foxess", {
    access_token: data.access_token || data.token || "",
    refresh_token: data.refresh_token,
    expires_in: data.expires_in
  });

  return new NextResponse(`
    <html><body style="font-family:sans-serif;padding:24px;">
      <h3>FoxESS połączone ✅</h3>
      <p>Możesz zamknąć tę kartę i wrócić do aplikacji.</p>
      <script>setTimeout(()=>{ window.close(); }, 800);</script>
    </body></html>
  `, { headers: { "Content-Type": "text/html" } });
}

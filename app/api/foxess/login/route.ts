import { NextRequest, NextResponse } from "next/server";

export const runtime = 'edge';

export async function GET(req: NextRequest) {
  const authUrl = process.env.FOXESS_OAUTH_AUTH_URL || "https://www.foxesscloud.com/oauth2/authorize";
  const clientId = process.env.FOXESS_OAUTH_CLIENT_ID || "";
  const redirectUri = process.env.FOXESS_OAUTH_REDIRECT || "";
  const scope = "data_access";
  const state = Math.random().toString(36).slice(2);
  const url = new URL(authUrl);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("scope", scope);
  url.searchParams.set("state", state);
  return NextResponse.redirect(url.toString(), { status: 302 });
}

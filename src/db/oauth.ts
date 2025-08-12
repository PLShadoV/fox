import { prisma } from "@/src/db";
export async function getToken(provider: string) {
  return prisma.oAuthToken.findFirst({ where: { provider }, orderBy: { updatedAt: 'desc' } });
}
export async function saveToken(provider: string, token: { access_token: string; refresh_token?: string; expires_in?: number; }) {
  const expiresAt = token.expires_in ? new Date(Date.now() + token.expires_in * 1000) : null;
  return prisma.oAuthToken.create({
    data: {
      provider,
      accessToken: token.access_token,
      refreshToken: token.refresh_token || null,
      expiresAt
    }
  });
}

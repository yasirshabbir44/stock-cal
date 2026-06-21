import { PortfolioExport } from '../models/user-settings.model';

export function serializePortfolioExport(data: PortfolioExport): string {
  return JSON.stringify(data, null, 2);
}

export async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

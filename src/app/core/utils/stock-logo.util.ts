export function getStockLogoUrl(symbol: string): string {
  const normalized = symbol.trim().toUpperCase().replace('.', '-');
  return `https://financialmodelingprep.com/image-stock/${encodeURIComponent(normalized)}.png`;
}

export function getStockInitials(symbol: string): string {
  const cleaned = symbol.trim().toUpperCase();
  return cleaned.length <= 2 ? cleaned : cleaned.slice(0, 2);
}

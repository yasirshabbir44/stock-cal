import { PortfolioFacadeService } from '../services/portfolio-facade.service';
import { ToastService } from '../services/toast.service';
import { serializePortfolioExport, sha256Hex } from './file-hash.util';

export async function downloadPortfolioBackup(
  portfolio: PortfolioFacadeService,
  toast: ToastService,
): Promise<string> {
  const data = await portfolio.exportData();
  const json = serializePortfolioExport(data);
  const filename = `stockcal-backup-${new Date().toISOString().slice(0, 10)}.json`;
  const hash = await sha256Hex(json);

  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);

  toast.success('Backup exported — save the SHA-256 fingerprint in Settings to verify later');
  return hash;
}

export function downloadHoldingsCsv(portfolio: PortfolioFacadeService): void {
  const csv = portfolio.exportHoldingsCsv();
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `stockcal-holdings-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

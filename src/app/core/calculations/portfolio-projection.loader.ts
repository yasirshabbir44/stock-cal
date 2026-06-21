export type PortfolioProjectionLib = typeof import('./portfolio-projection.lib');

let cachedLib: PortfolioProjectionLib | null = null;
let loadPromise: Promise<PortfolioProjectionLib> | null = null;

export function getPortfolioProjectionLibSync(): PortfolioProjectionLib | null {
  return cachedLib;
}

export function loadPortfolioProjectionLib(): Promise<PortfolioProjectionLib> {
  if (cachedLib) {
    return Promise.resolve(cachedLib);
  }

  loadPromise ??= import('./portfolio-projection.lib').then((lib) => {
    cachedLib = lib;
    return lib;
  });

  return loadPromise;
}

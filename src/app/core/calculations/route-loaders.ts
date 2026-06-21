import type { Type } from '@angular/core';
import { loadPortfolioProjectionLib } from './portfolio-projection.loader';

export function loadRouteWithProjectionLib<T>(
  importComponent: () => Promise<Type<T>>,
  options: { waitForLib?: boolean } = {},
): () => Promise<Type<T>> {
  return () => {
    const libLoad = loadPortfolioProjectionLib();
    if (options.waitForLib) {
      return libLoad.then(() => importComponent());
    }
    void libLoad;
    return importComponent();
  };
}

export function isTrustedPageUrl(frameUrl: string, productionUrl: string, devUrl?: string): boolean {
  try {
    const candidate = new URL(frameUrl).href;
    return candidate === new URL(productionUrl).href || (!!devUrl && candidate === new URL(devUrl).href);
  } catch {
    return false;
  }
}

export function developmentUrl(isPackaged: boolean, configuredUrl?: string): string | undefined {
  if (isPackaged || !configuredUrl) return undefined;
  try {
    const url = new URL(configuredUrl);
    return url.href === 'http://127.0.0.1:5173/' ? url.href : undefined;
  } catch {
    return undefined;
  }
}

import { describe, expect, it } from 'vitest';
import { isTrustedPageUrl, developmentUrl } from './security';

const appPage = 'file:///Applications/ChessWake.app/Contents/Resources/app.asar/dist/index.html';
const devPage = 'http://127.0.0.1:5173/';

describe('renderer URL guard', () => {
  it('accepts only the app page and the configured local development page', () => {
    expect(isTrustedPageUrl(appPage, appPage, devPage)).toBe(true);
    expect(isTrustedPageUrl(devPage, appPage, devPage)).toBe(true);
    expect(isTrustedPageUrl('http://127.0.0.1:5173', appPage, devPage)).toBe(true);
  });
  it('rejects other files, routes, and remote pages', () => {
    for (const url of ['file:///etc/passwd', 'http://127.0.0.1:5173/evil', 'https://example.com/', 'about:blank']) {
      expect(isTrustedPageUrl(url, appPage, devPage)).toBe(false);
    }
  });
});

describe('development page', () => {
  it('uses the local Vite page only in an unpackaged app', () => {
    expect(developmentUrl(false, 'http://127.0.0.1:5173/')).toBe('http://127.0.0.1:5173/');
    expect(developmentUrl(true, 'http://127.0.0.1:5173/')).toBeUndefined();
    expect(developmentUrl(false, 'https://example.com/')).toBeUndefined();
  });
});

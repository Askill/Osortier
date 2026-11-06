// Kinetograph maps `@remotion/google-fonts/<Family>` onto its own downloader.
declare module '@remotion/google-fonts/*' {
  export function loadFont(
    style?: 'normal' | 'italic',
    options?: { weights?: string[]; subsets?: string[] },
  ): { fontFamily: string; waitUntilDone: () => Promise<void> };
}

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { ImageResponse } from 'next/og';

const BG = '#091422';
const FG = '#e6ecf2';
const MUTED = '#849bb0';
const PRIMARY = '#67b6ec';
const ACCENT = '#2586c9';

const logoSvg = readFileSync(join(process.cwd(), 'public/logo.svg'), 'utf-8');
const logoDataUrl = `data:image/svg+xml;base64,${Buffer.from(logoSvg).toString('base64')}`;

const FONT_TTF = {
  regular: 'https://cdn.jsdelivr.net/fontsource/fonts/inter@latest/latin-400-normal.ttf',
  bold: 'https://cdn.jsdelivr.net/fontsource/fonts/inter@latest/latin-700-normal.ttf',
  display: 'https://cdn.jsdelivr.net/fontsource/fonts/bricolage-grotesque@latest/latin-700-normal.ttf',
} as const;

interface OgFonts {
  regular: ArrayBuffer;
  bold: ArrayBuffer;
  display: ArrayBuffer;
}

let fontsPromise: Promise<OgFonts> | null = null;

function loadFonts(): Promise<OgFonts> {
  fontsPromise ??= Promise.all([
    fetch(FONT_TTF.regular).then((r) => r.arrayBuffer()),
    fetch(FONT_TTF.bold).then((r) => r.arrayBuffer()),
    fetch(FONT_TTF.display).then((r) => r.arrayBuffer()),
  ]).then(([regular, bold, display]) => ({ regular, bold, display }));

  return fontsPromise;
}

export async function brandedOgImage({ title, titleAccent, description }: { title: string; titleAccent?: string; description?: string }) {
  const fonts = await loadFonts();

  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: BG,
        backgroundImage: `linear-gradient(180deg, rgba(37, 134, 201, 0.22), rgba(37, 134, 201, 0) 55%)`,
        padding: 72,
        color: FG,
        fontFamily: 'Inter',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logoDataUrl} width={33} height={44} alt="" />
        <div
          style={{
            display: 'flex',
            fontFamily: 'Bricolage Grotesque',
            fontSize: 32,
            fontWeight: 700,
            letterSpacing: -0.8,
          }}
        >
          <div style={{ display: 'flex', color: FG }}>Typebase</div>
          <div style={{ display: 'flex', color: PRIMARY }}>.</div>
        </div>
      </div>

      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            fontSize: 84,
            fontWeight: 700,
            lineHeight: 1.05,
            letterSpacing: -2,
            maxWidth: 1000,
          }}
        >
          <div style={{ display: 'flex', color: FG }}>{title}</div>
          {titleAccent ? <div style={{ display: 'flex', color: PRIMARY }}>{titleAccent}</div> : null}
        </div>
        {description ? (
          <div
            style={{
              display: 'flex',
              marginTop: 28,
              fontSize: 32,
              fontWeight: 400,
              lineHeight: 1.35,
              color: MUTED,
              maxWidth: 1000,
            }}
          >
            {description}
          </div>
        ) : null}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', fontSize: 26, fontWeight: 400, color: MUTED }}>typebase.io</div>
        <div
          style={{
            display: 'flex',
            height: 6,
            width: 140,
            background: `linear-gradient(90deg, ${ACCENT}, ${PRIMARY})`,
            borderRadius: 999,
          }}
        />
      </div>
    </div>,
    {
      width: 1200,
      height: 630,
      headers: { 'X-Robots-Tag': 'noindex' },
      fonts: [
        { name: 'Inter', data: fonts.regular, weight: 400, style: 'normal' },
        { name: 'Inter', data: fonts.bold, weight: 700, style: 'normal' },
        { name: 'Bricolage Grotesque', data: fonts.display, weight: 700, style: 'normal' },
      ],
    }
  );
}

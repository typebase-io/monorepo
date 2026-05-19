import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { ImageResponse } from 'next/og';

const BG = '#0a111c';
const FG = '#e9eef4';
const MUTED = '#7d8da0';
const PRIMARY = '#5ab5ec';
const ACCENT = '#2586c9';

const logoSvg = readFileSync(join(process.cwd(), 'public/logo.svg'), 'utf-8');
const logoDataUrl = `data:image/svg+xml;base64,${Buffer.from(logoSvg).toString('base64')}`;

export function brandedOgImage({ title, description }: { title: string; description?: string }) {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: BG,
        backgroundImage: `radial-gradient(circle at 18% -10%, rgba(37, 134, 201, 0.42), transparent 55%)`,
        padding: 72,
        color: FG,
        fontFamily: 'sans-serif',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logoDataUrl} width={36} height={49} alt="" />
        <div
          style={{
            display: 'flex',
            fontSize: 32,
            fontWeight: 600,
            color: FG,
          }}
        >
          Typebase
        </div>
      </div>

      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          marginTop: 24,
        }}
      >
        <div
          style={{
            display: 'flex',
            fontSize: 84,
            fontWeight: 700,
            lineHeight: 1.05,
            letterSpacing: -2,
            color: FG,
            maxWidth: 1000,
          }}
        >
          {title}
        </div>
        {description ? (
          <div
            style={{
              display: 'flex',
              marginTop: 28,
              fontSize: 32,
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
        <div style={{ display: 'flex', fontSize: 26, color: MUTED }}>typebase.io</div>
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
    }
  );
}

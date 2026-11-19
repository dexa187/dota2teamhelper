import { useState } from 'react';
import type { HeroBaseData } from '../../shared/types';

interface HeroAvatarProps {
  hero: Pick<HeroBaseData, 'localizedName' | 'img' | 'primaryAttr'>;
  width?: number;
  height?: number;
  showAttrDot?: boolean;
}

const STEAM_CDN = 'https://cdn.cloudflare.steamstatic.com';

export function HeroAvatar({ hero, width = 56, height = 32, showAttrDot = false }: HeroAvatarProps) {
  const [failed, setFailed] = useState(false);

  const initials = hero.localizedName
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const src = hero.img
    ? hero.img.startsWith('http')
      ? hero.img
      : `${STEAM_CDN}${hero.img}`
    : '';

  return (
    <span className="hero-avatar" style={{ width, height }}>
      {!failed && src ? (
        <img
          src={src}
          alt={hero.localizedName}
          loading="lazy"
          onError={() => setFailed(true)}
        />
      ) : (
        <span className="hero-monogram" aria-hidden="true">
          {initials}
        </span>
      )}
      {showAttrDot && <span className={`attr-dot attr-${hero.primaryAttr}`} aria-hidden="true" />}
    </span>
  );
}

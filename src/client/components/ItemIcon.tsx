import { useState } from 'react';

interface ItemIconProps {
  name: string;
  img: string;
  cost?: number;
  small?: boolean;
}

const STEAM_CDN = 'https://cdn.cloudflare.steamstatic.com';

export function ItemIcon({ name, img, cost, small = false }: ItemIconProps) {
  const [failed, setFailed] = useState(false);

  const src = img ? (img.startsWith('http') ? img : `${STEAM_CDN}${img}`) : '';
  const initials = name
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <span
      className={`item-icon-box${small ? ' sm' : ''}`}
      title={cost ? `${name} (${cost}g)` : name}
    >
      {!failed && src ? (
        <img src={src} alt={name} loading="lazy" onError={() => setFailed(true)} />
      ) : (
        <span className="hero-monogram" style={{ fontSize: '0.68rem' }}>
          {initials}
        </span>
      )}
    </span>
  );
}

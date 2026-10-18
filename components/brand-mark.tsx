import { brand } from "@/lib/brand";

/** Configurable crest slot. Neutral monogram until an approved logo is set. */
export function BrandMark({ size = 40 }: { size?: number }) {
  if (brand.logo) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={brand.logo} alt="" width={size} height={size} className="shrink-0 rounded-md" />;
  }
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden className="shrink-0">
      <rect width="40" height="40" rx="10" fill="#123B68" />
      <path d="M11 13.5 20 9l9 4.5-9 4.5z" fill="#C9A227" />
      <path d="M14 16.5v6.2c0 2.2 2.7 4.3 6 4.3s6-2.1 6-4.3v-6.2l-6 3z" fill="#fff" />
      <path d="M29 13.5v7" stroke="#C9A227" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function BrandLockup({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <BrandMark size={compact ? 34 : 40} />
      <div className="leading-tight">
        <div className="text-[13px] font-semibold text-navy">{brand.institution}</div>
        <div className="text-xs text-muted">{brand.name}</div>
      </div>
    </div>
  );
}

export function PilotNotice() {
  if (brand.official) return null;
  return (
    <p className="text-xs text-muted">
      Pilot — not an official university service. Results shown here are for preview until the Faculty authorises the portal.
    </p>
  );
}

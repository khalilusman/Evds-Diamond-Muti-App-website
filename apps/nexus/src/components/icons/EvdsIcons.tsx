interface IconProps {
  size?: number
  stroke?: string
}

const DiamondDisc = ({ size = 48, stroke = '#1a1a2e' }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 48 48" fill="none" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="24" cy="24" r="20" stroke={stroke} strokeWidth="2" />
    <circle cx="24" cy="24" r="6" stroke={stroke} strokeWidth="2" />
    <circle cx="24" cy="24" r="2" fill={stroke} />
    {[0, 45, 90, 135, 180, 225, 270, 315].map((deg, i) => {
      const r = (deg * Math.PI) / 180
      return (
        <line key={i}
          x1={24 + 7 * Math.cos(r)} y1={24 + 7 * Math.sin(r)}
          x2={24 + 19 * Math.cos(r)} y2={24 + 19 * Math.sin(r)}
          stroke={stroke} strokeWidth="1.5" strokeOpacity="0.4"
        />
      )
    })}
    {[22.5, 67.5, 112.5, 157.5, 202.5, 247.5, 292.5, 337.5].map((deg, i) => {
      const r = (deg * Math.PI) / 180
      const cx = 24 + 20 * Math.cos(r)
      const cy = 24 + 20 * Math.sin(r)
      return (
        <rect key={i} x={cx - 2} y={cy - 2} width="4" height="4" rx="0.5"
          transform={`rotate(${deg},${cx},${cy})`} fill={stroke}
        />
      )
    })}
  </svg>
)

const BridgeCutter = ({ size = 48, stroke = '#1a1a2e' }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 48 48" fill="none" strokeLinecap="round" strokeLinejoin="round">
    <rect x="4" y="35" width="40" height="4" rx="1" stroke={stroke} strokeWidth="2" />
    <line x1="9" y1="39" x2="9" y2="45" stroke={stroke} strokeWidth="2" />
    <line x1="39" y1="39" x2="39" y2="45" stroke={stroke} strokeWidth="2" />
    <line x1="8" y1="12" x2="8" y2="35" stroke={stroke} strokeWidth="2" />
    <line x1="40" y1="12" x2="40" y2="35" stroke={stroke} strokeWidth="2" />
    <line x1="6" y1="12" x2="42" y2="12" stroke={stroke} strokeWidth="2.5" />
    <rect x="20" y="8" width="8" height="7" rx="1.5" stroke={stroke} strokeWidth="1.8" />
    <circle cx="24" cy="21" r="5.5" stroke={stroke} strokeWidth="2" />
    <circle cx="24" cy="21" r="1.5" fill={stroke} />
    <rect x="10" y="30" width="28" height="5" rx="1" stroke={stroke} strokeWidth="1.5" strokeOpacity="0.6" />
    <line x1="24" y1="26" x2="24" y2="35" stroke={stroke} strokeWidth="1.5" strokeDasharray="2 2" />
  </svg>
)

const LinearMeter = ({ size = 48, stroke = '#1a1a2e' }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 48 48" fill="none" strokeLinecap="round" strokeLinejoin="round">
    <rect x="4" y="18" width="40" height="12" rx="2" stroke={stroke} strokeWidth="2" />
    {[4, 14, 24, 34, 44].map((x, i) => (
      <line key={i} x1={x} y1="18" x2={x} y2="26" stroke={stroke} strokeWidth="2" />
    ))}
    {[9, 19, 29, 39].map((x, i) => (
      <line key={i} x1={x} y1="18" x2={x} y2="23" stroke={stroke} strokeWidth="1.2" strokeOpacity="0.5" />
    ))}
    <path d="M 10 24 L 4 24" stroke={stroke} strokeWidth="1.5" />
    <path d="M 7 21.5 L 4 24 L 7 26.5" stroke={stroke} strokeWidth="1.5" />
    <path d="M 38 24 L 44 24" stroke={stroke} strokeWidth="1.5" />
    <path d="M 41 21.5 L 44 24 L 41 26.5" stroke={stroke} strokeWidth="1.5" />
    <text x="24" y="29" textAnchor="middle" fontSize="5" fill={stroke} fontFamily="sans-serif">m</text>
  </svg>
)

const PorcelainTile = ({ size = 48, stroke = '#1a1a2e' }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 48 48" fill="none" strokeLinecap="round" strokeLinejoin="round">
    <rect x="6" y="6" width="36" height="36" rx="2" stroke={stroke} strokeWidth="2" />
    <line x1="6" y1="24" x2="42" y2="24" stroke={stroke} strokeWidth="1.5" strokeOpacity="0.35" />
    <line x1="24" y1="6" x2="24" y2="42" stroke={stroke} strokeWidth="1.5" strokeOpacity="0.35" />
    <path d="M 9 9 L 18 9 L 9 18 Z" fill={stroke} fillOpacity="0.08" />
    <line x1="9" y1="9" x2="18" y2="9" stroke={stroke} strokeWidth="1" strokeOpacity="0.3" />
    <line x1="9" y1="9" x2="9" y2="18" stroke={stroke} strokeWidth="1" strokeOpacity="0.3" />
  </svg>
)

const GraniteSlab = ({ size = 48, stroke = '#1a1a2e' }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 48 48" fill="none" strokeLinecap="round" strokeLinejoin="round">
    <rect x="6" y="10" width="34" height="28" rx="2" stroke={stroke} strokeWidth="2" />
    <path d="M 40 10 L 43 13 L 43 41 L 40 38" stroke={stroke} strokeWidth="1.5" strokeOpacity="0.5" />
    <line x1="40" y1="38" x2="43" y2="41" stroke={stroke} strokeWidth="1.5" strokeOpacity="0.5" />
    <path d="M 12 15 Q 18 22 16 30 Q 14 36 20 38" stroke={stroke} strokeWidth="1" strokeOpacity="0.2" fill="none" />
    <path d="M 22 10 Q 26 18 24 26" stroke={stroke} strokeWidth="1" strokeOpacity="0.2" fill="none" />
    {[[15, 18], [22, 25], [30, 15], [28, 32], [12, 34], [35, 24]].map(([x, y], i) => (
      <circle key={i} cx={x} cy={y} r="1" fill={stroke} fillOpacity="0.25" />
    ))}
  </svg>
)

const SerialScan = ({ size = 48, stroke = '#1a1a2e' }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 48 48" fill="none" strokeLinecap="round" strokeLinejoin="round">
    <path d="M 6 16 L 6 6 L 16 6" stroke={stroke} strokeWidth="2" />
    <path d="M 32 6 L 42 6 L 42 16" stroke={stroke} strokeWidth="2" />
    <path d="M 6 32 L 6 42 L 16 42" stroke={stroke} strokeWidth="2" />
    <path d="M 42 32 L 42 42 L 32 42" stroke={stroke} strokeWidth="2" />
    <rect x="10" y="10" width="8" height="8" rx="1" stroke={stroke} strokeWidth="1.5" />
    <rect x="30" y="10" width="8" height="8" rx="1" stroke={stroke} strokeWidth="1.5" />
    <rect x="10" y="30" width="8" height="8" rx="1" stroke={stroke} strokeWidth="1.5" />
    <rect x="12" y="12" width="4" height="4" rx="0.5" fill={stroke} fillOpacity="0.5" />
    <rect x="32" y="12" width="4" height="4" rx="0.5" fill={stroke} fillOpacity="0.5" />
    <rect x="12" y="32" width="4" height="4" rx="0.5" fill={stroke} fillOpacity="0.5" />
    <line x1="30" y1="26" x2="38" y2="26" stroke={stroke} strokeWidth="1.5" strokeOpacity="0.5" />
    <line x1="30" y1="30" x2="36" y2="30" stroke={stroke} strokeWidth="1.5" strokeOpacity="0.5" />
    <line x1="30" y1="34" x2="40" y2="34" stroke={stroke} strokeWidth="1.5" strokeOpacity="0.5" />
    <line x1="30" y1="38" x2="34" y2="38" stroke={stroke} strokeWidth="1.5" strokeOpacity="0.5" />
  </svg>
)

const WearIndicator = ({ size = 48, stroke = '#1a1a2e' }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 48 48" fill="none" strokeLinecap="round" strokeLinejoin="round">
    <path d="M 8 34 A 16 16 0 0 1 40 34" stroke={stroke} strokeWidth="2" strokeOpacity="0.2" />
    <path d="M 8 34 A 16 16 0 0 1 36 21" stroke={stroke} strokeWidth="2.5" strokeLinecap="round" />
    {[0, 30, 60, 90, 120, 150, 180].map((deg, i) => {
      const rad = ((180 - deg) * Math.PI) / 180
      const r1 = 13, r2 = 16
      return (
        <line key={i}
          x1={24 + r1 * Math.cos(rad)} y1={34 - r1 * Math.sin(rad)}
          x2={24 + r2 * Math.cos(rad)} y2={34 - r2 * Math.sin(rad)}
          stroke={stroke} strokeWidth="1.2" strokeOpacity="0.5"
        />
      )
    })}
    <circle cx="24" cy="34" r="2.5" stroke={stroke} strokeWidth="1.5" />
    <line x1="24" y1="34" x2="12" y2="22" stroke={stroke} strokeWidth="2" strokeLinecap="round" />
    <circle cx="24" cy="12" r="6" stroke={stroke} strokeWidth="1.5" strokeOpacity="0.3" />
    <circle cx="24" cy="12" r="1.5" fill={stroke} fillOpacity="0.3" />
    <text x="24" y="44" textAnchor="middle" fontSize="5.5" fill={stroke} fontFamily="sans-serif">%</text>
  </svg>
)

const JobRecord = ({ size = 48, stroke = '#1a1a2e' }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 48 48" fill="none" strokeLinecap="round" strokeLinejoin="round">
    <rect x="8" y="10" width="32" height="34" rx="3" stroke={stroke} strokeWidth="2" />
    <rect x="18" y="7" width="12" height="6" rx="2" stroke={stroke} strokeWidth="1.8" />
    <line x1="14" y1="22" x2="34" y2="22" stroke={stroke} strokeWidth="1.5" strokeOpacity="0.5" />
    <line x1="14" y1="28" x2="34" y2="28" stroke={stroke} strokeWidth="1.5" strokeOpacity="0.5" />
    <line x1="14" y1="34" x2="26" y2="34" stroke={stroke} strokeWidth="1.5" strokeOpacity="0.5" />
    <path d="M 28 32 L 31 35 L 37 29" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

const Company = ({ size = 48, stroke = '#1a1a2e' }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 48 48" fill="none" strokeLinecap="round" strokeLinejoin="round">
    <rect x="8" y="16" width="32" height="28" rx="2" stroke={stroke} strokeWidth="2" />
    <path d="M 5 18 L 24 6 L 43 18" stroke={stroke} strokeWidth="2" strokeLinejoin="round" />
    {[[13, 22], [21, 22], [29, 22], [37, 22], [13, 31], [21, 31], [29, 31], [37, 31]].map(([x, y], i) => (
      <rect key={i} x={x - 3} y={y - 3} width="6" height="6" rx="1" stroke={stroke} strokeWidth="1.3" />
    ))}
    <rect x="20" y="36" width="8" height="8" rx="1" stroke={stroke} strokeWidth="1.5" />
  </svg>
)

const SATIncident = ({ size = 48, stroke = '#1a1a2e' }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 48 48" fill="none" strokeLinecap="round" strokeLinejoin="round">
    <path
      d="M 30 8 A 10 10 0 0 0 14 20 L 6 38 A 3 3 0 0 0 10 42 L 28 34 A 10 10 0 0 0 30 8 Z"
      stroke={stroke} strokeWidth="2" fill="none"
    />
    <line x1="10" y1="36" x2="14" y2="32" stroke={stroke} strokeWidth="1.5" strokeOpacity="0.5" />
    <line x1="14" y1="39" x2="18" y2="35" stroke={stroke} strokeWidth="1.5" strokeOpacity="0.5" />
    <circle cx="32" cy="10" r="7" fill="white" stroke={stroke} strokeWidth="2" />
    <line x1="32" y1="7" x2="32" y2="12" stroke={stroke} strokeWidth="2" strokeLinecap="round" />
    <circle cx="32" cy="15" r="1" fill={stroke} />
  </svg>
)

export const DiamondDiscIcon   = DiamondDisc
export const BridgeCutterIcon  = BridgeCutter
export const LinearMeterIcon   = LinearMeter
export const WearIndicatorIcon = WearIndicator
export const SerialScanIcon    = SerialScan
export const JobRecordIcon     = JobRecord
export const CompanyIcon       = Company
export const SATIncidentIcon   = SATIncident
export const PorcelainTileIcon = PorcelainTile
export const GraniteSlabIcon   = GraniteSlab

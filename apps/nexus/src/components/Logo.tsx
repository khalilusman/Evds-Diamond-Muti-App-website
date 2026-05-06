interface LogoProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizeMap = {
  sm: 'h-8',
  md: 'h-12',
  lg: 'h-20',
}

export default function Logo({ size = 'md', className = '' }: LogoProps) {
  return (
    <img
      src="/evds-logo.png"
      alt="EVDS Diamond"
      className={`${sizeMap[size]} w-auto object-contain ${className}`}
    />
  )
}

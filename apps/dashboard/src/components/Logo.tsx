interface LogoProps {
  size?: 'sm' | 'md' | 'lg'
}

const sizes = { sm: 'h-6', md: 'h-10', lg: 'h-16' }

export default function Logo({ size = 'md' }: LogoProps) {
  return <img src="/evds-logo.png" alt="EVDS Diamond" className={sizes[size]} />
}

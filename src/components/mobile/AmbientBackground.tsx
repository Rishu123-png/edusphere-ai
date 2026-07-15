const particles = [
  { left: '7%', top: '14%', size: 3, delay: '-1s', duration: '8s' },
  { left: '18%', top: '62%', size: 2, delay: '-4s', duration: '11s' },
  { left: '31%', top: '28%', size: 4, delay: '-7s', duration: '13s' },
  { left: '44%', top: '78%', size: 2, delay: '-2s', duration: '9s' },
  { left: '58%', top: '18%', size: 3, delay: '-5s', duration: '12s' },
  { left: '70%', top: '48%', size: 2, delay: '-8s', duration: '10s' },
  { left: '83%', top: '12%', size: 4, delay: '-3s', duration: '14s' },
  { left: '92%', top: '72%', size: 3, delay: '-6s', duration: '9s' },
  { left: '12%', top: '88%', size: 2, delay: '-9s', duration: '12s' },
  { left: '52%', top: '48%', size: 2, delay: '-2s', duration: '15s' },
]

/** Decorative, GPU-light ambience used by the mobile application shell. */
export default function AmbientBackground() {
  return (
    <div className="mobile-ambient" aria-hidden="true">
      <div className="ambient-orb ambient-orb-cyan" />
      <div className="ambient-orb ambient-orb-violet" />
      <div className="ambient-grid" />
      {particles.map((particle, index) => (
        <span
          key={index}
          className="ambient-particle"
          style={{
            left: particle.left,
            top: particle.top,
            width: particle.size,
            height: particle.size,
            animationDelay: particle.delay,
            animationDuration: particle.duration,
          }}
        />
      ))}
    </div>
  )
}

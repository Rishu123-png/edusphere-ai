import { useEffect, useRef } from 'react'

type AnimationHandle = { pause?: () => void }

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
  const rootRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return
    }

    let disposed = false
    const handles: AnimationHandle[] = []

    import('animejs')
      .then(({ animate, stagger }) => {
        if (disposed || !rootRef.current) return

        const root = rootRef.current
        const particlesEls = root.querySelectorAll<HTMLElement>('.ambient-particle')
        const orbEls = root.querySelectorAll<HTMLElement>('.ambient-orb')
        const gridEl = root.querySelector<HTMLElement>('.ambient-grid')

        handles.push(
          animate(particlesEls, {
            translateY: ['0rem', '-1.05rem'],
            translateX: (_target, index) => {
              const safeIndex = index ?? 0
              return safeIndex % 2 === 0 ? ['0rem', '0.45rem'] : ['0rem', '-0.45rem']
            },
            opacity: [0.18, 0.62],
            scale: [0.82, 1.15],
            delay: stagger(140, { from: 'center' }),
            duration: 3600,
            alternate: true,
            loop: true,
            ease: 'inOutSine',
          }) as AnimationHandle,
          animate(orbEls, {
            translateY: ['0rem', '1rem'],
            translateX: (_target, index) => {
              const safeIndex = index ?? 0
              return safeIndex === 0 ? ['0rem', '0.65rem'] : ['0rem', '-0.65rem']
            },
            scale: [1, 1.08],
            opacity: [0.42, 0.62],
            duration: 6400,
            alternate: true,
            loop: true,
            ease: 'inOutQuad',
          }) as AnimationHandle,
        )

        if (gridEl) {
          handles.push(
            animate(gridEl, {
              translateY: ['0rem', '0.55rem'],
              opacity: [0.32, 0.56],
              duration: 5200,
              alternate: true,
              loop: true,
              ease: 'inOutSine',
            }) as AnimationHandle,
          )
        }
      })
      .catch(() => {
        // Ambient motion is decorative; the app should still work if the animation library fails.
      })

    return () => {
      disposed = true
      handles.forEach(handle => handle.pause?.())
    }
  }, [])

  return (
    <div ref={rootRef} className="mobile-ambient" aria-hidden="true">
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

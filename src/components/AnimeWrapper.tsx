import React, { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'

/**
 * ★ ANIME.JS v4 ANIMATION ENGINE ★
 *
 * Every interaction in the app shell runs on the real anime.js spring
 * physics engine (the same engine that powers https://animejs.com):
 *   • createSpring() — buttery, physical bounce (not CSS tweens)
 *   • stagger()      — cascading grid/list entrances
 *   • timeline-grade easing — "outExpo" page reveals
 *
 * Mobile-safe: the library is only ~9 KB gzipped, loaded lazily so first
 * paint is never blocked, respects prefers-reduced-motion, and falls back
 * to the native Web Animations API if the chunk cannot load (offline first
 * visit etc.), so animations can NEVER break the app.
 */

type AnimeV4 = typeof import('animejs')

let animeModulePromise: Promise<AnimeV4> | null = null
let reducedMotionMemo: boolean | null = null

function loadAnime(): Promise<AnimeV4> {
  if (!animeModulePromise) animeModulePromise = import('animejs')
  return animeModulePromise
}

function prefersReducedMotion(): boolean {
  if (reducedMotionMemo === null) {
    reducedMotionMemo =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
  }
  return reducedMotionMemo
}

/** anime.js 4.5 renamed createSpring → spring; support either gracefully. */
function makeSpring(mod: AnimeV4, params: { stiffness: number; damping: number; mass?: number }) {
  const anyMod = mod as unknown as Record<string, (p: typeof params) => unknown>
  return (anyMod.spring ?? anyMod.createSpring)(params)
}

/** Native WAAPI fallback (identical visual timing, zero dependencies). */
function waapiFallback(
  elements: Element[],
  keyframes: Keyframe[],
  options: (index: number) => KeyframeAnimationOptions,
) {
  elements.forEach((el, index) => (el as HTMLElement).animate(keyframes, options(index)))
}

/* ---------------------------------------------------------------------- */
/* AnimeEntrance — spring-staggered section reveal (like animejs.com hero) */
/* ---------------------------------------------------------------------- */
export function AnimeEntrance({
  children,
  delay = 55,
  duration = 640,
  translateY = [26, 0],
  scale = [0.96, 1],
  opacity = [0, 1],
}: {
  children: React.ReactNode
  delay?: number
  duration?: number
  translateY?: [number, number]
  scale?: [number, number]
  opacity?: [number, number]
}) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container || prefersReducedMotion()) return
    const targets = Array.from(container.children) as HTMLElement[]
    if (!targets.length) return

    // Set the hidden state synchronously so there is no first-paint flash.
    targets.forEach(el => {
      el.style.opacity = String(opacity[0])
      el.style.transform = `translateY(${translateY[0]}px) scale(${scale[0]})`
      el.style.willChange = 'transform, opacity'
    })

    let cancelled = false
    let animation: { cancel?: () => void } | null = null

    loadAnime()
      .then((mod) => {
        if (cancelled) return
        const { animate, stagger } = mod
        const spring = makeSpring(mod, { stiffness: 150, damping: 14, mass: 1 })
        animation = animate(targets, {
          opacity: [opacity[0], opacity[1]],
          translateY: [translateY[0], translateY[1]],
          scale: [scale[0], scale[1]],
          delay: stagger(delay),
          ease: spring as never,
          autoplay: true,
          onComplete: () => {
            targets.forEach(el => { el.style.willChange = '' })
          },
        })
      })
      .catch(() => {
        if (cancelled) return
        waapiFallback(
          targets,
          [
            { opacity: opacity[0], transform: `translateY(${translateY[0]}px) scale(${scale[0]})` },
            { opacity: opacity[1], transform: `translateY(${translateY[1]}px) scale(${scale[1]})` },
          ],
          index => ({
            duration,
            delay: index * delay,
            easing: 'cubic-bezier(0.34, 1.3, 0.64, 1)',
            fill: 'both',
          }),
        )
      })

    return () => {
      cancelled = true
      animation?.cancel?.()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return <div ref={containerRef} className="contents">{children}</div>
}

/* ---------------------------------------------------------------------- */
/* AnimeStaggerList — reveals list items when scrolled into view (mobile)  */
/* ---------------------------------------------------------------------- */
export function AnimeStaggerList({
  children,
  selector = '.stagger-item',
  delay = 60,
  duration = 520,
}: {
  children: React.ReactNode
  selector?: string
  delay?: number
  duration?: number
}) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container || prefersReducedMotion()) return

    const targets = Array.from(container.querySelectorAll<HTMLElement>(selector))
    if (!targets.length) return

    targets.forEach(el => {
      el.style.opacity = '0'
      el.style.transform = 'translateY(16px) scale(0.98)'
    })

    let cancelled = false
    let played = false

    const play = () => {
      if (played || cancelled) return
      played = true
      loadAnime()
        .then((mod) => {
          if (cancelled) return
          const { animate, stagger } = mod
          const spring = makeSpring(mod, { stiffness: 130, damping: 13, mass: 1 })
          animate(targets, {
            opacity: [0, 1],
            translateY: [16, 0],
            scale: [0.98, 1],
            delay: stagger(delay),
            ease: spring as never,
          })
        })
        .catch(() => {
          if (cancelled) return
          waapiFallback(
            targets,
            [
              { opacity: 0, transform: 'translateY(16px) scale(0.98)' },
              { opacity: 1, transform: 'translateY(0) scale(1)' },
            ],
            index => ({
              duration,
              delay: index * delay,
              easing: 'cubic-bezier(0.25, 1, 0.5, 1)',
              fill: 'both',
            }),
          )
        })
    }

    // Scroll-triggered reveal (like animejs.com Scroll Observer) — when the
    // list enters the viewport it plays once; small lists play immediately.
    if (targets.length <= 4 || typeof IntersectionObserver === 'undefined') {
      play()
      return
    }
    const observer = new IntersectionObserver(
      entries => {
        if (entries.some(entry => entry.isIntersecting)) {
          play()
          observer.disconnect()
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.05 },
    )
    observer.observe(container)

    return () => {
      cancelled = true
      observer.disconnect()
    }
  }, [children, selector, delay, duration])

  return <div ref={containerRef} className="contents">{children}</div>
}

/* ---------------------------------------------------------------------- */
/* AnimeBounceClick — anime.js spring press physics for taps/clicks        */
/* ---------------------------------------------------------------------- */
export function AnimeBounceClick({
  children,
  className,
  scale = 0.93,
  duration = 180,
}: {
  children: React.ReactElement
  className?: string
  scale?: number
  duration?: number
}) {
  const elementRef = useRef<HTMLDivElement>(null)
  const activeAnimationRef = useRef<{ cancel?: () => void } | null>(null)

  useEffect(() => {
    return () => activeAnimationRef.current?.cancel?.()
  }, [])

  const runSpring = async (targetScale: number, release: boolean) => {
    const el = elementRef.current
    if (!el || prefersReducedMotion()) return
    activeAnimationRef.current?.cancel?.()
    try {
      const mod = await loadAnime()
      if (!elementRef.current) return
      const { animate } = mod
      const spring = makeSpring(
        mod,
        release
          ? { stiffness: 380, damping: 14, mass: 1 }   // juicy pop-out
          : { stiffness: 500, damping: 22, mass: 0.9 }, // snappy press-in
      )
      activeAnimationRef.current = animate(el, {
        scale: targetScale,
        ease: spring as never,
      })
    } catch {
      const animation = el.animate([{ transform: 'scale(1)' }, { transform: `scale(${targetScale})` }], {
        duration: release ? duration * 2 : duration / 2,
        easing: release ? 'cubic-bezier(0.34, 1.56, 0.64, 1)' : 'cubic-bezier(0.25, 1, 0.5, 1)',
        fill: 'forwards',
      })
      activeAnimationRef.current = { cancel: () => animation.cancel() }
    }
  }

  const handlePress = () => void runSpring(scale, false)
  const handleRelease = () => void runSpring(1, true)

  return (
    <div
      ref={elementRef}
      className={className}
      onPointerDown={handlePress}
      onPointerUp={handleRelease}
      onPointerLeave={handleRelease}
      onPointerCancel={handleRelease}
    >
      {children}
    </div>
  )
}

/* ---------------------------------------------------------------------- */
/* AnimePageTransition — silky outExpo route reveal                        */
/* ---------------------------------------------------------------------- */
export function AnimePageTransition({ children }: { children: React.ReactNode }) {
  const location = useLocation()
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el || prefersReducedMotion()) return

    el.style.opacity = '0'
    el.style.transform = 'translateY(10px)'

    let cancelled = false
    let animation: { cancel?: () => void } | null = null

    loadAnime()
      .then(({ animate }) => {
        if (cancelled) return
        animation = animate(el, {
          opacity: [0, 1],
          translateY: [10, 0],
          duration: 380,
          ease: 'outExpo',
        })
      })
      .catch(() => {
        if (cancelled) return
        el.animate(
          [
            { opacity: 0, transform: 'translateY(10px)' },
            { opacity: 1, transform: 'translateY(0)' },
          ],
          { duration: 380, easing: 'cubic-bezier(0.16, 1, 0.3, 1)', fill: 'both' },
        )
      })

    return () => {
      cancelled = true
      animation?.cancel?.()
    }
  }, [location.pathname])

  return (
    <div ref={containerRef} className="w-full">
      {children}
    </div>
  )
}

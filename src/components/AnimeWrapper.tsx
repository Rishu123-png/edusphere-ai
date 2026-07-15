import React, { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'

/**
 * Animates elements on mount with a beautiful fade and slide up stagger.
 * Uses hardware-accelerated native Web Animations API (WAAPI) for 0KB bundle size & max mobile performance.
 */
export function AnimeEntrance({
  children,
  delay = 50,
  duration = 600,
  translateY = [24, 0],
  scale = [0.96, 1],
  opacity = [0, 1]
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
    if (!containerRef.current) return

    // Find all direct children to stagger
    const targets = Array.from(containerRef.current.children)
    if (targets.length === 0) return

    targets.forEach((el: any, index: number) => {
      // Set initial styles to prevent flashes
      el.style.opacity = String(opacity[0])
      el.style.transform = `translateY(${translateY[0]}px) scale(${scale[0]})`

      el.animate(
        [
          { 
            opacity: opacity[0], 
            transform: `translateY(${translateY[0]}px) scale(${scale[0]})` 
          },
          { 
            opacity: opacity[1], 
            transform: `translateY(${translateY[1]}px) scale(${scale[1]})` 
          }
        ],
        {
          duration: duration,
          delay: index * delay,
          easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)', // Elastic spring bounce
          fill: 'both'
        }
      )
    })
  }, [delay, duration])

  return <div ref={containerRef} className="contents">{children}</div>
}

/**
 * Animates individual items in a list on mount or when items change.
 * Uses native browser animations.
 */
export function AnimeStaggerList({
  children,
  selector = '.stagger-item',
  delay = 30,
  duration = 500
}: {
  children: React.ReactNode
  selector?: string
  delay?: number
  duration?: number
}) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!containerRef.current) return

    const targets = Array.from(containerRef.current.querySelectorAll(selector))
    if (targets.length === 0) return

    targets.forEach((el: any, index: number) => {
      el.style.opacity = '0'
      el.style.transform = 'translateY(15px) scale(0.98)'

      el.animate(
        [
          { opacity: 0, transform: 'translateY(15px) scale(0.98)' },
          { opacity: 1, transform: 'translateY(0) scale(1)' }
        ],
        {
          duration: duration,
          delay: index * delay,
          easing: 'cubic-bezier(0.25, 1, 0.5, 1)', // Elegant ease-out-quart
          fill: 'both'
        }
      )
    })
  }, [children, selector, delay, duration])

  return <div ref={containerRef} className="contents">{children}</div>
}

/**
 * A click wrapper that triggers a scale/bounce tactile micro-interaction on mobile click.
 * Uses native high-performance compositor animation.
 */
export function AnimeBounceClick({
  children,
  className,
  scale = 0.93,
  duration = 200
}: {
  children: React.ReactElement
  className?: string
  scale?: number
  duration?: number
}) {
  const elementRef = useRef<HTMLDivElement>(null)

  const handlePress = () => {
    if (!elementRef.current) return
    elementRef.current.animate(
      [
        { transform: 'scale(1)' },
        { transform: `scale(${scale})` }
      ],
      {
        duration: duration / 2,
        easing: 'cubic-bezier(0.25, 1, 0.5, 1)',
        fill: 'forwards'
      }
    )
  }

  const handleRelease = () => {
    if (!elementRef.current) return
    elementRef.current.animate(
      [
        { transform: `scale(${scale})` },
        { transform: 'scale(1.03)' },
        { transform: 'scale(1)' }
      ],
      {
        duration: duration,
        easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)', // Bouncy elastic release
        fill: 'forwards'
      }
    )
  }

  // Clone child element and attach event handlers
  return (
    <div
      ref={elementRef}
      className={className}
      onTouchStart={handlePress}
      onTouchEnd={handleRelease}
      onMouseDown={handlePress}
      onMouseUp={handleRelease}
      onMouseLeave={handleRelease}
    >
      {children}
    </div>
  )
}

/**
 * Animates page transition when the route changes.
 * Uses native accelerated translation.
 */
export function AnimePageTransition({ children }: { children: React.ReactNode }) {
  const location = useLocation()
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!containerRef.current) return

    containerRef.current.style.opacity = '0'
    containerRef.current.style.transform = 'translateY(8px)'

    containerRef.current.animate(
      [
        { opacity: 0, transform: 'translateY(8px)' },
        { opacity: 1, transform: 'translateY(0)' }
      ],
      {
        duration: 350,
        easing: 'cubic-bezier(0.16, 1, 0.3, 1)', // ease-out-expo style
        fill: 'both'
      }
    )
  }, [location.pathname])

  return (
    <div ref={containerRef} className="w-full">
      {children}
    </div>
  )
}

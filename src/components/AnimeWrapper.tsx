import React, { useEffect, useRef } from 'react'
// @ts-ignore
import { animate, stagger } from 'animejs'
import { useLocation } from 'react-router-dom'

/**
 * Animates elements on mount with a beautiful fade and slide up stagger.
 */
export function AnimeEntrance({
  children,
  delay = 40,
  duration = 750,
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

    // Find all direct children or specific sub-elements to stagger
    const targets = Array.from(containerRef.current.children)

    if (targets.length === 0) return

    // Reset initial state to avoid flash
    targets.forEach((el: any) => {
      el.style.opacity = String(opacity[0])
      el.style.transform = `translateY(${translateY[0]}px) scale(${scale[0]})`
    })

    animate(targets, {
      opacity: opacity,
      translateY: translateY,
      scale: scale,
      easing: 'easeOutElastic(1, 0.85)',
      duration: duration,
      delay: stagger(delay)
    })
  }, [delay, duration, translateY, scale, opacity])

  return <div ref={containerRef} className="contents">{children}</div>
}

/**
 * Animates individual items in a list on mount or when items change.
 */
export function AnimeStaggerList({
  children,
  selector = '.stagger-item',
  delay = 30,
  duration = 600
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

    targets.forEach((el: any) => {
      el.style.opacity = '0'
      el.style.transform = 'translateY(15px) scale(0.98)'
    })

    animate(targets, {
      opacity: [0, 1],
      translateY: [15, 0],
      scale: [0.98, 1],
      easing: 'easeOutQuad',
      duration: duration,
      delay: stagger(delay)
    })
  }, [children, selector, delay, duration])

  return <div ref={containerRef} className="contents">{children}</div>
}

/**
 * A click wrapper that triggers a scale/bounce micro-interaction on mobile click.
 */
export function AnimeBounceClick({
  children,
  className,
  scale = 0.92,
  duration = 300
}: {
  children: React.ReactElement
  className?: string
  scale?: number
  duration?: number
}) {
  const elementRef = useRef<HTMLDivElement>(null)

  const handlePress = () => {
    if (!elementRef.current) return
    animate(elementRef.current, {
      scale: scale,
      duration: duration / 2,
      easing: 'easeOutQuad'
    })
  }

  const handleRelease = () => {
    if (!elementRef.current) return
    animate(elementRef.current, {
      scale: 1,
      duration: duration,
      easing: 'easeOutElastic(1, 0.6)'
    })
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
 */
export function AnimePageTransition({ children }: { children: React.ReactNode }) {
  const location = useLocation()
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!containerRef.current) return

    containerRef.current.style.opacity = '0'
    containerRef.current.style.transform = 'translateY(10px)'

    animate(containerRef.current, {
      opacity: [0, 1],
      translateY: [10, 0],
      easing: 'easeOutQuart',
      duration: 500
    })
  }, [location.pathname])

  return (
    <div ref={containerRef} className="w-full">
      {children}
    </div>
  )
}

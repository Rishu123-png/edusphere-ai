import React, { useEffect, useRef } from 'react'

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  radius: number
  color: string
  phase: number
}

/**
 * Living, animated canvas background tuned for mobile.
 * - Drifting neon particles that connect when near (constellation effect)
 * - A soft light that follows the teacher's finger / cursor
 * - Retina-crisp, capped particle count, and reduced-motion safe
 */
export default function InteractiveCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    let width = 0
    let height = 0

    const resize = () => {
      width = window.innerWidth
      height = window.innerHeight
      canvas.width = width * dpr
      canvas.height = height * dpr
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()

    const particleCount = reduceMotion ? 0 : Math.min(Math.floor((width * height) / 22000), 28)
    const particles: Particle[] = []
    const colors = [
      'rgba(6, 182, 212, 0.85)',
      'rgba(99, 102, 241, 0.85)',
      'rgba(168, 85, 247, 0.85)',
      'rgba(236, 72, 153, 0.7)',
    ]

    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
        radius: Math.random() * 2 + 1,
        color: colors[Math.floor(Math.random() * colors.length)],
        phase: Math.random() * Math.PI * 2,
      })
    }

    // Pointer-following light
    let pointerX = -9999
    let pointerY = -9999
    let glowX = width / 2
    let glowY = height / 3

    const onMove = (x: number, y: number) => {
      pointerX = x
      pointerY = y
    }
    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) onMove(e.touches[0].clientX, e.touches[0].clientY)
    }
    const handleTouchEnd = () => {
      pointerX = -9999
      pointerY = -9999
    }
    const handleMouseMove = (e: MouseEvent) => onMove(e.clientX, e.clientY)

    window.addEventListener('touchmove', handleTouchMove, { passive: true })
    window.addEventListener('touchend', handleTouchEnd)
    window.addEventListener('mousemove', handleMouseMove)

    let raf = 0
    let t = 0
    let visible = true
    const onVisible = () => { visible = document.visibilityState === 'visible' }
    document.addEventListener('visibilitychange', onVisible)

    let lastFrame = 0
    let lastResize = 0
    const FRAME_INTERVAL = 1000 / 30  // throttle to 30fps for battery/performance

    const handleResize = () => {
      const now = performance.now()
      if (now - lastResize < 200) return
      lastResize = now
      resize()
    }
    window.addEventListener('resize', handleResize)

    const render = (now: number) => {
      raf = requestAnimationFrame(render)
      if (!visible) return
      if (now - lastFrame < FRAME_INTERVAL) return
      lastFrame = now
      t += 0.032
      // Ease the glow toward the pointer for a fluid "AI presence"
      glowX += (pointerX - glowX) * 0.06
      glowY += (pointerY - glowY) * 0.06

      ctx.clearRect(0, 0, width, height)

      // Pointer light
      if (pointerX > -9000) {
        const g = ctx.createRadialGradient(glowX, glowY, 0, glowX, glowY, 160)
        g.addColorStop(0, 'rgba(34, 211, 238, 0.16)')
        g.addColorStop(1, 'rgba(34, 211, 238, 0)')
        ctx.fillStyle = g
        ctx.fillRect(glowX - 160, glowY - 160, 320, 320)
      }

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i]
        if (!reduceMotion) {
          p.x += p.vx
          p.y += p.vy
          if (p.x < 0 || p.x > width) p.vx *= -1
          if (p.y < 0 || p.y > height) p.vy *= -1
        }

        // Gentle attraction toward the pointer light
        const dxT = pointerX - p.x
        const dyT = pointerY - p.y
        const dT = Math.sqrt(dxT * dxT + dyT * dyT)
        if (dT < 140 && dT > 1) {
          p.x += (dxT / dT) * 0.4
          p.y += (dyT / dT) * 0.4
        }

        const breathe = 1 + Math.sin(t + p.phase) * 0.25
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.radius * breathe, 0, Math.PI * 2)
        ctx.fillStyle = p.color
        ctx.shadowBlur = 8
        ctx.shadowColor = p.color
        ctx.fill()
        ctx.shadowBlur = 0

        for (let j = i + 1; j < particles.length; j++) {
          const p2 = particles[j]
          const dx = p.x - p2.x
          const dy = p.y - p2.y
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist < 92) {
            ctx.beginPath()
            ctx.moveTo(p.x, p.y)
            ctx.lineTo(p2.x, p2.y)
            ctx.strokeStyle = `rgba(129, 140, 248, ${(1 - dist / 92) * 0.22})`
            ctx.lineWidth = 0.8
            ctx.stroke()
          }
        }
      }

    }

    raf = requestAnimationFrame(render)

    return () => {
      cancelAnimationFrame(raf)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('resize', handleResize)
      window.removeEventListener('touchmove', handleTouchMove)
      window.removeEventListener('touchend', handleTouchEnd)
      window.removeEventListener('mousemove', handleMouseMove)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-0 opacity-70 dark:opacity-90"
      aria-hidden="true"
    />
  )
}

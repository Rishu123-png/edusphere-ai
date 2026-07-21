import React, { useEffect, useRef } from 'react'

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  radius: number
  color: string
}

export default function InteractiveCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animationFrameId: number
    let width = (canvas.width = window.innerWidth)
    let height = (canvas.height = window.innerHeight)

    const handleResize = () => {
      if (!canvas) return
      width = canvas.width = window.innerWidth
      height = canvas.height = window.innerHeight
    }
    window.addEventListener('resize', handleResize)

    // Create particles
    const particleCount = Math.min(Math.floor((width * height) / 9000), 55)
    const particles: Particle[] = []
    const colors = ['rgba(6, 182, 212, 0.7)', 'rgba(99, 102, 241, 0.7)', 'rgba(168, 85, 247, 0.7)', 'rgba(236, 72, 153, 0.6)']

    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.8,
        vy: (Math.random() - 0.5) * 0.8,
        radius: Math.random() * 2.2 + 1,
        color: colors[Math.floor(Math.random() * colors.length)]
      })
    }

    // Touch interaction point
    let touchX = -1000
    let touchY = -1000

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        touchX = e.touches[0].clientX
        touchY = e.touches[0].clientY
      }
    }
    const handleTouchEnd = () => {
      touchX = -1000
      touchY = -1000
    }
    const handleMouseMove = (e: MouseEvent) => {
      touchX = e.clientX
      touchY = e.clientY
    }

    window.addEventListener('touchmove', handleTouchMove, { passive: true })
    window.addEventListener('touchend', handleTouchEnd)
    window.addEventListener('mousemove', handleMouseMove)

    // Render loop
    const render = () => {
      ctx.clearRect(0, 0, width, height)

      // Update and draw particles
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i]
        p.x += p.vx
        p.y += p.vy

        if (p.x < 0 || p.x > width) p.vx *= -1
        if (p.y < 0 || p.y > height) p.vy *= -1

        // Check distance to touch/mouse
        const dxTouch = touchX - p.x
        const dyTouch = touchY - p.y
        const distTouch = Math.sqrt(dxTouch * dxTouch + dyTouch * dyTouch)
        if (distTouch < 120) {
          p.x -= dxTouch * 0.03
          p.y -= dyTouch * 0.03
        }

        ctx.beginPath()
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2)
        ctx.fillStyle = p.color
        ctx.fill()

        // Connect nearby particles
        for (let j = i + 1; j < particles.length; j++) {
          const p2 = particles[j]
          const dx = p.x - p2.x
          const dy = p.y - p2.y
          const dist = Math.sqrt(dx * dx + dy * dy)

          if (dist < 90) {
            ctx.beginPath()
            ctx.moveTo(p.x, p.y)
            ctx.lineTo(p2.x, p2.y)
            const alpha = (1 - dist / 90) * 0.25
            ctx.strokeStyle = `rgba(129, 140, 248, ${alpha})`
            ctx.lineWidth = 0.8
            ctx.stroke()
          }
        }
      }

      animationFrameId = requestAnimationFrame(render)
    }

    render()

    return () => {
      window.removeEventListener('resize', handleResize)
      window.removeEventListener('touchmove', handleTouchMove)
      window.removeEventListener('touchend', handleTouchEnd)
      window.removeEventListener('mousemove', handleMouseMove)
      cancelAnimationFrame(animationFrameId)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-0 opacity-60 dark:opacity-80"
      aria-hidden="true"
    />
  )
}

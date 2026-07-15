import React from 'react'
import { motion, AnimatePresence, Variants } from 'framer-motion'

// Premium reusable animated components using Framer Motion

export const MotionCard = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    delay?: number
    hover?: boolean
    tilt?: boolean
  }
>(({ children, className = '', delay = 0, hover = true, tilt = false, ...props }, ref) => {
  const rest = props as any
  return (
    <motion.div
      ref={ref}
      className={`card-premium ${className}`}
      initial={{ opacity: 0, y: 24, scale: 0.985 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ 
        duration: 0.55, 
        delay, 
        ease: [0.23, 1, 0.32, 1] 
      }}
      whileHover={hover ? { 
        y: -4, 
        scale: 1.01,
        boxShadow: '0 20px 45px -10px rgb(0 0 0 / 0.12), 0 10px 15px -3px rgb(0 0 0 / 0.08)' 
      } : undefined}
      {...rest}
    >
      {children}
    </motion.div>
  )
})
MotionCard.displayName = 'MotionCard'

export const MotionButton = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ children, className = '', ...props }, ref) => {
  return (
    <motion.button
      ref={ref}
      className={`btn-gradient ${className}`}
      whileHover={{ scale: 1.015 }}
      whileTap={{ scale: 0.985 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      {...(props as any)}
    >
      {children}
    </motion.button>
  )
})
MotionButton.displayName = 'MotionButton'

export const MotionStagger = ({ 
  children, 
  className = '', 
  staggerDelay = 0.06,
  initialDelay = 0 
}: { 
  children: React.ReactNode
  className?: string
  staggerDelay?: number
  initialDelay?: number 
}) => {
  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: staggerDelay,
        delayChildren: initialDelay,
      }
    }
  }

  const itemVariants: Variants = {
    hidden: { opacity: 0, y: 18, scale: 0.96 },
    visible: { 
      opacity: 1, 
      y: 0, 
      scale: 1,
      transition: { duration: 0.5, ease: [0.23, 1, 0.32, 1] }
    }
  }

  return (
    <motion.div
      className={className}
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {React.Children.map(children, (child, index) => (
        <motion.div key={index} variants={itemVariants}>
          {child}
        </motion.div>
      ))}
    </motion.div>
  )
}

export const MotionPageTransition = ({ children }: { children: React.ReactNode }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12, filter: 'blur(4px)' }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  )
}

export const MotionKPI = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { delay?: number }
>(({ children, className = '', delay = 0, ...props }, ref) => {
  const rest = props as any
  return (
    <motion.div
      ref={ref}
      className={`kpi-card ${className}`}
      initial={{ opacity: 0, y: 20, scale: 0.94 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ 
        duration: 0.5, 
        delay: delay * 0.08, 
        ease: [0.23, 1, 0.32, 1] 
      }}
      whileHover={{ scale: 1.03, y: -2 }}
      {...rest}
    >
      {children}
    </motion.div>
  )
})
MotionKPI.displayName = 'MotionKPI'

/* ==================== NEURAL PARTICLE BACKGROUND ==================== */
export function NeuralParticleBackground({ 
  className = '', 
  density = 42, 
  color = '#6366f1' 
}: { 
  className?: string 
  density?: number 
  color?: string 
}) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null)

  React.useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d', { alpha: true })
    if (!ctx) return

    let width = canvas.offsetWidth
    let height = canvas.offsetHeight
    canvas.width = width * 2
    canvas.height = height * 2
    ctx.scale(2, 2)

    const particles: Array<{
      x: number
      y: number
      vx: number
      vy: number
      size: number
      opacity: number
    }> = []

    // Create particles
    for (let i = 0; i < density; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        size: Math.random() * 2.2 + 1.1,
        opacity: Math.random() * 0.6 + 0.25
      })
    }

    let frame: number
    const animate = () => {
      ctx.clearRect(0, 0, width, height)

      // Draw connections
      ctx.strokeStyle = color + '22'
      ctx.lineWidth = 0.8

      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x
          const dy = particles[i].y - particles[j].y
          const dist = Math.sqrt(dx * dx + dy * dy)

          if (dist < 115) {
            ctx.beginPath()
            ctx.moveTo(particles[i].x, particles[i].y)
            ctx.lineTo(particles[j].x, particles[j].y)
            ctx.stroke()
          }
        }
      }

      // Draw & update particles
      ctx.fillStyle = color
      particles.forEach((p, idx) => {
        ctx.save()
        ctx.globalAlpha = p.opacity
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
        ctx.fill()

        // Subtle glow
        ctx.shadowBlur = 8
        ctx.shadowColor = color
        ctx.fill()
        ctx.restore()

        // Update position
        p.x += p.vx
        p.y += p.vy

        // Bounce edges
        if (p.x < 0 || p.x > width) p.vx *= -1
        if (p.y < 0 || p.y > height) p.vy *= -1

        // Gentle drift
        p.vx += (Math.random() - 0.5) * 0.015
        p.vy += (Math.random() - 0.5) * 0.015

        // Clamp velocity
        p.vx = Math.max(-1.1, Math.min(1.1, p.vx))
        p.vy = Math.max(-1.1, Math.min(1.1, p.vy))
      })

      frame = requestAnimationFrame(animate)
    }

    animate()

    const resize = () => {
      width = canvas.offsetWidth
      height = canvas.offsetHeight
      canvas.width = width * 2
      canvas.height = height * 2
      ctx.scale(2, 2)
    }

    window.addEventListener('resize', resize)

    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', resize)
    }
  }, [density, color])

  return (
    <canvas 
      ref={canvasRef} 
      className={`absolute inset-0 pointer-events-none z-0 opacity-60 mix-blend-screen ${className}`} 
    />
  )
}

/* ==================== 3D TILT CARD (Enhanced) ==================== */
export const TiltCard = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ children, className = '', ...props }, ref) => {
  const [rotateX, setRotateX] = React.useState(0)
  const [rotateY, setRotateY] = React.useState(0)
  const rest = props as any

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width - 0.5) * 24
    const y = ((e.clientY - rect.top) / rect.height - 0.5) * -24
    setRotateX(y)
    setRotateY(x)
  }

  const handleMouseLeave = () => {
    setRotateX(0)
    setRotateY(0)
  }

  return (
    <motion.div
      ref={ref}
      className={`card-premium cursor-pointer ${className}`}
      style={{ 
        transformStyle: 'preserve-3d',
        transform: `perspective(1200px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)` 
      }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      whileHover={{ scale: 1.015 }}
      transition={{ type: 'spring', stiffness: 280, damping: 22 }}
      {...rest}
    >
      {children}
    </motion.div>
  )
})
TiltCard.displayName = 'TiltCard'

export const MotionFadeIn = ({ 
  children, 
  delay = 0 
}: { 
  children: React.ReactNode 
  delay?: number 
}) => (
  <motion.div
    initial={{ opacity: 0, y: 16 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay, duration: 0.45, ease: [0.23, 1, 0.32, 1] }}
  >
    {children}
  </motion.div>
)
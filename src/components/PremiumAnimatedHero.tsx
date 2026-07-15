import React from 'react'
import { motion } from 'framer-motion'
import { Sparkles, ArrowRight } from 'lucide-react'
import { NeuralParticleBackground } from './MotionWrapper'

interface PremiumAnimatedHeroProps {
  variant?: 'login' | 'dashboard'
  title?: string
  subtitle?: string
  ctaText?: string
  onCtaClick?: () => void
}

export function PremiumAnimatedHero({ 
  variant = 'login',
  title,
  subtitle,
  ctaText,
  onCtaClick 
}: PremiumAnimatedHeroProps) {
  
  if (variant === 'login') {
    return (
      <div className="relative h-full flex flex-col justify-center overflow-hidden bg-[#0a0e17] text-white">
        <NeuralParticleBackground density={38} color="#6366f1" />
        
        {/* Animated gradient orbs */}
        <div className="absolute inset-0">
          <div className="absolute top-[-20%] right-[-15%] w-[420px] h-[420px] bg-violet-500/10 rounded-full blur-[120px] animate-[pulse_8s_ease-in-out_infinite]" />
          <div className="absolute bottom-[-25%] left-[-10%] w-[380px] h-[380px] bg-cyan-400/10 rounded-full blur-[100px] animate-[pulse_12s_ease-in-out_infinite_2s]" />
        </div>

        <div className="relative z-10 px-8 md:px-12 py-12">
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.23, 1, 0.32, 1] }}
            className="max-w-xl"
          >
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-white/10 bg-white/5 mb-6">
              <Sparkles className="w-4 h-4 text-cyan-400" />
              <span className="text-xs font-semibold tracking-[2px] text-white/80">EDUSPHERE AI 2026</span>
            </div>

            <h1 className="text-6xl md:text-7xl font-black tracking-[-4.5px] leading-[.88] mb-4">
              Your school.<br />
              <span className="bg-gradient-to-r from-white via-cyan-200 to-white bg-clip-text text-transparent">
                Smarter every day.
              </span>
            </h1>

            <p className="text-xl text-white/70 max-w-md mb-9 tracking-tight">
              Premium AI campus OS with real-time intelligence, 
              predictive analytics, and secure collaboration.
            </p>

            <div className="flex flex-wrap gap-3">
              <button 
                onClick={onCtaClick}
                className="group flex items-center gap-3 bg-white text-zinc-950 px-8 py-3.5 rounded-2xl font-semibold text-[15px] hover:bg-white/95 active:scale-[0.985] transition-all"
              >
                Get Started Free
                <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition" />
              </button>
              <button className="flex items-center gap-3 px-8 py-3.5 rounded-2xl border border-white/20 hover:bg-white/5 text-white/90 transition-all">
                Watch 47s demo
              </button>
            </div>

            <div className="mt-10 text-xs uppercase tracking-[1.5px] text-white/50">
              Trusted by 42 CBSE schools • 18k+ students
            </div>
          </motion.div>
        </div>

        {/* Floating stats */}
        <div className="absolute bottom-10 right-10 hidden lg:flex flex-col gap-4 z-10">
          {[
            { label: "Live Predictions", value: "98.7%" },
            { label: "Risk Detection", value: "0.4s" }
          ].map((stat, i) => (
            <motion.div 
              key={i}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.6 + i * 0.15 }}
              className="px-5 py-3 bg-zinc-900/70 border border-white/10 rounded-2xl backdrop-blur-xl"
            >
              <div className="text-xs text-white/50">{stat.label}</div>
              <div className="font-mono text-3xl font-black text-white tracking-tighter">{stat.value}</div>
            </motion.div>
          ))}
        </div>
      </div>
    )
  }

  // Dashboard Hero
  return (
    <div className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-[#11151f] via-[#0f1320] to-[#0c0f1a] p-8 text-white shadow-2xl">
      <NeuralParticleBackground density={26} color="#a5b4fc" />
      
      <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-y-5">
        <div>
          <div className="flex items-center gap-3 mb-3">
            <div className="inline px-3.5 py-1 rounded-full text-xs bg-white/10 text-white/80 tracking-widest">LIVE CAMPUS</div>
            <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
          </div>
          
          <h2 className="text-4xl md:text-[42px] font-black tracking-[-2.2px] leading-none">
            {title || "Good morning."}<br /> 
            <span className="text-white/70">Your campus is thriving.</span>
          </h2>
          <p className="mt-3 max-w-sm text-white/60 text-[15px]">
            {subtitle || "Real-time AI insights updated from 12,849 live records"}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={onCtaClick}
            className="flex items-center gap-2 bg-white/10 hover:bg-white/15 active:bg-white/25 px-6 py-3 rounded-2xl text-sm font-semibold transition-all border border-white/20"
          >
            {ctaText || "Open AI Copilot"} <ArrowRight size={16} />
          </button>
        </div>
      </div>

      {/* Live metrics bar */}
      <div className="mt-8 flex items-center gap-8 text-sm">
        <div>
          <div className="text-white/50 text-xs">STUDENTS PRESENT</div>
          <div className="font-mono text-4xl font-black tracking-tighter">1,842</div>
        </div>
        <div className="h-9 w-px bg-white/20" />
        <div>
          <div className="text-white/50 text-xs">AI ACCURACY</div>
          <div className="font-mono text-4xl font-black tracking-tighter">94.8%</div>
        </div>
      </div>
    </div>
  )
}
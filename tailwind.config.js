/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      keyframes: {
        // ── Ambient / atmosphere ──────────────────────────────────────────
        'float': {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%':      { transform: 'translateY(-8px)' },
        },
        'float-slow': {
          '0%, 100%': { transform: 'translateY(0px) rotate(0deg)' },
          '33%':      { transform: 'translateY(-12px) rotate(1deg)' },
          '66%':      { transform: 'translateY(-6px) rotate(-1deg)' },
        },
        'drift': {
          '0%':   { transform: 'translateX(0) translateY(0) scale(1)' },
          '33%':  { transform: 'translateX(30px) translateY(-20px) scale(1.05)' },
          '66%':  { transform: 'translateX(-20px) translateY(-35px) scale(0.95)' },
          '100%': { transform: 'translateX(0) translateY(0) scale(1)' },
        },
        'pulse-glow': {
          '0%, 100%': { opacity: '0.3', transform: 'scale(1)' },
          '50%':      { opacity: '0.7', transform: 'scale(1.05)' },
        },
        'pulse-glow-strong': {
          '0%, 100%': { opacity: '0.5', transform: 'scale(1)' },
          '50%':      { opacity: '1',   transform: 'scale(1.08)' },
        },
        'shimmer': {
          '0%':   { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'scanline': {
          '0%':   { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100vh)' },
        },
        'vignette-pulse': {
          '0%, 100%': { opacity: '0.6' },
          '50%':      { opacity: '0.9' },
        },
        // ── Entry / reveal ────────────────────────────────────────────────
        'slide-up': {
          '0%':   { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)',    opacity: '1' },
        },
        'slide-in-left': {
          '0%':   { transform: 'translateX(-30px)', opacity: '0' },
          '100%': { transform: 'translateX(0)',     opacity: '1' },
        },
        'slide-in-right': {
          '0%':   { transform: 'translateX(30px)', opacity: '0' },
          '100%': { transform: 'translateX(0)',    opacity: '1' },
        },
        'fade-in': {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'scale-in': {
          '0%':   { transform: 'scale(0.85)', opacity: '0' },
          '100%': { transform: 'scale(1)',    opacity: '1' },
        },
        'reveal-up': {
          '0%':   { transform: 'translateY(40px) scale(0.95)', opacity: '0', filter: 'blur(4px)' },
          '100%': { transform: 'translateY(0) scale(1)',       opacity: '1', filter: 'blur(0)' },
        },
        // ── Territory discovery ───────────────────────────────────────────
        'territory-reveal': {
          '0%':   { transform: 'scale(0.5)', opacity: '0', filter: 'blur(8px) brightness(3)' },
          '60%':  { transform: 'scale(1.08)', opacity: '0.9', filter: 'blur(0) brightness(1.5)' },
          '100%': { transform: 'scale(1)',   opacity: '1', filter: 'blur(0) brightness(1)' },
        },
        'fog-lift': {
          '0%':   { opacity: '1', filter: 'blur(6px) grayscale(1)' },
          '100%': { opacity: '0', filter: 'blur(0) grayscale(0)' },
        },
        'ripple': {
          '0%':   { transform: 'scale(0)', opacity: '1' },
          '100%': { transform: 'scale(4)', opacity: '0' },
        },
        // ── XP / stats ────────────────────────────────────────────────────
        'xp-fill': {
          '0%':   { width: '0%' },
          '100%': { width: 'var(--target-width)' },
        },
        'stat-bump': {
          '0%':   { transform: 'scale(1)' },
          '30%':  { transform: 'scale(1.15)' },
          '60%':  { transform: 'scale(0.97)' },
          '100%': { transform: 'scale(1)' },
        },
        'number-tick': {
          '0%':   { transform: 'translateY(-10px)', opacity: '0' },
          '50%':  { transform: 'translateY(0)',     opacity: '1' },
          '100%': { transform: 'translateY(0)',     opacity: '1' },
        },
        // ── Light rays ────────────────────────────────────────────────────
        'light-ray': {
          '0%, 100%': { opacity: '0', transform: 'scaleY(0.8)' },
          '50%':      { opacity: '0.08', transform: 'scaleY(1)' },
        },
        // ── Flicker ───────────────────────────────────────────────────────
        'flicker': {
          '0%, 100%': { opacity: '1' },
          '92%':      { opacity: '1' },
          '93%':      { opacity: '0.8' },
          '94%':      { opacity: '1' },
          '96%':      { opacity: '0.9' },
          '97%':      { opacity: '1' },
        },
        'border-glow': {
          '0%, 100%': { boxShadow: '0 0 0px transparent' },
          '50%':      { boxShadow: '0 0 20px var(--glow-color, #f59e0b66)' },
        },
        'gradient-x': {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%':      { backgroundPosition: '100% 50%' },
        },
        'breathe': {
          '0%, 100%': { transform: 'scale(1)',    opacity: '0.8' },
          '50%':      { transform: 'scale(1.04)', opacity: '1' },
        },
        'spin-slow': {
          '0%':   { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
        'ping-slow': {
          '0%':         { transform: 'scale(1)', opacity: '0.8' },
          '80%, 100%':  { transform: 'scale(2)', opacity: '0' },
        },
        'orb-drift': {
          '0%':   { transform: 'translate(0, 0) scale(1)' },
          '25%':  { transform: 'translate(5%, -3%) scale(1.03)' },
          '50%':  { transform: 'translate(2%, 5%) scale(0.97)' },
          '75%':  { transform: 'translate(-4%, 2%) scale(1.02)' },
          '100%': { transform: 'translate(0, 0) scale(1)' },
        },
      },
      animation: {
        'float':             'float 4s ease-in-out infinite',
        'float-slow':        'float-slow 8s ease-in-out infinite',
        'drift':             'drift 20s ease-in-out infinite',
        'drift-slow':        'drift 30s ease-in-out infinite',
        'pulse-glow':        'pulse-glow 3s ease-in-out infinite',
        'pulse-glow-fast':   'pulse-glow 1.5s ease-in-out infinite',
        'shimmer':           'shimmer 2.5s linear infinite',
        'scanline':          'scanline 8s linear infinite',
        'vignette-pulse':    'vignette-pulse 4s ease-in-out infinite',
        'slide-up':          'slide-up 0.4s ease-out both',
        'slide-in-left':     'slide-in-left 0.4s ease-out both',
        'slide-in-right':    'slide-in-right 0.4s ease-out both',
        'fade-in':           'fade-in 0.3s ease-out both',
        'scale-in':          'scale-in 0.35s cubic-bezier(0.34,1.56,0.64,1) both',
        'reveal-up':         'reveal-up 0.5s cubic-bezier(0.22,1,0.36,1) both',
        'territory-reveal':  'territory-reveal 0.6s cubic-bezier(0.22,1,0.36,1) both',
        'fog-lift':          'fog-lift 0.8s ease-out both',
        'ripple':            'ripple 0.8s ease-out both',
        'stat-bump':         'stat-bump 0.5s ease-out both',
        'number-tick':       'number-tick 0.3s ease-out both',
        'light-ray':         'light-ray 6s ease-in-out infinite',
        'flicker':           'flicker 5s linear infinite',
        'border-glow':         'border-glow 3s ease-in-out infinite',
        'gradient-x':         'gradient-x 4s ease infinite',
        'breathe':            'breathe 4s ease-in-out infinite',
        'spin-slow':          'spin-slow 12s linear infinite',
        'ping-slow':          'ping-slow 3s cubic-bezier(0,0,0.2,1) infinite',
        'pulse-glow-strong':  'pulse-glow-strong 2s ease-in-out infinite',
        'orb-drift':         'orb-drift 25s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};

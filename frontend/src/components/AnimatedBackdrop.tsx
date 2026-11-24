import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion'
import { useEffect } from 'react'

/** Slow-moving aurora glow that also leans gently toward the pointer. */
export function AnimatedBackdrop() {
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const sx = useSpring(x, { stiffness: 40, damping: 20 })
  const sy = useSpring(y, { stiffness: 40, damping: 20 })
  const tx = useTransform(sx, (v) => v * 40)
  const ty = useTransform(sy, (v) => v * 40)

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      x.set(e.clientX / window.innerWidth - 0.5)
      y.set(e.clientY / window.innerHeight - 0.5)
    }
    window.addEventListener('pointermove', onMove)
    return () => window.removeEventListener('pointermove', onMove)
  }, [x, y])

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-[#f5f2ec] dark:bg-ink-950">
      <motion.div style={{ x: tx, y: ty }} className="absolute inset-0">
        <div className="absolute -left-[15%] -top-[20%] size-[60vmax] animate-aurora rounded-full bg-[radial-gradient(circle_at_center,rgba(233,185,100,0.30),transparent_60%)] blur-3xl dark:bg-[radial-gradient(circle_at_center,rgba(233,185,100,0.22),transparent_60%)]" />
        <div className="absolute -bottom-[25%] -right-[10%] size-[65vmax] animate-aurora rounded-full bg-[radial-gradient(circle_at_center,rgba(56,97,251,0.14),transparent_60%)] blur-3xl [animation-delay:-6s] dark:bg-[radial-gradient(circle_at_center,rgba(56,97,251,0.22),transparent_60%)]" />
        <div className="absolute left-[35%] top-[30%] size-[40vmax] animate-aurora rounded-full bg-[radial-gradient(circle_at_center,rgba(20,184,166,0.14),transparent_60%)] blur-3xl [animation-delay:-11s]" />
      </motion.div>
      <div className="grid-pattern absolute inset-0 [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,transparent_0%,rgba(245,242,236,0.65)_70%)] dark:bg-[radial-gradient(ellipse_at_top,transparent_0%,rgba(7,10,22,0.6)_70%)]" />
    </div>
  )
}

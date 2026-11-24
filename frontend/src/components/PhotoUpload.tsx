import { AnimatePresence, motion } from 'framer-motion'
import { Camera, ImagePlus, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type DragEvent } from 'react'
import { shrinkPhoto as shrink } from '../lib/image'

const MAX_BYTES = 3 * 1024 * 1024
const TYPES = ['image/jpeg', 'image/png', 'image/webp']

interface PhotoUploadProps {
  file: File | null
  onChange: (file: File | null) => void
  error?: string
  onError: (message: string) => void
}

export function PhotoUpload({ file, onChange, error, onError }: PhotoUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const preview = useMemo(() => (file ? URL.createObjectURL(file) : null), [file])

  useEffect(() => {
    if (!preview) return
    return () => URL.revokeObjectURL(preview)
  }, [preview])

  async function pick(f: File | undefined) {
    if (!f) return
    if (!TYPES.includes(f.type)) return onError('Use a JPG, PNG or WebP picture.')
    let out = f
    try {
      out = await shrink(f)
    } catch {
      return onError("This picture couldn't be read. Try another one.")
    }
    if (out.size > MAX_BYTES) return onError('This picture is too large. Try another one.')
    onChange(out)
  }

  function onDrop(e: DragEvent) {
    e.preventDefault()
    setDragging(false)
    void pick(e.dataTransfer.files[0])
  }

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`flex items-center gap-4 rounded-2xl border border-dashed p-3 transition ${
          error ? 'border-rose-400/60' : dragging ? 'border-gold-400/80 bg-gold-400/5' : 'border-slate-300 hover:border-slate-400 dark:border-white/15 dark:hover:border-white/25'
        }`}
      >
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="group relative size-16 shrink-0 overflow-hidden rounded-full border border-slate-300 bg-slate-900/[0.03] dark:border-white/10 dark:bg-white/[0.04]"
          aria-label="Choose profile picture"
        >
          <AnimatePresence mode="wait">
            {preview ? (
              <motion.img
                key={preview}
                src={preview}
                alt="Profile preview"
                initial={{ opacity: 0, scale: 1.15 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="size-full object-cover"
              />
            ) : (
              <motion.span key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid size-full place-items-center">
                <ImagePlus className="size-6 text-slate-400 transition group-hover:text-gold-300" />
              </motion.span>
            )}
          </AnimatePresence>
          <span className="absolute inset-0 grid place-items-center bg-black/50 opacity-0 transition group-hover:opacity-100">
            <Camera className="size-5 text-white" />
          </span>
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-slate-900 dark:text-white">{file ? 'Profile picture added' : (
            <>
              Upload a profile picture <span className="font-normal text-slate-400 dark:text-slate-500">(optional)</span>
            </>
          )}</p>
          <p className="truncate text-xs text-slate-500 dark:text-slate-400">{file ? file.name : 'Drag it here or tap the circle · JPG, PNG or WebP'}</p>
        </div>
        {file && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="grid size-9 shrink-0 place-items-center rounded-xl text-slate-400 transition hover:bg-slate-900/5 hover:text-slate-900 dark:hover:bg-white/5 dark:hover:text-white"
            aria-label="Remove picture"
          >
            <X className="size-4" />
          </button>
        )}
        <input
          ref={inputRef}
          type="file"
          accept={TYPES.join(',')}
          className="hidden"
          onChange={(e) => {
            void pick(e.target.files?.[0])
            e.target.value = ''
          }}
        />
      </div>
      {error && <p className="pl-2 pt-1.5 text-xs text-rose-500 dark:text-rose-300">{error}</p>}
    </div>
  )
}

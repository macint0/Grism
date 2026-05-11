'use client'

import { useEffect, useState } from 'react'

export default function CodeUpdateBanner() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    const es = new EventSource('/_next/webpack-hmr')
    let building = false

    es.addEventListener('message', (e) => {
      try {
        const data = JSON.parse(e.data) as { action?: string }
        if (data.action === 'building') building = true
        if ((data.action === 'built' || data.action === 'sync') && building) {
          building = false
          setShow(true)
        }
      } catch { /* ignore non-JSON pings */ }
    })

    return () => es.close()
  }, [])

  if (!show) return null

  return (
    <div className="fixed top-3 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm shadow-lg">
      <span>App code updated</span>
      <button
        onClick={() => setShow(false)}
        className="text-indigo-200 hover:text-white transition-colors"
      >
        ✕
      </button>
    </div>
  )
}

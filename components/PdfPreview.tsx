'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'

pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`

interface PageDims { width: number; height: number }

interface PDFProxy {
  numPages: number
  getPage(n: number): Promise<{ getViewport(o: { scale: number }): PageDims }>
}

interface PdfPreviewProps {
  pdfData: string | null
  projectId: string
  fileName?: string
  onPageClick?: (page: number, pdfX: number, pdfY: number) => void
}

const BASE_WIDTH = 600

export default function PdfPreview({ pdfData, projectId, fileName = 'document.pdf', onPageClick }: PdfPreviewProps) {
  const [numPages, setNumPages] = useState<number>(0)
  const [currentPage, setCurrentPage] = useState<number>(1)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [jumpInput, setJumpInput] = useState('')
  const [zoom, setZoom] = useState(1)
  const pageDimsRef = useRef<Map<number, PageDims>>(new Map())
  const pageRefsMap = useRef<Map<number, HTMLDivElement>>(new Map())
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const observerRef = useRef<IntersectionObserver | null>(null)
  const lastRestoredProjectRef = useRef('')
  const scrollSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // When project changes, mark that we need to restore scroll on next PDF load
  useEffect(() => {
    lastRestoredProjectRef.current = ''
  }, [projectId])

  const onLoadSuccess = useCallback(async (pdf: PDFProxy) => {
    setNumPages(pdf.numPages)
    setCurrentPage(1)
    setLoadError(null)
    pageDimsRef.current.clear()
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i)
      const vp = page.getViewport({ scale: 1 })
      pageDimsRef.current.set(i, { width: vp.width, height: vp.height })
    }
    // Restore saved scroll when switching to a new project; skip on re-compile
    if (lastRestoredProjectRef.current !== projectId) {
      lastRestoredProjectRef.current = projectId
      const saved = localStorage.getItem(`grism:pdfScroll:${projectId}`)
      const top = saved ? parseInt(saved, 10) : 0
      requestAnimationFrame(() => {
        scrollContainerRef.current?.scrollTo({ top })
      })
    }
  }, [projectId])

  const onLoadError = useCallback((err: Error) => {
    setLoadError(err.message)
  }, [])

  const handleScroll = useCallback(() => {
    if (scrollSaveTimerRef.current) clearTimeout(scrollSaveTimerRef.current)
    scrollSaveTimerRef.current = setTimeout(() => {
      const top = scrollContainerRef.current?.scrollTop ?? 0
      localStorage.setItem(`grism:pdfScroll:${projectId}`, String(top))
    }, 250)
  }, [projectId])

  // Track which page is most visible using IntersectionObserver
  useEffect(() => {
    const container = scrollContainerRef.current
    if (!container || numPages === 0) return

    const visible = new Map<number, number>()

    observerRef.current?.disconnect()
    observerRef.current = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const pageNum = Number((entry.target as HTMLElement).dataset.page)
          if (entry.isIntersecting) visible.set(pageNum, entry.intersectionRatio)
          else visible.delete(pageNum)
        }
        if (visible.size > 0) {
          const best = [...visible.entries()].sort((a, b) => b[1] - a[1])[0][0]
          setCurrentPage(best)
        }
      },
      { root: container, threshold: [0, 0.25, 0.5, 0.75, 1] }
    )

    for (const [, el] of pageRefsMap.current) {
      observerRef.current.observe(el)
    }
    return () => observerRef.current?.disconnect()
  }, [numPages])

  const scrollToPage = useCallback((pageNum: number) => {
    const el = pageRefsMap.current.get(pageNum)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])

  const handleJump = useCallback((e: React.FormEvent) => {
    e.preventDefault()
    const n = parseInt(jumpInput, 10)
    if (!isNaN(n) && n >= 1 && n <= numPages) scrollToPage(n)
    setJumpInput('')
  }, [jumpInput, numPages, scrollToPage])

  const handleDownload = useCallback(() => {
    if (!pdfData) return
    const bytes = atob(pdfData)
    const arr = new Uint8Array(bytes.length)
    for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i)
    const blob = new Blob([arr], { type: 'application/pdf' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = fileName
    a.click()
    URL.revokeObjectURL(url)
  }, [pdfData, fileName])

  const handleClick = useCallback((e: React.MouseEvent<HTMLDivElement>, pageNumber: number) => {
    if (!onPageClick) return
    const rect = e.currentTarget.getBoundingClientRect()
    const dims = pageDimsRef.current.get(pageNumber)
    if (!dims) return
    const pdfX = ((e.clientX - rect.left) / rect.width) * dims.width
    const pdfY = ((e.clientY - rect.top) / rect.height) * dims.height
    onPageClick(pageNumber, pdfX, pdfY)
  }, [onPageClick])

  if (!pdfData) {
    return (
      <div className="flex h-full items-center justify-center text-zinc-400 text-sm">
        Compile your document to see the PDF preview
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="flex h-full items-center justify-center text-red-400 text-xs p-4 text-center">
        PDF load error: {loadError}
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* Navigation toolbar */}
      <div className="shrink-0 flex items-center gap-2 px-3 py-1.5 bg-zinc-800 border-b border-zinc-700">
        <button
          onClick={() => scrollToPage(currentPage - 1)}
          disabled={currentPage <= 1}
          className="text-zinc-400 hover:text-zinc-100 disabled:opacity-30 text-sm px-1.5 py-0.5 rounded hover:bg-zinc-700 transition-colors"
          title="Previous page"
        >
          ‹
        </button>

        <form onSubmit={handleJump} className="flex items-center gap-1.5">
          <input
            type="text"
            value={jumpInput}
            onChange={(e) => setJumpInput(e.target.value)}
            placeholder={String(currentPage)}
            className="w-12 bg-zinc-700 border border-zinc-600 rounded px-2 py-0.5 text-xs text-zinc-100 placeholder:text-zinc-300 focus:outline-none focus:border-indigo-500 text-center"
          />
          <span className="text-zinc-400 text-xs">/ {numPages}</span>
        </form>

        <button
          onClick={() => scrollToPage(currentPage + 1)}
          disabled={currentPage >= numPages}
          className="text-zinc-400 hover:text-zinc-100 disabled:opacity-30 text-sm px-1.5 py-0.5 rounded hover:bg-zinc-700 transition-colors"
          title="Next page"
        >
          ›
        </button>

        <div className="flex-1" />

        {/* Zoom controls */}
        <button
          onClick={() => setZoom(z => Math.max(0.5, +(z - 0.25).toFixed(2)))}
          disabled={zoom <= 0.5}
          className="text-zinc-400 hover:text-zinc-100 disabled:opacity-30 text-sm w-6 h-6 flex items-center justify-center rounded hover:bg-zinc-700 transition-colors"
          title="Zoom out"
        >
          −
        </button>
        <span className="text-zinc-400 text-xs w-10 text-center select-none">{Math.round(zoom * 100)}%</span>
        <button
          onClick={() => setZoom(z => Math.min(3, +(z + 0.25).toFixed(2)))}
          disabled={zoom >= 3}
          className="text-zinc-400 hover:text-zinc-100 disabled:opacity-30 text-sm w-6 h-6 flex items-center justify-center rounded hover:bg-zinc-700 transition-colors"
          title="Zoom in"
        >
          +
        </button>

        <div className="w-px h-4 bg-zinc-600 mx-1" />

        <button
          onClick={handleDownload}
          className="text-zinc-400 hover:text-zinc-100 text-xs px-2 py-0.5 rounded hover:bg-zinc-700 transition-colors"
          title="Download PDF"
        >
          ↓ PDF
        </button>
      </div>

      {/* Scrollable pages */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-auto bg-zinc-200 flex flex-col items-center py-4 gap-2"
      >
        <Document
          file={`data:application/pdf;base64,${pdfData}`}
          onLoadSuccess={onLoadSuccess as unknown as (pdf: object) => void}
          onLoadError={onLoadError}
          className="flex flex-col items-center gap-2"
        >
          {Array.from({ length: numPages }, (_, i) => {
            const pageNum = i + 1
            return (
              <div
                key={pageNum}
                data-page={pageNum}
                className="flex flex-col items-center gap-1"
                ref={(el) => {
                  if (el) pageRefsMap.current.set(pageNum, el)
                  else pageRefsMap.current.delete(pageNum)
                }}
              >
                <div
                  onClick={(e) => handleClick(e, pageNum)}
                  className={onPageClick ? 'cursor-crosshair' : undefined}
                >
                  <Page pageNumber={pageNum} className="shadow-md" width={Math.round(BASE_WIDTH * zoom)} />
                </div>
                <span className="text-zinc-500 text-xs pb-2 select-none">
                  {pageNum} / {numPages}
                </span>
              </div>
            )
          })}
        </Document>
      </div>
    </div>
  )
}

'use client'

import { useState, useCallback, useRef } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'

pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`

interface PageDims { width: number; height: number }

// Minimal shape of what pdfjs gives us — third-party, so typed as needed
interface PDFProxy {
  numPages: number
  getPage(n: number): Promise<{ getViewport(o: { scale: number }): PageDims }>
}

interface PdfPreviewProps {
  pdfData: string | null
  onPageClick?: (page: number, pdfX: number, pdfY: number) => void
}

export default function PdfPreview({ pdfData, onPageClick }: PdfPreviewProps) {
  const [numPages, setNumPages] = useState<number>(0)
  const [loadError, setLoadError] = useState<string | null>(null)
  const pageDimsRef = useRef<Map<number, PageDims>>(new Map())

  const onLoadSuccess = useCallback(async (pdf: PDFProxy) => {
    setNumPages(pdf.numPages)
    setLoadError(null)
    pageDimsRef.current.clear()
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i)
      const vp = page.getViewport({ scale: 1 })
      pageDimsRef.current.set(i, { width: vp.width, height: vp.height })
    }
  }, [])

  const onLoadError = useCallback((err: Error) => {
    setLoadError(err.message)
  }, [])

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
    <div className="h-full overflow-auto bg-zinc-200 flex flex-col items-center py-4 gap-4">
      <Document
        file={`data:application/pdf;base64,${pdfData}`}
        onLoadSuccess={onLoadSuccess as unknown as (pdf: object) => void}
        onLoadError={onLoadError}
        className="flex flex-col items-center gap-4"
      >
        {Array.from({ length: numPages }, (_, i) => {
          const pageNum = i + 1
          return (
            <div
              key={pageNum}
              onClick={(e) => handleClick(e, pageNum)}
              className={onPageClick ? 'cursor-crosshair' : undefined}
            >
              <Page pageNumber={pageNum} className="shadow-md" width={600} />
            </div>
          )
        })}
      </Document>
    </div>
  )
}

'use client'

import { useState, useCallback } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'

pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`

interface PdfPreviewProps {
  pdfData: string | null // base64-encoded PDF
}

export default function PdfPreview({ pdfData }: PdfPreviewProps) {
  const [numPages, setNumPages] = useState<number>(0)
  const [loadError, setLoadError] = useState<string | null>(null)

  const onLoadSuccess = useCallback(({ numPages }: { numPages: number }) => {
    setNumPages(numPages)
    setLoadError(null)
  }, [])

  const onLoadError = useCallback((err: Error) => {
    setLoadError(err.message)
  }, [])

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

  const fileUrl = `data:application/pdf;base64,${pdfData}`

  return (
    <div className="h-full overflow-auto bg-zinc-200 flex flex-col items-center py-4 gap-4">
      <Document
        file={fileUrl}
        onLoadSuccess={onLoadSuccess}
        onLoadError={onLoadError}
        className="flex flex-col items-center gap-4"
      >
        {Array.from({ length: numPages }, (_, i) => (
          <Page
            key={i + 1}
            pageNumber={i + 1}
            className="shadow-md"
            width={600}
          />
        ))}
      </Document>
    </div>
  )
}

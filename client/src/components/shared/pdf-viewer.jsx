"use client";

import { useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { ChevronLeft, ChevronRight, Loader2, Minus, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import "react-pdf/dist/Page/TextLayer.css";
import "react-pdf/dist/Page/AnnotationLayer.css";

// Configure worker to load from CDN to avoid build setup issues
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

export default function PdfViewer({ url }) {
    const [numPages, setNumPages] = useState(null);
    const [pageNumber, setPageNumber] = useState(1);
    const [scale, setScale] = useState(1.0);
    const [isLoading, setIsLoading] = useState(true);

    function onDocumentLoadSuccess({ numPages }) {
        setNumPages(numPages);
        setIsLoading(false);
        setPageNumber(1);
    }

    function changePage(offset) {
        setPageNumber((prevPageNumber) => Math.min(Math.max(1, prevPageNumber + offset), numPages || 1));
    }

    function handleZoomIn() {
        setScale((prev) => Math.min(prev + 0.1, 3.0));
    }

    function handleZoomOut() {
        setScale((prev) => Math.max(prev - 0.1, 0.5));
    }

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-4">
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="icon"
                        onClick={handleZoomOut}
                        disabled={scale <= 0.5}
                        title="Zoom Out"
                    >
                        <Minus className="h-4 w-4" />
                    </Button>
                    <span className="w-16 text-center text-sm font-medium">{Math.round(scale * 100)}%</span>
                    <Button
                        variant="outline"
                        size="icon"
                        onClick={handleZoomIn}
                        disabled={scale >= 3.0}
                        title="Zoom In"
                    >
                        <Plus className="h-4 w-4" />
                    </Button>
                </div>

                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="icon"
                        onClick={() => changePage(-1)}
                        disabled={pageNumber <= 1}
                        title="Previous Page"
                    >
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <p className="text-sm font-medium">
                        Page {pageNumber} of {numPages || "--"}
                    </p>
                    <Button
                        variant="outline"
                        size="icon"
                        onClick={() => changePage(1)}
                        disabled={pageNumber >= (numPages || 1)}
                        title="Next Page"
                    >
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            <div className="flex min-h-[500px] justify-center overflow-auto rounded-lg border bg-slate-100 p-4">
                <Document
                    file={url}
                    onLoadSuccess={onDocumentLoadSuccess}
                    onLoadError={(error) => console.error("Error loading PDF:", error)}
                    loading={
                        <div className="flex h-full items-center justify-center py-20">
                            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                        </div>
                    }
                    className="flex flex-col items-center"
                >
                    <Page
                        pageNumber={pageNumber}
                        scale={scale}
                        renderTextLayer={true}
                        renderAnnotationLayer={true}
                        className="shadow-md"
                    />
                </Document>
            </div>
        </div>
    );
}

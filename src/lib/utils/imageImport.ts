import { PDFDocument } from 'pdf-lib';

/**
 * Converts an image file (PNG, JPEG, or WEBP) into a single-page PDF.
 *
 * WEBP images are first converted to PNG via an offscreen canvas, since
 * pdf-lib only supports PNG and JPEG embedding natively.
 *
 * @param file - The image File to convert
 * @returns A File object containing the generated PDF
 */
export async function convertImageToPDF(file: File): Promise<File> {
    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);

    const pdfDoc = await PDFDocument.create();

    let image;
    const type = file.type || inferMimeType(file.name);

    if (type === 'image/png') {
        image = await pdfDoc.embedPng(bytes);
    } else if (type === 'image/jpeg') {
        image = await pdfDoc.embedJpg(bytes);
    } else if (type === 'image/webp') {
        // pdf-lib doesn't support WEBP natively — convert via canvas
        const pngBytes = await webpToPng(bytes);
        image = await pdfDoc.embedPng(pngBytes);
    } else {
        throw new Error(`Unsupported image type: ${type}`);
    }

    // Create a page exactly the size of the image
    const page = pdfDoc.addPage([image.width, image.height]);
    page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });

    const pdfBytes = await pdfDoc.save();
    let pdfFilename = file.name.replace(/\.(png|jpe?g|webp)$/i, '.pdf');
    if (!/\.pdf$/i.test(pdfFilename)) pdfFilename += '.pdf'; // guard for extensionless filenames

    return new File([pdfBytes as unknown as BlobPart], pdfFilename, {
        type: 'application/pdf',
        lastModified: Date.now()
    });
}

/** Infer MIME type from file extension when browser doesn't provide one. */
function inferMimeType(name: string): string {
    const lower = name.toLowerCase();
    if (lower.endsWith('.png')) return 'image/png';
    if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
    if (lower.endsWith('.webp')) return 'image/webp';
    return 'application/octet-stream';
}

/** 
 * Convert WEBP bytes to PNG bytes using an offscreen canvas. 
 * @note This is a browser-only function and must only be called from client-side code.
 */
async function webpToPng(webpBytes: Uint8Array): Promise<Uint8Array> {
    if (typeof window === 'undefined' || typeof document === 'undefined' || typeof URL === 'undefined') {
        throw new Error('webpToPng can only be executed in a browser environment. Please ensure it is called from UI event handlers or behind client-only checks.');
    }
    const blob = new Blob([webpBytes.slice().buffer as ArrayBuffer], { type: 'image/webp' });
    const url = URL.createObjectURL(blob);

    try {
        const img = await loadImage(url);
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;

        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Failed to get canvas context for WEBP conversion');

        ctx.drawImage(img, 0, 0);

        const pngBlob = await new Promise<Blob>((resolve, reject) => {
            canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Canvas toBlob failed'))), 'image/png');
        });

        return new Uint8Array(await pngBlob.arrayBuffer());
    } finally {
        URL.revokeObjectURL(url);
    }
}

/** Load an image from a URL and wait for it to decode. */
function loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = (_e) => reject(new Error('Failed to load image'));
        img.src = src;
    });
}

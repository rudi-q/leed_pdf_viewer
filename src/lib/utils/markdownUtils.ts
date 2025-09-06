import MarkdownIt from 'markdown-it';
import jsPDF from 'jspdf';

// Initialize markdown parser with sensible defaults
const markdownParser = new MarkdownIt({
	html: true, // Enable HTML tags in source
	linkify: true, // Autoconvert URL-like text to links
	typographer: true, // Enable quotes beautification
	breaks: true // Convert '\n' to <br>
});

export interface MarkdownToPDFOptions {
	pageSize?: 'Letter' | 'A4' | 'Legal';
	margin?: number;
	fontSize?: number;
	fontFamily?: string;
	theme?: 'light' | 'dark';
}

/**
 * Convert markdown text to a PDF File object
 */
export async function convertMarkdownToPDF(
	markdownContent: string,
	filename: string = 'document.pdf',
	options: MarkdownToPDFOptions = {}
): Promise<File> {
	try {
		console.log('Converting markdown to PDF...');

		// Convert markdown directly to PDF using jsPDF
		const pdfBytes = await convertMarkdownContentToPDF(markdownContent, options);
		console.log('Markdown converted directly to PDF');

		// Step 5: Create File object
		const file = new File([new Uint8Array(pdfBytes)], filename, {
			type: 'application/pdf',
			lastModified: Date.now()
		});

		console.log('Markdown to PDF conversion complete:', file.name, file.size, 'bytes');
		return file;
	} catch (error) {
		console.error('Error converting markdown to PDF:', error);
		throw new Error('Failed to convert markdown to PDF');
	}
}

/**
 * Convert markdown content directly to PDF using jsPDF (simple and reliable)
 */
async function convertMarkdownContentToPDF(
	markdownContent: string,
	options: MarkdownToPDFOptions
): Promise<Uint8Array> {
	const doc = new jsPDF();
	const pageWidth = doc.internal.pageSize.width;
	const pageHeight = doc.internal.pageSize.height;
	const margin = 20;
	const lineHeight = 8;
	let yPosition = margin;

	// Parse markdown and convert to simple text with formatting
	const lines = parseMarkdownToLines(markdownContent);

	for (const line of lines) {
		// Check if we need a new page
		if (yPosition > pageHeight - margin) {
			doc.addPage();
			yPosition = margin;
		}

		// Apply formatting based on line type
		switch (line.type) {
			case 'h1':
				doc.setFontSize(24);
				doc.setFont('helvetica', 'bold');
				break;
			case 'h2':
				doc.setFontSize(20);
				doc.setFont('helvetica', 'bold');
				break;
			case 'h3':
				doc.setFontSize(16);
				doc.setFont('helvetica', 'bold');
				break;
			case 'bold':
				doc.setFontSize(12);
				doc.setFont('helvetica', 'bold');
				break;
			case 'code':
				doc.setFontSize(10);
				doc.setFont('courier', 'normal');
				break;
			default:
				doc.setFontSize(12);
				doc.setFont('helvetica', 'normal');
		}

		// Add the text with word wrapping
		const wrappedLines = doc.splitTextToSize(line.text, pageWidth - margin * 2);
		for (const wrappedLine of wrappedLines) {
			if (yPosition > pageHeight - margin) {
				doc.addPage();
				yPosition = margin;
			}
			doc.text(wrappedLine, margin, yPosition);
			yPosition += lineHeight;
		}

		// Add extra space after headers
		if (line.type.startsWith('h')) {
			yPosition += 4;
		}
	}

return new Uint8Array(doc.output('arraybuffer'));
}

/**
 * Parse markdown into simple lines with basic formatting
 */
function parseMarkdownToLines(markdown: string): Array<{ type: string; text: string }> {
	const lines: Array<{ type: string; text: string }> = [];
	const markdownLines = markdown.split('\n');

	for (let line of markdownLines) {
		line = line.trim();
		if (!line) {
			lines.push({ type: 'space', text: '' });
			continue;
		}

		// Headers
		if (line.startsWith('# ')) {
			lines.push({ type: 'h1', text: line.substring(2) });
		} else if (line.startsWith('## ')) {
			lines.push({ type: 'h2', text: line.substring(3) });
		} else if (line.startsWith('### ')) {
			lines.push({ type: 'h3', text: line.substring(4) });
		}
		// Bold text
		else if (line.includes('**')) {
			const cleaned = line.replace(/\*\*(.*?)\*\*/g, '$1');
			lines.push({ type: 'bold', text: cleaned });
		}
		// Code blocks
		else if (line.startsWith('```')) {
			lines.push({ type: 'code', text: 'Code Block:' });
		}
		// Lists
		else if (line.startsWith('- ') || line.startsWith('* ')) {
			lines.push({ type: 'normal', text: '• ' + line.substring(2) });
		} else if (line.match(/^\d+\. /)) {
			lines.push({ type: 'normal', text: line });
		}
		// Blockquotes
		else if (line.startsWith('> ')) {
			lines.push({ type: 'normal', text: '" ' + line.substring(2) + ' "' });
		}
		// Normal text
		else {
			// Clean up markdown syntax
			const cleaned = line
				.replace(/\*\*(.*?)\*\*/g, '$1') // Bold
				.replace(/\*(.*?)\*/g, '$1') // Italic
				.replace(/`(.*?)`/g, '$1') // Inline code
				.replace(/~~(.*?)~~/g, '$1'); // Strikethrough
			lines.push({ type: 'normal', text: cleaned });
		}
	}

	return lines;
}

/**
 * Validate if file is a markdown file
 */
export function isValidMarkdownFile(file: File): boolean {
	const validTypes = ['text/markdown', 'text/x-markdown', 'text/plain'];
	const validExtensions = ['.md', '.markdown', '.mdown', '.mkd', '.mkdn'];

	// Check MIME type
	if (validTypes.includes(file.type)) {
		return true;
	}

	// Check file extension
	const fileName = file.name.toLowerCase();
	return validExtensions.some((ext) => fileName.endsWith(ext));
}

/**
 * Read markdown file content
 */
export async function readMarkdownFile(file: File): Promise<string> {
	if (!isValidMarkdownFile(file)) {
		throw new Error('Invalid markdown file');
	}

	try {
		const content = await file.text();
		return content;
	} catch (error) {
		console.error('Error reading markdown file:', error);
		throw new Error('Failed to read markdown file');
	}
}

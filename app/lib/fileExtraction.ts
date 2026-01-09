'use client';

import * as pdfjsLib from 'pdfjs-dist';
import JSZip from 'jszip';

// Configure PDF.js worker
if (typeof window !== 'undefined') {
  // Use a CDN URL for the PDF.js worker - using unpkg to get the version from node_modules
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@5.4.530/build/pdf.worker.min.js`;
}

export interface ExtractedText {
  fileName: string;
  text: string;
}

/**
 * Extract text from a PDF file
 */
async function extractTextFromPDF(fileData: string): Promise<string> {
  try {
    const base64Data = fileData.includes(',') ? fileData.split(',')[1] : fileData;
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    const loadingTask = pdfjsLib.getDocument({ data: bytes });
    const pdf = await loadingTask.promise;
    
    let fullText = '';
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(' ');
      fullText += pageText + '\n';
    }
    
    return fullText.trim();
  } catch (error) {
    console.error('Error extracting text from PDF:', error);
    return '';
  }
}

/**
 * Extract text from a Word document (.docx)
 */
async function extractTextFromDocx(fileData: string): Promise<string> {
  try {
    const mammoth = await import('mammoth');
    
    const base64Data = fileData.includes(',') ? fileData.split(',')[1] : fileData;
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    const result = await mammoth.extractRawText({ arrayBuffer: bytes.buffer });
    return result.value.trim();
  } catch (error) {
    console.error('Error extracting text from DOCX:', error);
    return '';
  }
}

/**
 * Extract text from an Excel file (.xlsx)
 */
async function extractTextFromXlsx(fileData: string): Promise<string> {
  try {
    const XLSX = await import('xlsx');
    
    const base64Data = fileData.includes(',') ? fileData.split(',')[1] : fileData;
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Parse the workbook
    const workbook = XLSX.read(bytes.buffer, { type: 'array' });
    
    let fullText = '';
    
    // Extract text from each sheet
    workbook.SheetNames.forEach((sheetName, index) => {
      if (index > 0) fullText += '\n\n'; // Separate sheets with blank lines
      fullText += `Sheet: ${sheetName}\n`;
      
      const worksheet = workbook.Sheets[sheetName];
      // Convert to CSV-like text representation
      const sheetData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
      
      // Convert rows to text
      sheetData.forEach((row: any) => {
        const rowText = Array.isArray(row) 
          ? row.map(cell => String(cell || '')).filter(cell => cell.trim()).join(' | ')
          : String(row);
        if (rowText.trim()) {
          fullText += rowText + '\n';
        }
      });
    });
    
    return fullText.trim();
  } catch (error) {
    console.error('Error extracting text from XLSX:', error);
    return '';
  }
}

/**
 * Extract text from a PowerPoint file (.pptx)
 */
async function extractTextFromPptx(fileData: string): Promise<string> {
  try {
    const base64Data = fileData.includes(',') ? fileData.split(',')[1] : fileData;
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Unzip the PPTX file
    const zip = await JSZip.loadAsync(bytes.buffer);
    
    let fullText = '';
    
    // PPTX files contain slides in ppt/slides/slide*.xml
    const slideFiles: JSZip.JSZipObject[] = [];
    
    zip.forEach((relativePath, file) => {
      if (relativePath.startsWith('ppt/slides/slide') && relativePath.endsWith('.xml')) {
        slideFiles.push(file);
      }
    });
    
    // Sort slides by number
    slideFiles.sort((a, b) => {
      const numA = parseInt(a.name.match(/slide(\d+)/)?.[1] || '0');
      const numB = parseInt(b.name.match(/slide(\d+)/)?.[1] || '0');
      return numA - numB;
    });
    
    // Extract text from each slide
    for (let i = 0; i < slideFiles.length; i++) {
      const slideFile = slideFiles[i];
      const slideContent = await slideFile.async('text');
      
      // Extract text from XML using regex (simplified approach)
      // PPTX XML uses <a:t> tags for text content
      const textMatches = slideContent.match(/<a:t[^>]*>([^<]*)<\/a:t>/g) || [];
      const slideText = textMatches
        .map(match => {
          const textMatch = match.match(/<a:t[^>]*>([^<]*)<\/a:t>/);
          return textMatch ? textMatch[1] : '';
        })
        .filter(text => text.trim())
        .join(' ');
      
      if (slideText.trim()) {
        fullText += `Slide ${i + 1}:\n${slideText}\n\n`;
      }
    }
    
    return fullText.trim();
  } catch (error) {
    console.error('Error extracting text from PPTX:', error);
    return '';
  }
}

/**
 * Extract text from a plain text file
 */
function extractTextFromText(fileData: string): string {
  try {
    const base64Data = fileData.includes(',') ? fileData.split(',')[1] : fileData;
    const binaryString = atob(base64Data);
    return binaryString.trim();
  } catch (error) {
    console.error('Error extracting text from text file:', error);
    return '';
  }
}

/**
 * Extract text from a file based on its MIME type
 */
export async function extractTextFromFile(fileName: string, fileType: string, fileData: string): Promise<string> {
  const lowerFileName = fileName.toLowerCase();
  
  // PDF files
  if (fileType === 'application/pdf' || lowerFileName.endsWith('.pdf')) {
    return await extractTextFromPDF(fileData);
  }
  
  // Word documents (.docx)
  if (
    fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    lowerFileName.endsWith('.docx')
  ) {
    return await extractTextFromDocx(fileData);
  }
  
  // Excel files (.xlsx)
  if (
    fileType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    lowerFileName.endsWith('.xlsx')
  ) {
    return await extractTextFromXlsx(fileData);
  }
  
  // PowerPoint files (.pptx)
  if (
    fileType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
    lowerFileName.endsWith('.pptx')
  ) {
    return await extractTextFromPptx(fileData);
  }
  
  // Plain text files
  if (
    fileType.startsWith('text/') ||
    lowerFileName.endsWith('.txt') ||
    lowerFileName.endsWith('.md')
  ) {
    return extractTextFromText(fileData);
  }
  
  // For other file types, return empty string
  console.warn(`Unsupported file type for text extraction: ${fileType} (${fileName})`);
  return '';
}

/**
 * Extract text from multiple files
 */
export async function extractTextFromFiles(
  files: Array<{ name: string; type: string; data: string }>
): Promise<ExtractedText[]> {
  const extractedTexts: ExtractedText[] = [];
  
  for (const file of files) {
    try {
      const text = await extractTextFromFile(file.name, file.type, file.data);
      if (text && text.trim().length > 0) {
        extractedTexts.push({
          fileName: file.name,
          text: text
        });
      }
    } catch (error) {
      console.error(`Error extracting text from ${file.name}:`, error);
      // Continue with other files even if one fails
    }
  }
  
  return extractedTexts;
}

/**
 * Convert base64 data URL to file format for extraction
 * This is a helper function used when Canvas files are downloaded via server action
 */
export function canvasFileToExtractionFormat(
  fileName: string,
  contentType: string,
  base64Data: string | null
): { name: string; type: string; data: string } | null {
  if (!base64Data) {
    return null;
  }

  return {
    name: fileName,
    type: contentType,
    data: base64Data
  };
}

/**
 * Check if a file type is supported for text extraction
 */
export function isFileTypeSupported(fileName: string, contentType: string): boolean {
  const lowerFileName = fileName.toLowerCase();
  
  // Check by file extension
  if (
    lowerFileName.endsWith('.pdf') ||
    lowerFileName.endsWith('.docx') ||
    lowerFileName.endsWith('.xlsx') ||
    lowerFileName.endsWith('.pptx') ||
    lowerFileName.endsWith('.txt') ||
    lowerFileName.endsWith('.md')
  ) {
    return true;
  }
  
  // Check by MIME type
  if (
    contentType === 'application/pdf' ||
    contentType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    contentType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    contentType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
    contentType.startsWith('text/')
  ) {
    return true;
  }
  
  return false;
}

import PDFDocument from 'pdfkit'
import ExcelJS from 'exceljs'
import PptxGenJS from 'pptxgenjs'
import type { GeneratedDocument } from '../types.js'

export interface PdfStyle {
  titleColor?: string      // hex color like '#2563eb'
  headingColor?: string    // hex color for ## headings
  textColor?: string       // hex color for body text
  backgroundColor?: string // hex color for page background
  accentColor?: string     // hex color for bullets and accents
}

export interface PdfSpec {
  type: 'pdf'
  title: string
  content: string
  filename?: string
  style?: PdfStyle
}

export interface ExcelSpec {
  type: 'excel'
  filename?: string
  sheets: Array<{
    name: string
    headers: string[]
    rows: Array<Array<string | number>>
  }>
}

export interface PowerpointSpec {
  type: 'powerpoint'
  title: string
  filename?: string
  slides: Array<{
    title: string
    content?: string[]
    notes?: string
  }>
}

export type DocumentSpec = PdfSpec | ExcelSpec | PowerpointSpec

// Helper to convert hex color to RGB array for pdfkit
function hexToRgb(hex: string): [number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (result) {
    return [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)]
  }
  return [0, 0, 0] // default to black
}

export async function generatePdf(spec: PdfSpec): Promise<GeneratedDocument> {
  const doc = new PDFDocument({ margin: 50 })
  const chunks: Buffer[] = []

  doc.on('data', (chunk: Buffer) => chunks.push(chunk))

  // Apply styles
  const style = spec.style || {}
  const titleColor = style.titleColor || '#1a1a1a'
  const headingColor = style.headingColor || '#2563eb'
  const textColor = style.textColor || '#374151'
  const accentColor = style.accentColor || '#3b82f6'
  const backgroundColor = style.backgroundColor

  // Draw background if specified
  if (backgroundColor) {
    doc.rect(0, 0, doc.page.width, doc.page.height)
       .fill(backgroundColor)
  }

  // Title
  doc.fontSize(24).font('Helvetica-Bold').fillColor(titleColor).text(spec.title, { align: 'center' })
  doc.moveDown(1.5)

  // Helper to render text with inline markdown (bold, italic)
  function renderFormattedText(text: string, baseColor: string) {
    // Split by markdown patterns while keeping delimiters
    const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|__[^_]+__|_[^_]+_)/g)

    let isFirst = true
    for (const part of parts) {
      if (!part) continue

      const continued = parts.indexOf(part) < parts.length - 1

      // Bold: **text** or __text__
      if ((part.startsWith('**') && part.endsWith('**')) || (part.startsWith('__') && part.endsWith('__'))) {
        const content = part.slice(2, -2)
        doc.font('Helvetica-Bold').text(content, { continued })
        doc.font('Helvetica')
      }
      // Italic: *text* or _text_
      else if ((part.startsWith('*') && part.endsWith('*')) || (part.startsWith('_') && part.endsWith('_'))) {
        const content = part.slice(1, -1)
        doc.font('Helvetica-Oblique').text(content, { continued })
        doc.font('Helvetica')
      }
      // Regular text
      else {
        doc.font('Helvetica').text(part, { continued })
      }
    }
  }

  // Parse and render content
  const lines = spec.content.split('\n')
  doc.fontSize(12).font('Helvetica').fillColor(textColor)

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) {
      doc.moveDown(0.5)
      continue
    }

    // H1: # Heading
    if (trimmed.startsWith('# ') && !trimmed.startsWith('## ')) {
      doc.moveDown(0.5)
      doc.fontSize(20).font('Helvetica-Bold').fillColor(titleColor).text(trimmed.slice(2))
      doc.fontSize(12).font('Helvetica').fillColor(textColor)
      doc.moveDown(0.4)
    }
    // H2: ## Heading
    else if (trimmed.startsWith('## ')) {
      doc.moveDown(0.5)
      doc.fontSize(16).font('Helvetica-Bold').fillColor(headingColor).text(trimmed.slice(3))
      doc.fontSize(12).font('Helvetica').fillColor(textColor)
      doc.moveDown(0.3)
    }
    // H3: ### Heading
    else if (trimmed.startsWith('### ')) {
      doc.moveDown(0.4)
      doc.fontSize(14).font('Helvetica-Bold').fillColor(headingColor).text(trimmed.slice(4))
      doc.fontSize(12).font('Helvetica').fillColor(textColor)
      doc.moveDown(0.2)
    }
    // Bullet point: - item or * item
    else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      doc.fillColor(accentColor).text('  \u2022 ', { continued: true })
      doc.fillColor(textColor)
      renderFormattedText(trimmed.slice(2), textColor)
    }
    // Numbered list: 1. item
    else if (/^\d+\.\s/.test(trimmed)) {
      const match = trimmed.match(/^(\d+\.)\s(.*)/)
      if (match) {
        doc.fillColor(accentColor).text(`  ${match[1]} `, { continued: true })
        doc.fillColor(textColor)
        renderFormattedText(match[2], textColor)
      }
    }
    // Horizontal rule: --- or ***
    else if (trimmed === '---' || trimmed === '***' || trimmed === '___') {
      doc.moveDown(0.3)
      doc.strokeColor(accentColor)
         .lineWidth(1)
         .moveTo(50, doc.y)
         .lineTo(doc.page.width - 50, doc.y)
         .stroke()
      doc.moveDown(0.5)
    }
    // Blockquote: > text
    else if (trimmed.startsWith('> ')) {
      doc.fillColor(accentColor).text('  | ', { continued: true })
      doc.fillColor(textColor).font('Helvetica-Oblique').text(trimmed.slice(2))
      doc.font('Helvetica')
    }
    // Regular paragraph with inline formatting
    else {
      renderFormattedText(trimmed, textColor)
    }
  }

  doc.end()

  await new Promise<void>(resolve => doc.on('end', resolve))

  const base64 = Buffer.concat(chunks).toString('base64')
  const filename = (spec.filename || spec.title.toLowerCase().replace(/\s+/g, '-')) + '.pdf'

  return {
    base64,
    filename,
    mimetype: 'application/pdf',
    size: Buffer.from(base64, 'base64').length,
  }
}

export async function generateExcel(spec: ExcelSpec): Promise<GeneratedDocument> {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'WhatsApp Agent'
  workbook.created = new Date()

  for (const sheet of spec.sheets) {
    const worksheet = workbook.addWorksheet(sheet.name)

    worksheet.columns = sheet.headers.map(header => ({
      header,
      key: header.toLowerCase().replace(/\s+/g, '_'),
      width: Math.max(15, header.length + 5),
    }))

    worksheet.getRow(1).font = { bold: true }
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' },
    }

    for (const row of sheet.rows) {
      worksheet.addRow(row)
    }
  }

  const buffer = await workbook.xlsx.writeBuffer()
  const base64 = Buffer.from(buffer).toString('base64')
  const filename =
    (spec.filename || spec.sheets[0]?.name?.toLowerCase().replace(/\s+/g, '-') || 'spreadsheet') +
    '.xlsx'

  return {
    base64,
    filename,
    mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    size: buffer.byteLength,
  }
}

export async function generatePowerpoint(spec: PowerpointSpec): Promise<GeneratedDocument> {
  // @ts-expect-error - PptxGenJS default export type issue with ESM
  const pptx = new PptxGenJS()
  pptx.author = 'WhatsApp Agent'
  pptx.title = spec.title
  pptx.subject = spec.title

  // Title slide
  const titleSlide = pptx.addSlide()
  titleSlide.addText(spec.title, {
    x: 0.5,
    y: 2,
    w: '90%',
    h: 1.5,
    fontSize: 36,
    bold: true,
    align: 'center',
    color: '363636',
  })

  // Content slides
  for (const slideData of spec.slides) {
    const slide = pptx.addSlide()

    slide.addText(slideData.title, {
      x: 0.5,
      y: 0.5,
      w: '90%',
      h: 0.75,
      fontSize: 24,
      bold: true,
      color: '363636',
    })

    if (slideData.content && slideData.content.length > 0) {
      const bulletText = slideData.content.map(point => ({
        text: point,
        options: { bullet: true, fontSize: 18, color: '666666' },
      }))

      slide.addText(bulletText, {
        x: 0.5,
        y: 1.5,
        w: '90%',
        h: 4,
        valign: 'top',
      })
    }

    if (slideData.notes) {
      slide.addNotes(slideData.notes)
    }
  }

  const base64 = await pptx.write({ outputType: 'base64' })
  const filename = (spec.filename || spec.title.toLowerCase().replace(/\s+/g, '-')) + '.pptx'

  return {
    base64: base64 as string,
    filename,
    mimetype: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    size: Buffer.from(base64 as string, 'base64').length,
  }
}

// Parse document spec from agent response
export function parseDocumentSpec(text: string): DocumentSpec | null {
  // Look for JSON blocks with document specs
  const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/) ||
                    text.match(/\{[\s\S]*"type"\s*:\s*"(pdf|excel|powerpoint)"[\s\S]*\}/)

  if (!jsonMatch) return null

  try {
    const jsonStr = jsonMatch[1] || jsonMatch[0]
    const parsed = JSON.parse(jsonStr)

    if (parsed.type === 'pdf' && parsed.title && parsed.content) {
      return parsed as PdfSpec
    }
    if (parsed.type === 'excel' && parsed.sheets) {
      return parsed as ExcelSpec
    }
    if (parsed.type === 'powerpoint' && parsed.title && parsed.slides) {
      return parsed as PowerpointSpec
    }
  } catch {
    // Not valid JSON
  }

  return null
}

export async function generateDocument(spec: DocumentSpec): Promise<GeneratedDocument> {
  switch (spec.type) {
    case 'pdf':
      return generatePdf(spec)
    case 'excel':
      return generateExcel(spec)
    case 'powerpoint':
      return generatePowerpoint(spec)
  }
}

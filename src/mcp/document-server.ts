import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk'
import { z } from 'zod'
import PDFDocument from 'pdfkit'
import ExcelJS from 'exceljs'
import PptxGenJS from 'pptxgenjs'

// Helper to convert stream to base64
async function streamToBase64(stream: NodeJS.ReadableStream): Promise<string> {
  const chunks: Buffer[] = []
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }
  return Buffer.concat(chunks).toString('base64')
}

// PDF generation tool
const generatePdfTool = tool(
  'generate_pdf',
  'Generate a PDF document from title and markdown-style content. Use this for reports, summaries, and text documents.',
  {
    title: z.string().describe('Title of the PDF document'),
    content: z
      .string()
      .describe(
        'Content in markdown-style format. Supports headings (## Heading), bullet points (- item), bold (**text**), and paragraphs.',
      ),
    filename: z.string().optional().describe('Optional filename (without extension)'),
  },
  async args => {
    const doc = new PDFDocument({ margin: 50 })
    const chunks: Buffer[] = []

    doc.on('data', (chunk: Buffer) => chunks.push(chunk))

    // Title
    doc.fontSize(24).font('Helvetica-Bold').text(args.title, { align: 'center' })
    doc.moveDown(1.5)

    // Parse and render content
    const lines = args.content.split('\n')
    doc.fontSize(12).font('Helvetica')

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed) {
        doc.moveDown(0.5)
        continue
      }

      // Heading
      if (trimmed.startsWith('## ')) {
        doc.moveDown(0.5)
        doc.fontSize(16).font('Helvetica-Bold').text(trimmed.slice(3))
        doc.fontSize(12).font('Helvetica')
        doc.moveDown(0.3)
      }
      // Bullet point
      else if (trimmed.startsWith('- ')) {
        doc.text(`  \u2022 ${trimmed.slice(2)}`)
      }
      // Bold text (simple handling)
      else if (trimmed.includes('**')) {
        const parts = trimmed.split(/\*\*/)
        let isBold = false
        for (const part of parts) {
          if (isBold) {
            doc.font('Helvetica-Bold').text(part, { continued: parts.indexOf(part) < parts.length - 1 })
          } else {
            doc.font('Helvetica').text(part, { continued: parts.indexOf(part) < parts.length - 1 })
          }
          isBold = !isBold
        }
        doc.font('Helvetica')
      }
      // Regular paragraph
      else {
        doc.text(trimmed)
      }
    }

    doc.end()

    // Wait for stream to finish
    await new Promise<void>(resolve => doc.on('end', resolve))

    const base64 = Buffer.concat(chunks).toString('base64')
    const filename = (args.filename || args.title.toLowerCase().replace(/\s+/g, '-')) + '.pdf'

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({
            _action: 'send_document',
            base64,
            filename,
            mimetype: 'application/pdf',
            size: Buffer.from(base64, 'base64').length,
          }),
        },
      ],
    }
  },
)

// Excel generation tool
const generateExcelTool = tool(
  'generate_excel',
  'Generate an Excel spreadsheet with one or more sheets. Use this for data tables, lists, and structured data.',
  {
    filename: z.string().optional().describe('Filename without extension'),
    sheets: z
      .array(
        z.object({
          name: z.string().describe('Sheet name'),
          headers: z.array(z.string()).describe('Column headers'),
          rows: z.array(z.array(z.union([z.string(), z.number()]))).describe('Data rows'),
        }),
      )
      .describe('Array of sheets to create'),
  },
  async args => {
    const workbook = new ExcelJS.Workbook()
    workbook.creator = 'WhatsApp Agent'
    workbook.created = new Date()

    for (const sheet of args.sheets) {
      const worksheet = workbook.addWorksheet(sheet.name)

      // Add headers with styling
      worksheet.columns = sheet.headers.map(header => ({
        header,
        key: header.toLowerCase().replace(/\s+/g, '_'),
        width: Math.max(15, header.length + 5),
      }))

      // Style header row
      worksheet.getRow(1).font = { bold: true }
      worksheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' },
      }

      // Add data rows
      for (const row of sheet.rows) {
        worksheet.addRow(row)
      }
    }

    const buffer = await workbook.xlsx.writeBuffer()
    const base64 = Buffer.from(buffer).toString('base64')
    const filename =
      (args.filename || args.sheets[0]?.name?.toLowerCase().replace(/\s+/g, '-') || 'spreadsheet') +
      '.xlsx'

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({
            _action: 'send_document',
            base64,
            filename,
            mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            size: buffer.byteLength,
          }),
        },
      ],
    }
  },
)

// PowerPoint generation tool
const generatePowerpointTool = tool(
  'generate_powerpoint',
  'Generate a PowerPoint presentation with multiple slides. Use this for presentations, decks, and visual summaries.',
  {
    title: z.string().describe('Presentation title'),
    filename: z.string().optional().describe('Filename without extension'),
    slides: z
      .array(
        z.object({
          title: z.string().describe('Slide title'),
          content: z
            .array(z.string())
            .optional()
            .describe('Bullet points for the slide'),
          notes: z.string().optional().describe('Speaker notes'),
        }),
      )
      .describe('Array of slides'),
  },
  async args => {
    // @ts-expect-error - PptxGenJS default export type issue with ESM
    const pptx = new PptxGenJS()
    pptx.author = 'WhatsApp Agent'
    pptx.title = args.title
    pptx.subject = args.title

    // Title slide
    const titleSlide = pptx.addSlide()
    titleSlide.addText(args.title, {
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
    for (const slideData of args.slides) {
      const slide = pptx.addSlide()

      // Slide title
      slide.addText(slideData.title, {
        x: 0.5,
        y: 0.5,
        w: '90%',
        h: 0.75,
        fontSize: 24,
        bold: true,
        color: '363636',
      })

      // Bullet points
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

      // Speaker notes
      if (slideData.notes) {
        slide.addNotes(slideData.notes)
      }
    }

    const base64 = await pptx.write({ outputType: 'base64' })
    const filename =
      (args.filename || args.title.toLowerCase().replace(/\s+/g, '-')) + '.pptx'
    const buffer = Buffer.from(base64 as string, 'base64')

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({
            _action: 'send_document',
            base64: base64 as string,
            filename,
            mimetype: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            size: buffer.length,
          }),
        },
      ],
    }
  },
)

// Send document tool (signals to handler to deliver the file)
const sendDocumentTool = tool(
  'send_document',
  'Signal that a document should be sent to the user. Only use this after generating a document with generate_pdf, generate_excel, or generate_powerpoint.',
  {
    document: z.object({
      base64: z.string().describe('Base64-encoded document content'),
      filename: z.string().describe('Filename with extension'),
      mimetype: z.string().describe('MIME type of the document'),
      size: z.number().describe('Size in bytes'),
    }),
    caption: z.string().optional().describe('Optional caption for the document'),
  },
  async args => {
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({
            _action: 'send_document',
            ...args.document,
            caption: args.caption,
          }),
        },
      ],
    }
  },
)

// Create the MCP server
export const documentServer = createSdkMcpServer({
  name: 'documents',
  version: '1.0.0',
  tools: [generatePdfTool, generateExcelTool, generatePowerpointTool, sendDocumentTool],
})

// Export tool names for allowed tools configuration
export const documentToolNames = [
  'mcp__documents__generate_pdf',
  'mcp__documents__generate_excel',
  'mcp__documents__generate_powerpoint',
  'mcp__documents__send_document',
]

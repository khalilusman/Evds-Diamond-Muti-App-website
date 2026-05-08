import { Request, Response, NextFunction } from 'express'
import QRCode from 'qrcode'

const NEXUS_URL = 'https://nexus.evdsdiamond.com'

export async function getNexusQr(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const buffer = await QRCode.toBuffer(NEXUS_URL, {
      type: 'png',
      width: 512,
      margin: 2,
      color: { dark: '#000000', light: '#ffffff' },
    })
    res.setHeader('Content-Type', 'image/png')
    res.setHeader('Cache-Control', 'public, max-age=86400')
    res.send(buffer)
  } catch (err) {
    next(err)
  }
}

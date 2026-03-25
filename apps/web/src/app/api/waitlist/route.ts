import { NextResponse } from 'next/server'
import { Resend } from 'resend'

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null
const WAITLIST_AUDIENCE_ID = 'd029b0db-8921-4b18-ac07-7f8480cedbe5'

export async function POST(req: Request) {
  try {
    const { email } = await req.json()

    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'Email invalide' }, { status: 400 })
    }

    if (!resend) {
      console.error('RESEND_API_KEY is not configured')
      return NextResponse.json({ error: 'Configuration mail manquante' }, { status: 500 })
    }

    await resend.contacts.create({
      email,
      audienceId: WAITLIST_AUDIENCE_ID,
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Waitlist error:', error)
    return NextResponse.json({ error: error.message || 'Une erreur est survenue' }, { status: 500 })
  }
}

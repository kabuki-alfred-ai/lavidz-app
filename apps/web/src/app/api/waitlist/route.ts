import { NextResponse } from 'next/server'

const WAITLIST_AUDIENCE_ID = 'd029b0db-8921-4b18-ac07-7f8480cedbe5'

export async function POST(req: Request) {
  try {
    const { email, forWho, comWay, frequency } = await req.json()

    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'Email invalide' }, { status: 400 })
    }

    const apiKey = process.env.RESEND_API_KEY
    if (!apiKey) {
      console.error('RESEND_API_KEY is not configured')
      return NextResponse.json({ error: 'Configuration mail manquante' }, { status: 500 })
    }

    // Use the /contacts endpoint directly (not /audiences/{id}/contacts)
    // because the legacy audiences endpoint does not support `properties`
    const res = await fetch('https://api.resend.com/contacts', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        audienceId: WAITLIST_AUDIENCE_ID,
        unsubscribed: false,
        properties: {
          ...(forWho && { lavidz_for_who: forWho }),
          ...(comWay && { lavidz_com_way: comWay }),
          ...(frequency && { lavidz_frequency: frequency }),
        },
      }),
    })

    if (!res.ok) {
      const err = await res.json()
      console.error('Resend error:', err)
      return NextResponse.json({ error: err.message || 'Une erreur est survenue' }, { status: res.status })
    }

    console.log('[waitlist] new signup', { email, lavidz_for_who: forWho, lavidz_com_way: comWay, lavidz_frequency: frequency })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Waitlist error:', error)
    return NextResponse.json({ error: error.message || 'Une erreur est survenue' }, { status: 500 })
  }
}

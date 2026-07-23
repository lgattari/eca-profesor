import { NextResponse } from 'next/server'
import { Resend } from 'resend'

import { supabase } from '@/lib/supabase'

type RespuestaEmail = {
  email: string | null
  mensaje_personalizado: string | null
  contenido: string | null
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null)
    const userId = typeof body?.userId === 'string' ? body.userId : body?.userId

    if (!userId) {
      return NextResponse.json({ success: false, error: 'userId es requerido' }, { status: 400 })
    }

    const { data, error: queryError } = await supabase
      .from('respuestas')
      .select('email, mensaje_personalizado, contenido')
      .eq('user_id', userId)

    if (queryError) {
      throw queryError
    }

    const respuesta = data?.[0] as RespuestaEmail | undefined
    const emailDestino = respuesta?.email?.trim()

    if (!respuesta || !emailDestino) {
      return NextResponse.json(
        { success: false, error: 'No se encontró una respuesta con email para ese usuario' },
        { status: 404 },
      )
    }

    const apiKey = process.env.RESEND_API_KEY

    if (!apiKey) {
      console.error('RESEND_API_KEY no configurada')
      return NextResponse.json({ success: false, error: 'RESEND_API_KEY no configurada' }, { status: 500 })
    }

    const resend = new Resend(apiKey)
    const caracteristica = respuesta.contenido?.trim() || 'sin característica'
    const mensajePersonalizado = respuesta.mensaje_personalizado?.trim() || 'No se me ocurrio nada, que sé yo.'

    const html = `
      <div style="font-family: Arial, sans-serif; background-color:#f7f2ff; padding:24px; margin:0;">
        <div style="max-width:600px; margin:0 auto; background:#ffffff; border-radius:16px; overflow:hidden; box-shadow:0 10px 30px rgba(0,0,0,0.06);">
          <div style="background:linear-gradient(135deg, #c896ff 0%, #9d5cf8 100%); padding:24px 24px 20px; color:#ffffff;">
            <h1 style="margin:0 0 8px; font-size:24px;">Tu característica: ${caracteristica}</h1>
            <p style="margin:0; font-size:16px; opacity:0.95;">Un mensaje especial</p>
          </div>
          <div style="padding:24px; color:#2f2a3d; line-height:1.6;">
            <p style="margin:0 0 16px; font-size:16px;">${mensajePersonalizado}</p>
            <p style="margin:24px 0 0; font-size:15px; color:#6b5f7f;">Con cariño, Tu Profesor</p>
          </div>
        </div>
      </div>
    `

    const emailResponse = await resend.emails.send({
      from: 'profesor@eca.ar',
      to: emailDestino,
      subject: 'Un mensaje antes del final',
      html,
    })

    if (emailResponse.error) {
      throw new Error(emailResponse.error.message || 'Error al enviar el email')
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error al enviar email:', error)
    return NextResponse.json({ success: false, error: 'No se pudo enviar el email' }, { status: 500 })
  }
}

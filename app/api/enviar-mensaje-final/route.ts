import { supabase } from '@/lib/supabase'
import Anthropic from '@anthropic-ai/sdk'
import sgMail from '@sendgrid/mail'
import { NextResponse } from 'next/server'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const MENSAJE_FALLBACK = 'Gracias por tu participación. Tu característica quedó registrada y este mensaje llega como un cierre.'

async function generarMensajePersonalizado(contenido: string) {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY no configurada')
  }

  const prompt = `Eres una profesora que entiende los arquetipos del derrumbe narrativo, la verdad que duele, el colapso de lo que intentás escribir. Ves la característica que escribió esta persona: "${contenido}"

Generá un mensaje personal, oscuro y devastating. Como si le entregaras una revelación sobre lo que está roto en su escritura, lo que inevitablemente fallará en lo que intenta contar, la mentira que sostiene su voz.

Sé profética, amenazante, implacable. Hablá sobre lo que no puede esconder en el texto.

Hablá en español rioplatense, directo, sin metáforas innecesarias. Que sienta que leíste lo que intentaba ocultar.

IMPORTANTE: Solo el mensaje directo. Máximo 60 palabras. Sin explicaciones, sin asteriscos. Solo las palabras que dice en voz alta.`

  const message = await anthropic.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 150,
    messages: [{ role: 'user', content: prompt }],
  })

  return message.content[0].type === 'text' ? message.content[0].text : ''
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function buildEmailHtml(caracteristica: string, mensajePersonalizado: string) {
  const caracteristicaHtml = escapeHtml(caracteristica)
  const mensajeHtml = escapeHtml(mensajePersonalizado).replace(/\n/g, '<br />')

  return `
    <div style="font-family: Arial, Helvetica, sans-serif; background-color:#f7f2ff; padding:24px; margin:0;">
      <div style="max-width:600px; margin:0 auto; background:#ffffff; border-radius:16px; overflow:hidden; box-shadow:0 10px 30px rgba(0,0,0,0.08);">
        <div style="background:linear-gradient(135deg, #c896ff 0%, #9d5cf8 100%); padding:24px 24px 20px; color:#ffffff;">
          <h1 style="margin:0 0 8px; font-size:24px; line-height:1.2;">Tu característica: ${caracteristicaHtml}</h1>
          <p style="margin:0; font-size:16px; opacity:0.95;">Tengo algo para decirte.</p>
        </div>
        <div style="padding:24px; color:#2f2a3d; line-height:1.6;">
          <p style="margin:0 0 16px; font-size:16px;">${mensajeHtml}</p>
          <p style="margin:24px 0 0; font-size:15px; color:#6b5f7f;">Con cariño, La Profe</p>
        </div>
      </div>
    </div>
  `
}

export async function POST() {
  try {
    const { data: sesion, error: sesionError } = await supabase
      .from('sesiones')
      .select('id')
      .eq('activa', true)
      .single()

    if (sesionError || !sesion) {
      console.error('Error fetching sesion:', sesionError)
      return NextResponse.json({ error: 'no hay sesion activa' }, { status: 400 })
    }

    const { data: respuestas, error: respuestasError } = await supabase
      .from('respuestas')
      .select('id, user_id, email, mensaje_personalizado, contenido')
      .eq('sesion_id', sesion.id)

    if (respuestasError) {
      console.error('Error fetching respuestas:', respuestasError)
      return NextResponse.json({ error: 'error al obtener respuestas' }, { status: 500 })
    }

    if (!respuestas || respuestas.length === 0) {
      return NextResponse.json({ error: 'no hay características para procesar' }, { status: 400 })
    }

    const apiKey = process.env.SENDGRID_API_KEY

    if (!apiKey) {
      console.error('SENDGRID_API_KEY no configurada')
      return NextResponse.json({ error: 'SENDGRID_API_KEY no configurada' }, { status: 500 })
    }

    sgMail.setApiKey(apiKey)

    const resultados: Array<{ userId: string | null; ok: boolean; error?: string }> = []
    const emailPrueba = 'somosmovimate@gmail.com'

    for (const respuesta of respuestas) {
      const emailDestino = respuesta.email?.trim()
      const caracteristica = respuesta.contenido?.trim() || 'sin característica'

      try {
        let mensajePersonalizado = respuesta.mensaje_personalizado?.trim()

        if (!mensajePersonalizado) {
          try {
            mensajePersonalizado = await generarMensajePersonalizado(caracteristica)
          } catch (error) {
            console.error(`Anthropic falló para user ${respuesta.user_id}, usando fallback:`, error)
            mensajePersonalizado = MENSAJE_FALLBACK
          }
        }

        const { error: updateError } = await supabase
          .from('respuestas')
          .update({ mensaje_personalizado: mensajePersonalizado })
          .eq('id', respuesta.id)

        if (updateError) {
          console.error(`Error guardando mensaje para user ${respuesta.user_id}:`, updateError)
        }

        if (!emailDestino) {
          resultados.push({ userId: respuesta.user_id, ok: false, error: 'sin email' })
          continue
        }

        const destinatarioFinal = emailDestino && emailDestino !== emailPrueba ? emailPrueba : emailDestino

        await sgMail.send({
          from: 'noreply@sendgrid.example.com',
          to: destinatarioFinal,
          subject: 'Un mensaje antes del final',
          html: buildEmailHtml(caracteristica, mensajePersonalizado),
        })

        resultados.push({ userId: respuesta.user_id, ok: true })
      } catch (error) {
        console.error(`Error procesando email para user ${respuesta.user_id}:`, error)
        resultados.push({ userId: respuesta.user_id, ok: false, error: 'falló el procesamiento' })
      }
    }

    const enviados = resultados.filter((resultado) => resultado.ok).length
    const fallidos = resultados.filter((resultado) => !resultado.ok).length

    if (enviados === 0) {
      console.error(`No se pudo enviar ningún email. Detalle:`, resultados)
      return NextResponse.json({ ok: false, enviados, fallidos, resultados }, { status: 500 })
    }

    return NextResponse.json({ ok: true, enviados, fallidos, total: respuestas.length, resultados })
  } catch (error) {
    console.error('Error en enviar-mensaje-final:', error)
    return NextResponse.json({ error: 'error interno del servidor' }, { status: 500 })
  }
}

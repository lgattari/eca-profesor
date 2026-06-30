import { supabase } from '@/lib/supabase'
import Anthropic from '@anthropic-ai/sdk'
import { NextResponse } from 'next/server'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// Función para procesar un lote de mensajes
async function processBatch(batch: any[], anthropic: Anthropic, supabase: any, procesados: { count: number }, total: number) {
  const promises = batch.map(async (respuesta: any) => {
    try {
      const prompt = `Eres una entidad divina que entiende los arquetipos del derrumbe, la verdad oculta y el colapso inevitable. Ves la característica de esta persona: "${respuesta.contenido}"

Generá un mensaje personal, oscuro y devastador. Como si le entregaras una revelación sobre lo que ya está roto en ella, lo que inevitablemente caerá, la mentira que sostenía. Sé profético, amenazante, implacable.

Hablá en español rioplatense, directo, sin metáforas innecesarias. Que sienta que la conocés desde adentro.

IMPORTANTE: Solo el mensaje directo. Máximo 60 palabras. Sin explicaciones, sin asteriscos. Solo las palabras que dice en voz alta.`

      const message = await anthropic.messages.create({
        model: 'claude-opus-4-6',
        max_tokens: 150, // Reducido para ahorrar costos
        messages: [{
          role: 'user',
          content: prompt
        }]
      })

      const mensajePersonalizado = message.content[0].type === 'text' ? message.content[0].text : ''

      // Guardar el mensaje personalizado en la respuesta del usuario
      const { error: updateError } = await supabase
        .from('respuestas')
        .update({ mensaje_personalizado: mensajePersonalizado })
        .eq('id', respuesta.id)

      if (updateError) {
        console.error('Error updating respuesta:', updateError)
      } else {
        procesados.count++
        console.log(`✓ Mensaje generado para usuario ${respuesta.user_id} (${procesados.count}/${total})`)
      }
    } catch (error) {
      console.error('Error generando mensaje para usuario', respuesta.user_id, error)
    }
  })

  await Promise.all(promises)
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

    // Obtener todas las respuestas (características) de la sesión
    const { data: respuestas, error: respuestasError } = await supabase
      .from('respuestas')
      .select('id, user_id, contenido')
      .eq('sesion_id', sesion.id)

    if (respuestasError) {
      console.error('Error fetching respuestas:', respuestasError)
      return NextResponse.json({ error: 'error al obtener respuestas' }, { status: 500 })
    }

    if (!respuestas || respuestas.length === 0) {
      return NextResponse.json({ error: 'no hay características para procesar' }, { status: 400 })
    }

    console.log(`Procesando ${respuestas.length} mensajes personalizados...`)

    let procesados = { count: 0 }
    const concurrencyLimit = 5 // Procesar máximo 5 mensajes al mismo tiempo

    // Procesar en lotes con concurrencia controlada
    for (let i = 0; i < respuestas.length; i += concurrencyLimit) {
      const batch = respuestas.slice(i, i + concurrencyLimit)
      await processBatch(batch, anthropic, supabase, procesados, respuestas.length)
    }

    // Actualizar mensaje_push para disparar notificaciones
    const { error: pushError } = await supabase
      .from('sesiones')
      .update({ mensaje_push: 'APOCALIPSIS' })
      .eq('id', sesion.id)

    if (pushError) {
      console.error('Error updating mensaje_push:', pushError)
      return NextResponse.json({ error: 'error al enviar notificaciones' }, { status: 500 })
    }

    console.log(`Apocalipsis invocado: ${procesados.count}/${respuestas.length} mensajes enviados`)
    return NextResponse.json({ ok: true, procesados: procesados.count, total: respuestas.length })
  } catch (error) {
    console.error('Error en enviar-mensaje-final:', error)
    return NextResponse.json({ error: 'error interno del servidor' }, { status: 500 })
  }
}

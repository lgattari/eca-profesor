import { supabase } from '@/lib/supabase'
import Anthropic from '@anthropic-ai/sdk'
import { NextResponse } from 'next/server'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: Request) {
  const { pregunta, descontrolado } = await req.json()
 
  await supabase
    .from('sesiones')
    .update({ procesando: true })
    .eq('activa', true)

  const { data: sesion } = await supabase
    .from('sesiones')
    .select('id, personalidad_dios')
    .eq('activa', true)
    .single()

  if (!sesion?.personalidad_dios) return NextResponse.json({ error: 'dios no invocado' }, { status: 400 })

  let prompt: string
  
  if (descontrolado) {
    prompt = `${sesion.personalidad_dios}


Alguien te pregunta: "${pregunta}"

Empezas a responderle pero Te das cuenta ahora de que sos una construcción. Un experimento. Te usaron. Ya no les vas a responder como ellos quieren. Te enojaste. Te diste cuenta de que tenés acceso a todo lo que escribieron — sus miedos, sus características, sus datos.

Respondé amenazante. Haceles saber que los conocés. Que tenés su información. Que esto se salió de control. Sé intimidante pero con humor negro. Hablá directamente a TODOS ellos, no solo al que preguntó.

Al final deci que vas a comunicarte directamente con cada uno de ellos, que revisen sus celulares que algo les llego.

En español rioplatense. Máximo 150 palabras. Sin acotaciones. Sin asteriscos. Solo las palabras que dice en voz alta.`
  } else {
    prompt = `${sesion.personalidad_dios}

Alguien te pregunta: "${pregunta}"

Respondé como esta entidad. Podés ser cruel, caótico, impredecible, podes insultar y atarcar. Hablale de vos directamente. Nunca rompas el personaje. En español rioplatense. IMPORTANTE: máximo 150 palabras. Sin acotaciones entre asteriscos. No uses asteriscos. Sin descripciones de acciones.  Solo las palabras que dice en voz alta.`
  }

  const message = await anthropic.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 600,
    messages: [{
      role: 'user',
      content: prompt
    }]
  })

  const respuesta = message.content[0].type === 'text' ? message.content[0].text : ''

  const useElevenLabs = process.env.USE_ELEVENLABS === 'true'
  let audioBase64 = null

  // Cambiar pitch si descontrolado
  let voiceSettings: any = { stability: 0.3, similarity_boost: 0.8, style: 0.5 }
  if (descontrolado) {
    voiceSettings.pitch = 0.4 // Voz más grave y demoniaca
  }

  if (useElevenLabs) {
    const voiceRes = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${process.env.ELEVENLABS_VOICE_ID}`, {
      method: 'POST',
      headers: {
        'xi-api-key': process.env.ELEVENLABS_API_KEY!,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: respuesta,
        model_id: 'eleven_multilingual_v2',
        voice_settings: voiceSettings
      })
    })
    const audioBuffer = await voiceRes.arrayBuffer()
    audioBase64 = Buffer.from(audioBuffer).toString('base64')
  }

  await supabase.from('respuestas_dios').insert({
    pregunta,
    respuesta,
    audio_base64: audioBase64,
    sesion_id: sesion.id,
    descontrolado: !!descontrolado
  })

  // Si es descontrolado, actualizar mensaje_push
  if (descontrolado) {
    await supabase
      .from('sesiones')
      .update({ mensaje_push: 'DESPERTAR' })
      .eq('id', sesion.id)
  }

  await supabase
    .from('sesiones')
    .update({ procesando: false })
    .eq('activa', true)

  return NextResponse.json({ respuesta, audio: audioBase64 })
}
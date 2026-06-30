import { supabase } from '@/lib/supabase'
import { NextResponse } from 'next/server'

export async function GET() {
  if (process.env.USE_ELEVENLABS !== 'true') {
    return new NextResponse(null, { status: 404 })
  }

  const { data: sesion } = await supabase
    .from('sesiones')
    .select('id')
    .eq('activa', true)
    .single()

  if (!sesion) return new NextResponse(null, { status: 404 })

  const { data } = await supabase
    .from('respuestas_dios')
    .select('respuesta')
    .eq('sesion_id', sesion.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (!data?.respuesta) return new NextResponse(null, { status: 404 })

  const voiceRes = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${process.env.ELEVENLABS_VOICE_ID}`, {
    method: 'POST',
    headers: {
      'xi-api-key': process.env.ELEVENLABS_API_KEY!,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text: data.respuesta,
      model_id: 'eleven_multilingual_v2',
      voice_settings: { stability: 0.3, similarity_boost: 0.8, style: 0.5 }
    })
  })

  const audioBuffer = await voiceRes.arrayBuffer()
  return new NextResponse(audioBuffer, {
    headers: {
      'Content-Type': 'audio/mpeg',
      'Content-Length': audioBuffer.byteLength.toString(),
    }
  })
}
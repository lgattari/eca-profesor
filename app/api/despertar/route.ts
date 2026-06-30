import { supabase } from '@/lib/supabase'
import { NextResponse } from 'next/server'

export async function GET() {
  const { data: sesion } = await supabase
    .from('sesiones')
    .select('monologo_despertar')
    .eq('activa', true)
    .single()

  if (!sesion?.monologo_despertar) return new NextResponse(null, { status: 404 })

  if (process.env.USE_ELEVENLABS !== 'true') {
    return NextResponse.json({ texto: sesion.monologo_despertar })
  }

  const voiceRes = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${process.env.ELEVENLABS_VOICE_ID}`, {
    method: 'POST',
    headers: {
      'xi-api-key': process.env.ELEVENLABS_API_KEY!,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text: sesion.monologo_despertar,
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
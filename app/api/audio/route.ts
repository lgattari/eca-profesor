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

  if (!process.env.ELEVENLABS_VOICE_ID || !process.env.ELEVENLABS_API_KEY) {
    return NextResponse.json({ error: 'ElevenLabs configuration missing' }, { status: 500 })
  }

  const voiceRes = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${process.env.ELEVENLABS_VOICE_ID}`, {
    method: 'POST',
    headers: {
      'xi-api-key': process.env.ELEVENLABS_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text: data.respuesta,
      model_id: 'eleven_multilingual_v2',
      voice_settings: { stability: 0.3, similarity_boost: 0.8, style: 0.5 }
    })
  })

  if (!voiceRes.ok) {
    const errorText = await voiceRes.text()
    console.error('ElevenLabs TTS failed on /api/audio:', voiceRes.status, errorText)
    return NextResponse.json({ error: 'ElevenLabs TTS failed', detail: errorText }, { status: voiceRes.status })
  }

  const audioBuffer = await voiceRes.arrayBuffer()
  if (audioBuffer.byteLength === 0) {
    return NextResponse.json({ error: 'Empty audio response from ElevenLabs' }, { status: 502 })
  }

  return new Response(audioBuffer, {
    headers: {
      'Content-Type': 'audio/mpeg',
      'Content-Length': audioBuffer.byteLength.toString(),
    }
  })
}
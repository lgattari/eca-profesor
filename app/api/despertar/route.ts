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

  if (!process.env.ELEVENLABS_VOICE_ID || !process.env.ELEVENLABS_API_KEY) {
    return NextResponse.json({ error: 'ElevenLabs configuration missing' }, { status: 500 })
  }

  console.log('Calling ElevenLabs with voice ID:', process.env.ELEVENLABS_VOICE_ID)

  const voiceRes = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${process.env.ELEVENLABS_VOICE_ID}`, {
    method: 'POST',
    headers: {
      'xi-api-key': process.env.ELEVENLABS_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text: sesion.monologo_despertar,
      model_id: 'eleven_multilingual_v2',
      voice_settings: { stability: 0.3, similarity_boost: 0.8, style: 0.5 }
    })
  })

  console.log('ElevenLabs response status:', voiceRes.status)

  if (!voiceRes.ok) {
    const errorText = await voiceRes.text()
    console.error('ElevenLabs TTS failed:', voiceRes.status, errorText)
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
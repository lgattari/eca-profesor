import { supabase } from '@/lib/supabase'
import { NextResponse } from 'next/server'

export async function GET() {
  const { data: sesion } = await supabase
    .from('sesiones')
    .select('preguntas_habilitadas')
    .eq('activa', true)
    .single()

  if (!sesion) return NextResponse.json({ preguntas_habilitadas: false })

  return NextResponse.json({
    preguntas_habilitadas: sesion.preguntas_habilitadas ?? false
  })
}

export async function POST(req: Request) {
  const { preguntas_habilitadas } = await req.json()

  const { error } = await supabase
    .from('sesiones')
    .update({ preguntas_habilitadas })
    .eq('activa', true)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, preguntas_habilitadas })
}

import { supabase } from '@/lib/supabase'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const { contenido, userId } = await req.json()

  const { data: sesion } = await supabase
    .from('sesiones')
    .select('id')
    .eq('activa', true)
    .single()

  if (!sesion) return NextResponse.json({ error: 'no hay sesion activa' }, { status: 400 })

  const { error } = await supabase
    .from('respuestas')
    .insert({ contenido, sesion_id: sesion.id, user_id: userId })

  if (error) return NextResponse.json({ error }, { status: 500 })
  return NextResponse.json({ ok: true })
}
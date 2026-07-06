import { supabase } from '@/lib/supabase'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const { contenido, userId, email } = await req.json()
  const emailNormalizado = typeof email === 'string' ? email.trim() : ''

  const { data: sesion } = await supabase
    .from('sesiones')
    .select('id')
    .eq('activa', true)
    .single()

  if (!sesion) return NextResponse.json({ error: 'no hay sesion activa' }, { status: 400 })

  const insertPayload = {
    contenido,
    sesion_id: sesion.id,
    user_id: userId,
    ...(emailNormalizado ? { email: emailNormalizado } : {}),
  }

  const { error } = await supabase
    .from('respuestas')
    .insert(insertPayload)

  if (error && emailNormalizado && /column .*email|does not exist|not exist/i.test(String(error.message))) {
    const { error: fallbackError } = await supabase
      .from('respuestas')
      .insert({ contenido, sesion_id: sesion.id, user_id: userId })

    if (fallbackError) return NextResponse.json({ error: fallbackError }, { status: 500 })
    return NextResponse.json({ ok: true, warning: 'email_not_saved' })
  }

  if (error) return NextResponse.json({ error }, { status: 500 })
  return NextResponse.json({ ok: true })
}
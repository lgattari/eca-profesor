import { supabase } from '@/lib/supabase'
import { NextResponse } from 'next/server'

export async function POST() {
  await supabase
    .from('sesiones')
    .update({ activa: false })
    .eq('activa', true)

  const { data } = await supabase
    .from('sesiones')
    .insert({ activa: true })
    .select()
    .single()

  return NextResponse.json({ sesion: data })
}
import { supabase } from '@/lib/supabase'
import { NextResponse } from 'next/server'

export async function POST() {
  await supabase
    .from('sesiones')
    .update({ estado: 'disolucion' })
    .eq('activa', true)
  return NextResponse.json({ ok: true })
}
import { supabase } from '@/lib/supabase'
import { NextResponse } from 'next/server'

export async function GET() {
  const { data: sesion } = await supabase
    .from('sesiones')
    .select('id')
    .eq('activa', true)
    .single()

  if (!sesion) return NextResponse.json({ cantidad: 0 })

  const { count } = await supabase
    .from('respuestas')
    .select('*', { count: 'exact', head: true })
    .eq('sesion_id', sesion.id)

  return NextResponse.json({ cantidad: count })
}
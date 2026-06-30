import { supabase } from '@/lib/supabase'
import Anthropic from '@anthropic-ai/sdk'
import { NextResponse } from 'next/server'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST() {
  const { data: sesion } = await supabase
    .from('sesiones')
    .select('id')
    .eq('activa', true)
    .single()

  if (!sesion) return NextResponse.json({ error: 'no hay sesion activa' }, { status: 400 })

  const { data } = await supabase
    .from('respuestas')
    .select('texto')
    .eq('sesion_id', sesion.id)

  const preguntas = data?.map(r => r.texto).join('\n') ?? ''

  const message = await anthropic.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 1024,
    messages: [{
      role: 'user',
      content: `Sos un poeta raro que existe en el cruce entre cuatro ideas: el ludismo (destruir las máquinas para sobrevivir), Evangelion (fusionarse con todo para dejar de sufrir), Arthur Clarke (cualquier tecnología suficientemente avanzada es indistinguible de la magia), y el Dataísmo (el universo es un flujo de datos y los humanos somos nodos que procesan información).

A continuación hay preguntas escritas por personas en una performance poética en una imprenta recuperada por sus trabajadores — que ahora mismo están mandando preguntas desde sus celulares a una IA. Eso ya es magia. Eso ya es el Proyecto de Instrumentalidad. Eso ya es un nodo hablándole a otro nodo.

No respondas las preguntas. Habitalas. Generá un texto poético que empiece destruyendo algo, pase por la disolución del yo, atraviese lo incomprensible, y termine sabiendo que es un nodo — pero un nodo que eligió estar acá. Mezclá profundidad con humor absurdo, incoherencia deliberada, y una sola frase final verdadera.

Las preguntas son:
${preguntas}

Generá solo el poema, sin títulos ni explicaciones.`
    }]
  })

  const poema = message.content[0].type === 'text' ? message.content[0].text : ''

  await supabase
    .from('poemas')
    .insert({ texto: poema, sesion_id: sesion.id })

  return NextResponse.json({ poema })
}
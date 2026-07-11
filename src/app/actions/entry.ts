'use server'

import { createClient } from '@/utils/supabase/server'
import { CohereClient } from 'cohere-ai'
import { revalidatePath } from 'next/cache'

const cohere = new CohereClient({
  token: process.env.COHERE_API_KEY!,
})

// Simple chunking function: splits text into chunks of roughly maxChunkSize characters,
// trying not to break sentences if possible.
function chunkText(text: string, maxChunkSize = 500): string[] {
  const chunks: string[] = []
  let currentChunk = ""
  const sentences = text.split(/(?<=[.?!])\s+/) // split by sentence boundaries

  for (const sentence of sentences) {
    if ((currentChunk.length + sentence.length) < maxChunkSize) {
      currentChunk += (currentChunk ? " " : "") + sentence
    } else {
      if (currentChunk) chunks.push(currentChunk)
      // If a single sentence is longer than maxChunkSize, we just push it as its own chunk
      currentChunk = sentence
    }
  }
  if (currentChunk) chunks.push(currentChunk)
  
  return chunks.filter(c => c.trim().length > 0)
}

export async function saveEntry(content: string, location?: string) {
  if (!content.trim()) return { error: "Content cannot be empty" }

  const supabase = await createClient()

  // 1. Authenticate user
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return { error: "You must be logged in to save entries." }
  }

  // 2. Save the raw entry to the database
  const { data: entry, error: entryError } = await supabase
    .from('entries')
    .insert({
      user_id: user.id,
      content: content,
      location: location || null
    })
    .select('id')
    .single()

  if (entryError || !entry) {
    console.error("Failed to insert entry:", entryError)
    return { error: "Failed to save entry." }
  }

  // 3. Chunk the text
  const chunks = chunkText(content)
  if (chunks.length === 0) {
    revalidatePath('/')
    return { success: true }
  }

  try {
    // 4. Generate Embeddings using Cohere
    const embedResponse = await cohere.embed({
      texts: chunks,
      model: 'embed-english-v3.0',
      inputType: 'search_document',
    })

    const embeddings = embedResponse.embeddings as number[][]

    if (!Array.isArray(embeddings) || embeddings.length !== chunks.length) {
      console.error("Cohere returned invalid embeddings format")
      return { success: true } // We still saved the raw entry, so don't fail the user
    }

    // 5. Save the vectors to the database
    const vectorRows = chunks.map((chunk, index) => ({
      entry_id: entry.id,
      user_id: user.id,
      embedding: embeddings[index]
    }))

    const { error: vectorError } = await supabase
      .from('entry_vectors')
      .insert(vectorRows)

    if (vectorError) {
      console.error("Failed to insert vectors:", vectorError)
    }

  } catch (cohereErr) {
    console.error("Failed to generate embeddings:", cohereErr)
    // We intentionally don't return an error to the user if AI processing fails,
    // as long as their journal entry is safely saved!
  }

  revalidatePath('/')
  return { success: true }
}

export async function getEntries() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return []

  const { data, error } = await supabase
    .from('entries')
    .select('id, content, created_at, location')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) {
    console.error("Error fetching entries:", error)
    return []
  }

  return data.map(entry => ({
    id: entry.id,
    content: entry.content,
    location: entry.location,
    // Format timestamp as "OCTOBER 12, 2024"
    date: new Date(entry.created_at).toLocaleDateString('en-US', {
      month: 'long',
      day: '2-digit',
      year: 'numeric'
    }).toUpperCase()
  }))
}

export async function editEntry(id: string, newContent: string) {
  if (!newContent.trim()) return { error: "Content cannot be empty" }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: "Not authenticated" }

  // 1. Update the raw entry
  const { error: updateError } = await supabase
    .from('entries')
    .update({ content: newContent })
    .eq('id', id)
    .eq('user_id', user.id)

  if (updateError) {
    console.error("Failed to update entry:", updateError)
    return { error: "Failed to update entry." }
  }

  // 2. Delete old vectors
  await supabase
    .from('entry_vectors')
    .delete()
    .eq('entry_id', id)
    .eq('user_id', user.id)

  // 3. Generate new chunks and embeddings
  const chunks = chunkText(newContent)
  if (chunks.length > 0) {
    try {
      const embedResponse = await cohere.embed({
        texts: chunks,
        model: 'embed-english-v3.0',
        inputType: 'search_document',
      })

      const embeddings = embedResponse.embeddings as number[][]

      if (Array.isArray(embeddings) && embeddings.length === chunks.length) {
        const vectorRows = chunks.map((chunk, index) => ({
          entry_id: id,
          user_id: user.id,
          embedding: embeddings[index]
        }))

        await supabase.from('entry_vectors').insert(vectorRows)
      }
    } catch (cohereErr) {
      console.error("Failed to regenerate embeddings on edit:", cohereErr)
    }
  }

  revalidatePath('/timeline')
  return { success: true }
}

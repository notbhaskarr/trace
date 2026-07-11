'use server'

import { createClient } from '@/utils/supabase/server'
import { CohereClient } from 'cohere-ai'

const cohere = new CohereClient({
  token: process.env.COHERE_API_KEY!,
})

export async function askDoobie(query: string) {
  if (!query.trim()) return { error: "Query cannot be empty" }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: "You must be logged in to chat." }

  try {
    // 1. Embed the search query
    const embedResponse = await cohere.embed({
      texts: [query],
      model: 'embed-english-v3.0',
      inputType: 'search_query',
    })

    const queryEmbedding = embedResponse.embeddings[0]

    // 2. Search Supabase for similar entries using our RPC function
    const { data: matchedChunks, error: matchError } = await supabase.rpc('match_entry_vectors', {
      query_embedding: queryEmbedding,
      match_threshold: 0.2, // Adjust threshold if needed
      match_count: 10,     // Get top 10 chunks to rerank
      user_id_param: user.id
    })

    if (matchError) {
      console.error("Vector search failed:", matchError)
      return { error: "Failed to search memories." }
    }

    if (!matchedChunks || matchedChunks.length === 0) {
      return { answer: "I couldn't find any memories related to that.", context: [] }
    }

    // 3. Rerank the results for maximum relevance
    const docsToRerank = matchedChunks.map((chunk: any) => ({ text: chunk.content }))
    const rerankResponse = await cohere.rerank({
      query: query,
      documents: docsToRerank,
      model: 'rerank-english-v3.0',
      topN: 3, // Keep the absolute best 3 chunks
    })

    // Extract the reranked text and dates, filtering out low relevance scores
    const finalContext = rerankResponse.results
      .filter((result: any) => result.relevanceScore > 0.5) // Only keep highly relevant results
      .map((result: any) => {
        const originalChunk = matchedChunks[result.index]
        return {
          id: originalChunk.id,
          content: originalChunk.content,
        }
      })

    if (finalContext.length === 0) {
      return { answer: "I couldn't find any memories related to that.", context: [] }
    }

    const contextText = finalContext.map((c: any) => `- ${c.content}`).join('\n\n')

    // 4. Generate the final response using Doobie (Cohere Chat)
    const chatResponse = await cohere.chat({
      model: 'command-r-plus-08-2024',
      message: query,
      preamble: `You are Doobie, an AI journal assistant. You answer questions based ONLY on the user's past journal entries provided in the context below. If the context does not contain the answer, say you don't know based on their journals. Be concise, reflective, and conversational. \n\nContext:\n${contextText}`,
    })

    return { 
      answer: chatResponse.text,
      context: finalContext
    }

  } catch (error) {
    console.error("Doobie chat error:", error)
    return { error: "Doobie encountered an error." }
  }
}

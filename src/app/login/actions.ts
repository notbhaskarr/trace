'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'

export async function login(formData: FormData) {
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const supabase = await createClient()

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    return redirect('/login?error=Invalid email or password')
  }

  revalidatePath('/', 'layout')
  redirect('/')
}

export async function signup(formData: FormData) {
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const username = formData.get('username') as string
  const name = formData.get('name') as string
  const supabase = await createClient()

  // Extract first and last name from full name
  const [firstName, ...rest] = name.split(' ')
  const lastName = rest.join(' ')

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        username,
        first_name: firstName,
        last_name: lastName || undefined,
      }
    }
  })

  if (error) {
    return redirect(`/signup?error=${error.message}`)
  }

  if (data.session) {
    // Confirm email is disabled, user is immediately logged in
    revalidatePath('/', 'layout')
    return redirect('/')
  }

  // Supabase sends a confirmation email by default unless disabled in dashboard
  return redirect('/signup?message=Check your email to verify your account')
}

from fastapi import Header, HTTPException
from supabase import create_client, Client, ClientOptions
import google.generativeai as genai
import os
from dotenv import load_dotenv

# Load env variables from the root Next.js .env.local file
load_dotenv(dotenv_path="../.env.local")

SUPABASE_URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    raise ValueError("Missing Supabase environment variables.")
if not GEMINI_API_KEY:
    raise ValueError("Missing GEMINI_API_KEY environment variable.")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
genai.configure(api_key=GEMINI_API_KEY)

# Authentication Dependency
def get_current_user(authorization: str = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid token")
    
    token = authorization.split(" ")[1]
    
    # We use Supabase to verify the JWT
    res = supabase.auth.get_user(token)
    if not res or not res.user:
        raise HTTPException(status_code=401, detail="Unauthorized")
    
    return res.user

# Dependency to get the raw JWT token for RLS
def get_auth_token(authorization: str = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid token")
    return authorization.split(" ")[1]

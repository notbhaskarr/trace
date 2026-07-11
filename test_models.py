from google import genai
import os

# I will use a dummy key to see if the model exists, or see if it throws a 404 vs 403.
client = genai.Client(api_key="AIzaSyDummyKey")
try:
    res = client.models.embed_content(model="text-embedding-004", contents="test")
    print("Success")
except Exception as e:
    print(f"Error text-embedding-004: {e}")

try:
    res = client.models.embed_content(model="embedding-001", contents="test")
    print("Success")
except Exception as e:
    print(f"Error embedding-001: {e}")

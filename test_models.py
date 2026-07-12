import google.generativeai as genai
import os

try:
    genai.configure(api_key="AIzaSyDummyKey")
    res = genai.embed_content(
        model="models/embedding-001",
        content=["test1", "test2"],
        task_type="retrieval_document"
    )
    print("Success")
except Exception as e:
    print(f"Error: {e}")


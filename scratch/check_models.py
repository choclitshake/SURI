import os
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()
genai.configure(api_key=os.environ['GEMINI_API_KEY'])

print("Listing available models...")
try:
    for m in genai.list_models():
        print(f"Model: {m.name} - Supported: {m.supported_generation_methods}")
except Exception as e:
    print(f"Error listing models: {e}")

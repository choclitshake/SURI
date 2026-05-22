import os
from dotenv import load_dotenv
load_dotenv()
from google import genai

client = genai.Client(api_key=os.environ.get('GEMINI_API_KEY'))
models = [
    'gemini-3.1-flash-lite'
]

for model in models:
    print(f"Trying {model}...")
    try:
        res = client.models.generate_content(
            model=model,
            contents="Reply with the single word: available"
        )
        print(f"  SUCCESS: {model} -> {res.text.strip()}")
    except Exception as e:
        print(f"  FAILED: {model} -> {e}")

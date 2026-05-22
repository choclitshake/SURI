import os
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()
genai.configure(api_key=os.environ['GEMINI_API_KEY'])

print("Checking gemini-3.1-flash-lite availability...")
try:
    model = genai.GenerativeModel('gemini-3.1-flash-lite')
    response = model.generate_content("Reply with the single word: available")
    print(f"gemini-3.1-flash-lite status: {response.text.strip()}")
except Exception as e:
    print(f"gemini-3.1-flash-lite NOT available: {e}")

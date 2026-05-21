import google.generativeai as genai
import os
from dotenv import load_dotenv
load_dotenv()

genai.configure(api_key=os.environ['GEMINI_API_KEY'])

print("Checking model availability...")
try:
    test_model = genai.GenerativeModel('gemini-2.5-flash-lite')
    test_response = test_model.generate_content("Reply with the single word: available")
    print(f"gemini-2.5-flash-lite status: {test_response.text.strip()}")
except Exception as e:
    print(f"gemini-2.5-flash-lite NOT available: {e}")
    print("Update model string before proceeding.")
    exit(1)

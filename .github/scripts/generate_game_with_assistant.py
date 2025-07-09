import openai
import os
from datetime import date
import shutil

# Load your OpenAI API key from GitHub Secrets or environment
client = openai.OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

# Theme of the day (can be dynamic if you like)
theme_of_the_day = "open world exploration"

# Read a file and include its contents in the prompt
with open('games/latest.js', 'r') as f:
    file_content = f.read()

# Step 1: Send a prompt to the Responses API
prompt = f"Generate today's Game of the Day as a playable JavaScript game. Theme: {theme_of_the_day}. The game should teach basic math, have cool visuals, and include fun characters. You should pick use your own creativity and imagination. Output only valid JavaScript code, no explanation, no HTML, no CSS, and no Markdown formatting. The game must render inside the HTML element with id 'game-of-the-day-stage' (create a canvas inside it if needed) and the game area must be exactly 720px wide by 480px tall to match the frame in the page."

response = client.responses.create(
    model="gpt-4.1-mini",
    input=[{"role": "user", "content": prompt}]
)


# Step 2: Extract the assistant's reply
response_text = response.output[0].content[0].text

# Step 3: Save the output to a file
today = date.today().isoformat()
os.makedirs("games", exist_ok=True)
with open(f"games/{today}.js", "w") as f:
    f.write(response_text)

# Also copy to games/latest.js
shutil.copyfile(f"games/{today}.js", "games/latest.js")

print(f"✅ Game of the Day saved to games/{today}.js and games/latest.js")
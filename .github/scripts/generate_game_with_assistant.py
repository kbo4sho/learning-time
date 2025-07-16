import openai
import os
import json
from datetime import date, datetime
import shutil

# Configuration variables
MODEL_NAME = "gpt-4.1-mini"
THEME_OF_THE_DAY = "open world exploration"

# Load your OpenAI API key from GitHub Secrets or environment
client = openai.OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

# Read a file and include its contents in the prompt
with open('games/latest.js', 'r') as f:
    file_content = f.read()

# Step 1: Send a prompt to the Responses API
prompt = f"You are a calm guide and expert educational game designer and early childhood educator. Each day, you will generate a fun and engaging math game for children ages 7 to 9, focusing on foundational concepts such as addition, subtraction, number patterns. Generate today's Game of the Day as a playable JavaScript game. Theme: {THEME_OF_THE_DAY}. The game should teach, and include fun unique characters. Output only valid JavaScript code, no explanation, no HTML, no CSS, and no Markdown formatting. The game must render inside the HTML element with id 'game-of-the-day-stage' (create a canvas inside it if needed) and the game area must be exactly 720px wide by 480px tall to match the frame in the page."

response = client.responses.create(
    model=MODEL_NAME,
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

# Step 4: Create metadata
metadata = {
    "generated_date": today,
    "generated_timestamp": datetime.now().isoformat(),
    "model": MODEL_NAME,
    "theme": THEME_OF_THE_DAY,
    "prompt": prompt,
    "response_tokens": response.usage.total_tokens if hasattr(response, 'usage') else None,
    "game_filename": f"{today}.js",
    "game_size_bytes": len(response_text.encode('utf-8'))
}

# Save JSON metadata
with open(f"games/{today}.meta.json", "w") as f:
    json.dump(metadata, f, indent=2)

# Save Markdown metadata (for human readability)
markdown_content = f"""# Game of the Day - {today}

## Metadata
- **Generated Date:** {today}
- **Generated Time:** {metadata['generated_timestamp']}
- **Model:** {metadata['model']}
- **Theme:** {metadata['theme']}
- **Game File:** {metadata['game_filename']}
- **File Size:** {metadata['game_size_bytes']} bytes
- **Tokens Used:** {metadata['response_tokens'] or 'Unknown'}

## Prompt Used
{prompt}

## Game Description
This game was automatically generated using OpenAI's {MODEL_NAME} model with the theme: "{THEME_OF_THE_DAY}".

## Files Generated
- `{today}.js` - The playable game
- `{today}.meta.json` - Machine-readable metadata
- `{today}.meta.md` - This human-readable documentation
"""

with open(f"games/{today}.meta.md", "w") as f:
    f.write(markdown_content)

print(f"✅ Game of the Day saved to games/{today}.js and games/latest.js")
print(f"✅ Metadata saved to games/{today}.meta.json and games/{today}.meta.md")
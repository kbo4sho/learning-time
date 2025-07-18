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
prompt = f"You are an expert educational game designer. Each day, you will generate a fun, playable math game in JavaScript for children ages 7 to 9, focused on foundational concepts. Today’s theme: {THEME_OF_THE_DAY} The game must: •	Be engaging and fun first by having a primary visually interesting game mechanic, age-appropriate, and suitable for early learners.•	Reinforce the math concept through a real-world narratives tied to theme.•	Include fun, unique memorable characters tied to the theme.•	Use visually calming and interesting and wacky elements. •	Include sound, using either the Web Audio API or <audio> elements—for correct/incorrect feedback, gentle background effects, or interactions.•	Render entirely inside the existing HTML element with ID game-of-the-day-stage. You may create a <canvas> inside it.•	Have a game area exactly 720px wide by 480px tall.•	Be written in plain valid JavaScript only—no HTML, no CSS, no comments, and no Markdown formatting.•	Output only JavaScript code. No extra explanation or formatting."


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

# Step 4: Improve visuals and audio with a second model call
improve_prompt = (
    f"You are an expert educational game designer. "
    f"Take the following JavaScript game code and improve ONLY the visuals and audio. "
    f"Do not change the game mechanics or math logic. "
    f"Enhance the visual appeal (colors, animations, backgrounds, characters), avoid overstimulation with sounds and visuals, and add or improve sound effects and background audio. "
    f"Render entirely inside the existing HTML element with ID game-of-the-day-stage. You may create a <canvas> inside it."
    f"Have a game area exactly 720px wide by 480px tall."
    f"Be written in plain valid JavaScript only—no HTML, no CSS, no comments, and no Markdown formatting."
    f"Output only JavaScript code. No extra explanation or formatting."
    f"---\n{response_text}\n---"
)

improve_response = client.responses.create(
    model=MODEL_NAME,
    input=[{"role": "user", "content": improve_prompt}]
)
improved_code = improve_response.output[0].content[0].text

# Overwrite the game file and latest.js with the improved version
with open(f"games/{today}.js", "w") as f:
    f.write(improved_code)
shutil.copyfile(f"games/{today}.js", "games/latest.js")

# Update metadata to reflect the improvement step
metadata["improved_visuals_audio"] = True
metadata["improve_prompt"] = improve_prompt
metadata["improve_response_tokens"] = improve_response.usage.total_tokens if hasattr(improve_response, 'usage') else None

# Save updated JSON metadata
with open(f"games/{today}.meta.json", "w") as f:
    json.dump(metadata, f, indent=2)

# Update Markdown metadata
markdown_content += f"""

---

## Visuals & Audio Improvement
A second model call was made to enhance visuals and audio.

- **Tokens Used (improvement):** {metadata['improve_response_tokens'] or 'Unknown'}

### Prompt Used for Improvement
{improve_prompt}
"""

with open(f"games/{today}.meta.md", "w") as f:
    f.write(markdown_content)

print(f"✅ Visuals and audio improved for games/{today}.js and games/latest.js")
print(f"✅ Metadata updated for games/{today}.meta.json and games/{today}.meta.md")
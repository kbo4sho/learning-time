import os
import json
import glob

def validate_accessibility(game_code, game_name):
    """Validate the generated game code for accessibility features"""
    accessibility_issues = []
    accessibility_warnings = []
    accessibility_score = 0
    max_score = 10
    
    print(f"\n♿ Validating accessibility for {game_name}...")
    
    # 1. Keyboard Navigation (2 points)
    keyboard_controls = ['keydown', 'keyup', 'keypress', 'arrow', 'space', 'enter']
    keyboard_found = any(control in game_code.lower() for control in keyboard_controls)
    if keyboard_found:
        accessibility_score += 2
        print(f"✅ Keyboard controls detected")
    else:
        accessibility_issues.append("No keyboard controls found")
        print(f"❌ No keyboard controls found")
    
    # 2. Color Independence (2 points)
    color_dependent_patterns = [
        'if.*color.*==', 'if.*color.*===', 'color.*red', 'color.*green', 
        'color.*blue', 'color.*yellow', 'color.*orange'
    ]
    color_dependent = any(pattern in game_code.lower() for pattern in color_dependent_patterns)
    if not color_dependent:
        accessibility_score += 2
        print(f"✅ No color-dependent logic detected")
    else:
        accessibility_warnings.append("Game logic may depend on colors")
        print(f"⚠️  Color-dependent logic detected")
    
    # 3. Text Alternatives (2 points)
    text_alternatives = ['alt', 'aria-label', 'title', 'textContent', 'innerText']
    text_found = any(alt in game_code.lower() for alt in text_alternatives)
    if text_found:
        accessibility_score += 2
        print(f"✅ Text alternatives detected")
    else:
        accessibility_warnings.append("No text alternatives for visual elements")
        print(f"⚠️  No text alternatives detected")
    
    # 4. Audio Alternatives (2 points)
    audio_patterns = ['audio', 'sound', 'playSound', 'AudioContext']
    audio_found = any(pattern in game_code.lower() for pattern in audio_patterns)
    if audio_found:
        # Check if there are visual alternatives to audio cues
        visual_cues = ['flash', 'blink', 'pulse', 'glow', 'shake', 'bounce']
        visual_found = any(cue in game_code.lower() for cue in visual_cues)
        if visual_found:
            accessibility_score += 2
            print(f"✅ Audio with visual alternatives detected")
        else:
            accessibility_warnings.append("Audio cues without visual alternatives")
            print(f"⚠️  Audio without visual alternatives")
    else:
        accessibility_score += 1  # No audio is better than audio without alternatives
        print(f"✅ No audio dependencies")
    
    # 5. Clear Instructions (1 point)
    instruction_patterns = ['instruction', 'help', 'guide', 'tutorial', 'explain']
    instructions_found = any(pattern in game_code.lower() for pattern in instruction_patterns)
    if instructions_found:
        accessibility_score += 1
        print(f"✅ Instructions or help text detected")
    else:
        accessibility_warnings.append("No clear instructions found")
        print(f"⚠️  No instructions detected")
    
    # 6. Error Handling (1 point)
    error_patterns = ['error', 'catch', 'try', 'invalid', 'wrong', 'incorrect']
    error_handling = any(pattern in game_code.lower() for pattern in error_patterns)
    if error_handling:
        accessibility_score += 1
        print(f"✅ Error handling detected")
    else:
        accessibility_warnings.append("No error handling found")
        print(f"⚠️  No error handling detected")
    
    # Calculate percentage
    accessibility_percentage = (accessibility_score / max_score) * 100
    
    print(f"♿ Accessibility Score: {accessibility_score}/{max_score} ({accessibility_percentage:.1f}%)")
    
    return {
        'score': accessibility_score,
        'max_score': max_score,
        'percentage': accessibility_percentage,
        'issues': accessibility_issues,
        'warnings': accessibility_warnings,
        'passing': accessibility_percentage >= 60  # 60% threshold
    }

def test_all_games():
    """Test accessibility for all existing games"""
    print("🔍 Testing accessibility for all games...")
    
    # Get all game files
    game_files = sorted(glob.glob("games/2025-*.js"))
    
    if not game_files:
        print("No game files found!")
        return
    
    results = {}
    total_score = 0
    passing_games = 0
    
    for game_file in game_files:
        game_name = os.path.basename(game_file)
        print(f"\n{'='*50}")
        print(f"Testing: {game_name}")
        print(f"{'='*50}")
        
        try:
            with open(game_file, 'r') as f:
                game_code = f.read()
            
            result = validate_accessibility(game_code, game_name)
            results[game_name] = result
            total_score += result['percentage']
            
            if result['passing']:
                passing_games += 1
                
        except Exception as e:
            print(f"❌ Error reading {game_name}: {e}")
            results[game_name] = {'error': str(e)}
    
    # Summary
    print(f"\n{'='*50}")
    print(f"ACCESSIBILITY TEST SUMMARY")
    print(f"{'='*50}")
    print(f"Total games tested: {len(game_files)}")
    print(f"Games passing (≥60%): {passing_games}")
    print(f"Games failing: {len(game_files) - passing_games}")
    print(f"Average score: {total_score/len(game_files):.1f}%")
    
    # Show worst performers
    failing_games = [(name, result) for name, result in results.items() 
                    if 'error' not in result and not result['passing']]
    if failing_games:
        print(f"\nGames needing improvement:")
        for name, result in sorted(failing_games, key=lambda x: x[1]['percentage']):
            print(f"  - {name}: {result['percentage']:.1f}%")
            for issue in result['issues']:
                print(f"    ❌ {issue}")
    
    # Show best performers
    passing_games_list = [(name, result) for name, result in results.items() 
                         if 'error' not in result and result['passing']]
    if passing_games_list:
        print(f"\nTop performing games:")
        for name, result in sorted(passing_games_list, key=lambda x: x[1]['percentage'], reverse=True)[:3]:
            print(f"  - {name}: {result['percentage']:.1f}%")

if __name__ == "__main__":
    test_all_games() 
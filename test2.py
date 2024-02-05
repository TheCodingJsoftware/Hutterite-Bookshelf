import re

search_text = 'Drum begehr ich nicht zu leben'

def find_song(search_text: str) -> list[str]:
    search_text = search_text.lower()
    song_names = []
    with open('static/data.json' ,'r', encoding='utf-8') as f:
        text = f.read()    
    regex = '(?:"|\')([^"]*)(?:"|\')(?=:)(?:\:\s*).{1,}' + search_text
    print(regex)
    matches = re.finditer(regex, text, re.MULTILINE | re.IGNORECASE)
    for match in matches:
        song_name = match.group(0).split("\": ")[0].replace('"', '').strip()
        print(song_name)
        song_names.append(song_name)
    return song_names
print(find_song(search_text))
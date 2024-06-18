import ujson as json
from natsort import natsorted
from typing import List, Dict

class Song:
    def __init__(self, song_name: str, data: Dict[str, Dict[str, str | List[str]]]) -> None:
        self.name: str = song_name
        self.content: str = ""
        self.categories: List[str] = []

        self.load(data)

    def load(self, data: Dict[str, Dict[str, str | List[str]]]):
        self.content = data.get("content")
        self.categories = data.get("categories", [])

    def to_dict(self) -> Dict:
        return {
            "content": self.content,
            "categories": self.categories
        }

class Songs:
    def __init__(self, file_name: str) -> None:
        self.songs: List[Song] = []

        self.load(file_name)

    def get_song(self, song_name: str) -> Song:
        return next((song for song in self.songs if song.name == song_name), None)

    def save(self):
        with open('save_data.json', 'w', encoding="utf-8") as f:
            json.dump(self.to_dict(), f, ensure_ascii=True, indent=4)

    def to_dict(self):
        return {song.name: song.to_dict() for song in self.songs}

    def load(self, file_name):
        self.songs.clear()
        with open(file_name, 'r', encoding="utf-8") as f:
            data = json.load(f)

        for song_name, song_data in data.items():
            self.songs.append(Song(song_name, song_data))

        self.sort_songs()

    def sort_songs(self):
        self.songs = natsorted(self.songs, key=lambda song: song.name)

    def __iter__(self):
        return iter(self.songs)

songs = Songs("static/data.json")
songs.save()

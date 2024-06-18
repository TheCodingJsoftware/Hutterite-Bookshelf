import os

from natsort import natsorted


def get_text_files():
    text_files = []
    for root, dirs, files in os.walk('static/Documents'):
        root = root.replace('\\', '/')
        for file in files:
            if file.endswith('.txt'):
                text_files.append(f'{root}/{file}')
    text_files = natsorted(text_files)
    return text_files

text_files = get_text_files()

data = {}


for text_file in text_files:
    paths = text_file.replace('static/Documents/', '')
    groups = paths.split('/')
    song_name = groups[-1].replace('.txt', '')
    group = groups[0]
    data.setdefault(group, {})
    if len(groups) == 2:
        with open(text_file, 'r', encoding='utf-8') as song_file:
            data[group].setdefault(song_name, song_file.read())
    elif len(groups) == 3:
        subgroup = groups[1]
        data[group].setdefault(subgroup, {})
        with open(text_file, 'r', encoding='utf-8') as song_file:
            data[group][subgroup].setdefault(song_name, song_file.read())
import json

with open('data.json', 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False, indent=4)
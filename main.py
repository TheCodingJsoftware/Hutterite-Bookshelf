import json
import os
import ujson as json
from urllib.parse import unquote
from flask import (
    Flask,
    render_template,
)
from natsort import natsorted
from flask import Flask, render_template, send_file, request, make_response, send_from_directory, jsonify
from werkzeug.datastructures import ImmutableMultiDict
app = Flask(__name__)

from rich import print

@app.route("/")
def index() -> None:
    return render_template(
        "index.html",
    )

UPLOAD_FOLDER = 'uploads'
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

@app.route('/upload', methods=['POST'])
def upload():
    if 'files' not in request.files or 'arrangement' not in request.form:
        return jsonify({'error': 'Invalid request'})
    arrangement_name = request.form['arrangement']
    group_name = request.form['group']
    files = request.files.getlist('files')
    for file in files:
        if file and allowed_file(file.filename):
            filename = os.path.join(app.config['UPLOAD_FOLDER'], file.filename)
            file.save(filename)
            song_name = file.filename.replace('.txt', '').replace('.TXT', '')
            with open(filename, 'r') as txt_file:
                content = txt_file.read()
                if group_name == '':
                    add_song(arrangement_name, song_name, content)
                else:
                    add_song_to_group(arrangement_name, group_name, song_name, content)
            os.remove(filename)
    return jsonify({'success': True})

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() == 'txt'

@app.route('/create_group/<arrangement_name>/<group_name>')
def create_group(arrangement_name, group_name):# Add the book arrangement to the database
    with open('static/custom_content.json', 'r', encoding='utf-8') as f:
        custom_content = json.load(f)
    custom_content[arrangement_name].setdefault(group_name, {})
    with open('static/custom_content.json', 'w', encoding='utf-8') as f:
        json.dump(custom_content, f, indent=4)
    response = make_response()
    return response

@app.route('/rename_group/<arrangement_name>/<old_group_name>/<new_group_name>')
def rename_group(arrangement_name, old_group_name, new_group_name):# Add the book arrangement to the database
    with open('static/custom_content.json', 'r', encoding='utf-8') as f:
        custom_content = json.load(f)
    group_copy = custom_content[arrangement_name][old_group_name]
    custom_content[arrangement_name].setdefault(new_group_name, group_copy)
    del custom_content[arrangement_name][old_group_name]
    with open('static/custom_content.json', 'w', encoding='utf-8') as f:
        json.dump(custom_content, f, indent=4)
    response = make_response()
    return response

@app.route('/delete_group/<arrangement_name>/<group_name>')
def delete_group(arrangement_name, group_name):# Add the book arrangement to the database
    with open('static/custom_content.json', 'r', encoding='utf-8') as f:
        custom_content = json.load(f)
    del custom_content[arrangement_name][group_name]
    with open('static/custom_content.json', 'w', encoding='utf-8') as f:
        json.dump(custom_content, f, indent=4)
    response = make_response()
    return response

@app.route('/rename_arrangement/<old_arrangement_name>/<new_arrangement_name>/<old_code_name>/<new_code_name>/<private>')
def rename_arrangment(old_arrangement_name, new_arrangement_name, old_code_name, new_code_name, private):
    with open('static/custom_content.json', 'r', encoding='utf-8') as f:
        custom_content = json.load(f)
    data_copy = custom_content[old_arrangement_name]
    del custom_content[old_arrangement_name]
    custom_content.setdefault(new_arrangement_name, data_copy)
    with open('static/custom_content.json', 'w', encoding='utf-8') as f:
        json.dump(custom_content, f, indent=4)
    delete_code(old_code_name)
    save_code(new_code_name, new_arrangement_name, private)
    response = make_response()
    response.delete_cookie(old_code_name)
    response.set_cookie(new_code_name, new_arrangement_name, max_age=10 * 365 * 24 * 60 * 60)  # 10 years in seconds
    return response

@app.route('/delete_arrangement/<arrangement_name>/<code_name>')
def delete_arrangement(arrangement_name, code_name):
    # with open('static/custom_content.json', 'r', encoding='utf-8') as f:
    #     custom_content = json.load(f)
    # del custom_content[arrangement_name]
    # with open('static/custom_content.json', 'w', encoding='utf-8') as f:
    #     json.dump(custom_content, f, indent=4)
    delete_code(code_name)
    response = make_response()
    response.delete_cookie(code_name)
    return response

@app.route('/add_code/<codes>')
def add_code(codes):
    with open('static/codes.json', 'r', encoding='utf-8') as f:
        all_codes = json.load(f)
    response = make_response()
    for code in codes.split(','):
        response.set_cookie(code, all_codes[code]['folder_name'], max_age=10 * 365 * 24 * 60 * 60)  # 10 years in seconds
    return response

@app.route('/create_code/<code>/<folder_name>/<private>')
def create_code(code, folder_name, private):
    save_code(code, folder_name, private)
    
    # Add the book arrangement to the database
    with open('static/custom_content.json', 'r', encoding='utf-8') as f:
        custom_content = json.load(f)
    custom_content.setdefault(folder_name, {})
    with open('static/custom_content.json', 'w', encoding='utf-8') as f:
        json.dump(custom_content, f, indent=4)

    response = make_response()
    response.set_cookie(code, folder_name, max_age=10 * 365 * 24 * 60 * 60)  # 10 years in seconds
    return response

def save_code(code, folder_name, private):
    private = True if private == 'true' else False
    with open('static/codes.json', 'r', encoding='utf-8') as f:
        codes_data = json.load(f)
        
    codes_data.setdefault(code, {'folder_name': folder_name, 'private': private})

    with open('static/codes.json', 'w', encoding='utf-8') as f:
        json.dump(codes_data, f, indent=4)
    

def delete_code(code):
    with open('static/codes.json', 'r', encoding='utf-8') as f:
        codes_data = json.load(f)

    del codes_data[code]
    
    with open('static/codes.json', 'w', encoding='utf-8') as f:
        json.dump(codes_data, f, indent=4)

@app.route('/edit_song', methods=['POST'])
def edit_song():
    data = request.get_json()

    arrangement = data.get('arrangement')
    groupName = data.get('groupName')
    newSongName = data.get('newSongName')
    oldSongName = data.get('oldSongName')
    songContent = data.get('songContent')

    with open('static/custom_content.json', 'r', encoding='utf-8') as f:
        custom_content = json.load(f)

    if newSongName == oldSongName:
        if groupName == "":
            custom_content[arrangement][newSongName] = songContent
        else:
            custom_content[arrangement][groupName][newSongName] = songContent
    else:
        if groupName == "":
            custom_content[arrangement][newSongName] = songContent
            del custom_content[arrangement][oldSongName]
        else:
            custom_content[arrangement][groupName][newSongName] = songContent
            del custom_content[arrangement][groupName][oldSongName]

    with open('static/custom_content.json', 'w', encoding='utf-8') as f:
        json.dump(custom_content, f, indent=4)

    return jsonify({'message': 'Edit successful'})

@app.route('/add_new_song', methods=['POST'])
def add_new_song():
    data = request.get_json()

    arrangement = data.get('arrangement')
    groupName = data.get('groupName')
    songName = data.get('songName')
    songContent = data.get('songContent')

    with open('static/custom_content.json', 'r', encoding='utf-8') as f:
        custom_content = json.load(f)

    if groupName == "":
        custom_content[arrangement][songName] = songContent
    else:
        custom_content[arrangement][groupName][songName] = songContent

    with open('static/custom_content.json', 'w', encoding='utf-8') as f:
        json.dump(custom_content, f, indent=4)

    return jsonify({'message': 'Edit successful'})

@app.route('/delete_song', methods=['POST'])
def delete_song():
    data = request.get_json()

    arrangement = data.get('arrangement')
    groupName = data.get('groupName')
    songName = data.get('songName')

    with open('static/custom_content.json', 'r', encoding='utf-8') as f:
        custom_content = json.load(f)

    if groupName == "":
        del custom_content[arrangement][songName]
    else:
        del custom_content[arrangement][groupName][songName]

    with open('static/custom_content.json', 'w', encoding='utf-8') as f:
        json.dump(custom_content, f, indent=4)

    return jsonify({'message': 'Edit successful'})

def add_song(arrangement_name, song_name, song_text):
    with open('static/custom_content.json', 'r', encoding='utf-8') as f:
        custom_content = json.load(f)

    custom_content[arrangement_name].setdefault(song_name, song_text)
    
    with open('static/custom_content.json', 'w', encoding='utf-8') as f:
        json.dump(custom_content, f, indent=4)

def add_song_to_group(arrangement_name, group_name, song_name, song_text):
    with open('static/custom_content.json', 'r', encoding='utf-8') as f:
        custom_content = json.load(f)

    custom_content[arrangement_name][group_name].setdefault(song_name, song_text)
    
    with open('static/custom_content.json', 'w', encoding='utf-8') as f:
        json.dump(custom_content, f, indent=4)

@app.route('/sw.js')
def sw():
    response=make_response(send_from_directory('static', filename='sw.js'))
    response.headers['Content-Type'] = 'application/javascript'
    return response

def get_codes_from_cookie() -> ImmutableMultiDict[str, str]:
    cookies = request.cookies
    # for code_name, folder_name in cookies.items():
    #     print(cookie)
    # # if 'codes' in request.cookies:
    # #     codes_str = request.cookies.get('codes')
    # #     return parse_string_to_dict(codes_str)
    # # else:
    # #     return {}
    return cookies

def parse_string_to_dict(string: str) -> dict:
    cookie_data = {}
    string = string.replace('{', '').replace('}', '').replace("'", '')
    entries = string.split(', ')
    for entry in entries:
        keys = entry.split(': ')
        cookie_data.setdefault(keys[0], keys[1])
    return cookie_data    

# threading.Thread(target=downloadThread).start()
# app.run()
app.run(host="10.11.2.76", port=5000)
import os
import sys

import docx2txt
import ujson as json
from flask import (
    Flask,
    jsonify,
    make_response,
    render_template,
    request,
    send_from_directory,
)
from werkzeug.datastructures import ImmutableMultiDict

app = Flask(__name__)


@app.route("/")
def index() -> None:
    return render_template(
        "index.html",
    )


UPLOAD_FOLDER = "uploads"
app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER


@app.route("/upload", methods=["POST"])
def upload():
    if "files" not in request.files or "arrangement" not in request.form:
        return jsonify({"error": "Invalid request"})
    arrangement_name = request.form["arrangement"]
    group_name = request.form["group"]
    files = request.files.getlist("files")

    for file in files:
        filename: str = os.path.join(app.config["UPLOAD_FOLDER"], file.filename)
        file.save(filename)
        song_name = file.filename.replace(".txt", "").replace(".TXT", "")

        if filename.lower().endswith(".docx") or filename.lower().endswith(".doc"):
            with open(filename, "rb") as infile:
                content = docx2txt.process(infile)
        elif filename.lower().endswith(".txt"):
            with open(filename, "r") as txt_file:
                content = txt_file.read()

        if group_name == "":
            add_song(arrangement_name, song_name, content)
        else:
            add_song_to_group(arrangement_name, group_name, song_name, content)
        os.remove(filename)

    return jsonify({"success": True})


@app.route("/create_group", methods=["POST"])
def create_group():
    arrangement_name = request.form["arrangement"]
    group_name = request.form["group"]

    with open("static/custom_content.json", "r", encoding="utf-8") as file:
        custom_content = json.load(file)

    custom_content[arrangement_name].setdefault(group_name, {})

    with open("static/custom_content.json", "w", encoding="utf-8") as file:
        json.dump(custom_content, file, indent=4)

    return jsonify({"success": True})


@app.route("/rename_group", methods=["POST"])
def rename_group():
    arrangement_name = request.form["arrangement"]
    old_group_name = request.form["group_name"]
    new_group_name= request.form["new_group_name"]

    with open("static/custom_content.json", "r", encoding="utf-8") as file:
        custom_content = json.load(file)

    group_copy = custom_content[arrangement_name][old_group_name]
    custom_content[arrangement_name].setdefault(new_group_name, group_copy)
    del custom_content[arrangement_name][old_group_name]

    with open("static/custom_content.json", "w", encoding="utf-8") as file:
        json.dump(custom_content, file, indent=4)

    return jsonify({"success": True})


@app.route("/delete_group", methods=["POST"])
def delete_group():
    arrangement_name = request.form["arrangement_name, group_name"]
    group_name = request.form["group"]

    with open("static/custom_content.json", "r", encoding="utf-8") as file:
        custom_content = json.load(file)

    del custom_content[arrangement_name][group_name]

    with open("static/custom_content.json", "w", encoding="utf-8") as file:
        json.dump(custom_content, file, indent=4)

    return make_response()


@app.route("/rename_arrangement", methods=["POST"])
def rename_arrangment():
    old_arrangement_name = request.form["arrangement_name"]
    new_arrangement_name = request.form["new_folder_name"]
    old_code_name = request.form["code_name"]
    new_code_name = request.form["new_code_name"]
    private = request.form["new_privateCheckbox"]
    public_edits = request.form["new_publicEditCheckbox"]
    password = request.form["new_edit_password"]

    with open("static/custom_content.json", "r", encoding="utf-8") as file:
        custom_content = json.load(file)

    data_copy = custom_content[old_arrangement_name]
    del custom_content[old_arrangement_name]
    custom_content.setdefault(new_arrangement_name, data_copy)

    with open("static/custom_content.json", "w", encoding="utf-8") as file:
        json.dump(custom_content, file, indent=4)

    delete_code(old_code_name)
    save_code(new_code_name, new_arrangement_name, private, public_edits, password)

    response = make_response()
    response.delete_cookie(old_code_name)
    response.set_cookie(
        new_code_name,
        f"{new_arrangement_name};edit=True",
        max_age=10 * 365 * 24 * 60 * 60,
    )  # 10 years in seconds

    return response


@app.route("/delete_arrangement", methods=["POST"])
def delete_arrangement():
    arrangement_name = request.form["arrangement"]
    code_name = request.form["code_name"]

    delete_code(code_name)
    response = make_response()
    response.delete_cookie(code_name)

    return response


@app.route("/check_password", methods=["POST"])
def check_password():
    arrangement_name = request.form["group_name"]
    entered_password = request.form["password"]
    with open("static/codes.json", "r", encoding="utf-8") as file:
        all_codes = json.load(file)

    for code, code_data in all_codes.items():
        if (
            code == arrangement_name or code_data["folder_name"] == arrangement_name
        ) and entered_password == code_data["password"]:
            response = make_response(jsonify({"correct": True}))
            response.delete_cookie(code)
            response.set_cookie(
                code,
                f'{code_data["folder_name"]};edit=True',
                max_age=10 * 365 * 24 * 60 * 60,
            )  # 10 years in seconds
            return response

    return jsonify({"correct": False})


@app.route("/add_code", methods=["POST"])
def add_code():
    with open("static/codes.json", "r", encoding="utf-8") as file:
        all_codes = json.load(file)
    response = make_response()
    codes = request.form["codes"]
    for code in codes.split(","):
        response.set_cookie(
            code,
            f'{all_codes[code]["folder_name"]};edit={all_codes[code]["public_can_edit"]}',
            max_age=10 * 365 * 24 * 60 * 60,
        )  # 10 years in seconds
    return response


@app.route("/create_code", methods=["POST"])
def create_code():
    code = request.form["code_name"]
    folder_name = request.form["folder_name"]
    private = request.form["privateCheckbox"]
    public_edits = request.form["publicEditCheckbox"]
    password = request.form["edit_password"]
    save_code(code, folder_name, private, public_edits, password)

    # Add the book arrangement to the database
    with open("static/custom_content.json", "r", encoding="utf-8") as file:
        custom_content = json.load(file)

    custom_content.setdefault(folder_name, {})

    with open("static/custom_content.json", "w", encoding="utf-8") as file:
        json.dump(custom_content, file, indent=4)

    response = make_response()
    response.set_cookie(
        code, f"{folder_name};edit=True", max_age=10 * 365 * 24 * 60 * 60
    )  # 10 years in seconds

    return response


def save_code(code, folder_name, private, public_edits, password):
    private = private == "true"
    public_is_allowed_to_edit = public_edits == "true"
    with open("static/codes.json", "r", encoding="utf-8") as file:
        codes_data = json.load(file)

    codes_data.setdefault(
        code,
        {
            "folder_name": folder_name,
            "private": private,
            "public_can_edit": public_is_allowed_to_edit,
            "password": password,
        },
    )

    with open("static/codes.json", "w", encoding="utf-8") as file:
        json.dump(codes_data, file, indent=4)


def delete_code(code):
    with open("static/codes.json", "r", encoding="utf-8") as file:
        codes_data = json.load(file)

    del codes_data[code]

    with open("static/codes.json", "w", encoding="utf-8") as file:
        json.dump(codes_data, file, indent=4)


@app.route("/edit_song", methods=["POST"])
def edit_song():
    data = request.get_json()

    arrangement = data.get("arrangement")
    groupName = data.get("groupName")
    newSongName = data.get("newSongName")
    oldSongName = data.get("oldSongName")
    songContent = data.get("songContent")

    with open("static/custom_content.json", "r", encoding="utf-8") as file:
        custom_content = json.load(file)

    if newSongName == oldSongName:
        if groupName == "":
            custom_content[arrangement][newSongName] = songContent
        else:
            custom_content[arrangement][groupName][newSongName] = songContent
    elif groupName == "":
        custom_content[arrangement][newSongName] = songContent
        del custom_content[arrangement][oldSongName]
    else:
        custom_content[arrangement][groupName][newSongName] = songContent
        del custom_content[arrangement][groupName][oldSongName]

    with open("static/custom_content.json", "w", encoding="utf-8") as file:
        json.dump(custom_content, file, indent=4)

    return jsonify({"message": "Edit successful"})


@app.route("/add_new_song", methods=["POST"])
def add_new_song():
    data = request.get_json()

    arrangement = data.get("arrangement")
    groupName = data.get("groupName")
    songName = data.get("songName")
    songContent = data.get("songContent")

    with open("static/custom_content.json", "r", encoding="utf-8") as file:
        custom_content = json.load(file)

    if groupName == "":
        custom_content[arrangement][songName] = songContent
    else:
        custom_content[arrangement][groupName][songName] = songContent

    with open("static/custom_content.json", "w", encoding="utf-8") as file:
        json.dump(custom_content, file, indent=4)

    return jsonify({"message": "Edit successful"})


@app.route("/delete_song", methods=["POST"])
def delete_song():
    data = request.get_json()

    arrangement = data.get("arrangement")
    groupName = data.get("groupName")
    songName = data.get("songName")

    with open("static/custom_content.json", "r", encoding="utf-8") as file:
        custom_content = json.load(file)

    if groupName == "":
        del custom_content[arrangement][songName]
    else:
        del custom_content[arrangement][groupName][songName]

    with open("static/custom_content.json", "w", encoding="utf-8") as file:
        json.dump(custom_content, file, indent=4)

    return jsonify({"message": "Edit successful"})


def add_song(arrangement_name, song_name, song_text):
    with open("static/custom_content.json", "r", encoding="utf-8") as file:
        custom_content = json.load(file)

    custom_content[arrangement_name].setdefault(song_name, song_text)

    with open("static/custom_content.json", "w", encoding="utf-8") as file:
        json.dump(custom_content, file, indent=4)


def add_song_to_group(arrangement_name, group_name, song_name, song_text):
    with open("static/custom_content.json", "r", encoding="utf-8") as file:
        custom_content = json.load(file)

    custom_content[arrangement_name][group_name].setdefault(song_name, song_text)

    with open("static/custom_content.json", "w", encoding="utf-8") as file:
        json.dump(custom_content, file, indent=4)


@app.route("/sw.js")
def sw():
    response = make_response(send_from_directory("static", filename="sw.js"))
    response.headers["Content-Type"] = "application/javascript"
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
    string = string.replace("{", "").replace("}", "").replace("'", "")
    entries = string.split(", ")
    for entry in entries:
        keys = entry.split(": ")
        cookie_data.setdefault(keys[0], keys[1])
    return cookie_data


# threading.Thread(target=downloadThread).start()
if sys.platform == "win32":
    # app.run()
    app.run(host="10.0.0.217", port=5000)

import os
from flask import Flask, render_template, request, jsonify, make_response, send_from_directory
from flask_socketio import SocketIO, emit, join_room, leave_room

app = Flask(__name__)
app.config['SECRET_KEY'] = 'secret!'
socketio = SocketIO(app, cors_allowed_origins="*")

sing_alongs: dict[str, list | str | bool] = {}

@app.route('/')
def index():
    return render_template('index.html')

@app.route("/sw.js")
def sw():
    return app.send_static_file('sw.js')


@app.route('/create_sing_along', methods=['POST'])
def create_sing_along():
    data: dict[str, list | bool | str] = request.json
    name = data.get('name')
    if name in sing_alongs:
        return jsonify({'success': False, 'message': 'Sing along with this name already exists.'})
    songs = data.get('songs', [])
    current_song = None
    if songs:
        current_song = songs[0]
    sing_alongs[name] = {
        'description': data.get('description', 'Unspecified description'),
        'songs': songs,
        'password': data.get('password', name),
        'is_private': data.get('is_private', False),
        'current_song': current_song,
        'played_songs': [],
    }
    return jsonify({'success': True})

@app.route('/get_public_sing_alongs', methods=['GET'])
def get_public_sing_alongs():
    public_sing_alongs = {name: details for name, details in sing_alongs.items() if not details['is_private']}
    return jsonify(public_sing_alongs)

@app.route('/delete_sing_along', methods=['POST'])
def delete_sing_along():
    data: dict[str, str | list | bool] = request.json
    name = data.get('name')
    if name in sing_alongs:
        del sing_alongs[name]
        return jsonify({'success': True})
    return jsonify("error", {'message': 'Sing along not found'})

@socketio.on('leave_sing_along')
def handle_leave(data: dict[str, str | list | bool]):
    try:
        sing_along_name = data.get('sing_along_name')
        # leave_room(sing_along_name)
        if data.get('is_host', False):
            emit('left_sing_along', {'message': 'Sing along ended.'}, room=sing_along_name)
        else:
            emit('left_sing_along', {'message': 'You have left the sing along.'}, to=request.sid)
    except Exception as e:
        emit('error', {'message': f"handle_leave: {e}"}, to=request.sid)

@socketio.on('join_sing_along')
def handle_join(data):
    try:
        sing_along_name = data.get('sing_along_name')
        password = data.get('password', '')

        if sing_along_name in sing_alongs:
            join_room(sing_along_name)
            if sing_alongs[sing_along_name]['password'] == password:
                emit('joined_sing_song', {
                    'sing_along_name': sing_along_name,
                    'song': sing_alongs[sing_along_name]['current_song'],
                    'songs': sing_alongs[sing_along_name].get('songs'),
                    'played_songs': sing_alongs[sing_along_name].get('played_songs'),
                    'is_host': True
                }, to=request.sid)
            else:
                emit('joined_sing_song', {
                    'sing_along_name': sing_along_name,
                    'song': sing_alongs[sing_along_name]['current_song'],
                    'songs': sing_alongs[sing_along_name].get('songs'),
                    'played_songs': sing_alongs[sing_along_name].get('played_songs'),
                    'is_host': False,
                }, to=request.sid)
        else:
            emit('error', {'message': 'Sing along not found'}, to=request.sid)
    except Exception as e:
        emit('error', {'message': f"handle_join: {e}"}, to=request.sid)

@socketio.on('change_song')
def handle_change_song(data: dict[str, str | list | bool]):
    sing_along_name = data.get('sing_along_name')
    if sing_along_name in sing_alongs:
        new_song = data['new_song']
        sing_alongs[sing_along_name]['current_song'] = new_song
        sing_alongs[sing_along_name]['played_songs'].append(new_song)
        emit('sync_song', {'sing_along_name': sing_along_name, 'song': new_song, 'played_songs': sing_alongs[sing_along_name].get('played_songs'), 'songs': sing_alongs[sing_along_name].get('songs'), 'is_host': False}, room=sing_along_name)

port = int(os.environ.get('PORT', 5052))
if __name__ == '__main__':
    socketio.run(app, host='0.0.0.0', port=port)

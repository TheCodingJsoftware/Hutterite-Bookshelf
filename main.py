import os
import json
import tornado.ioloop
import tornado.web
import tornado.websocket
from tornado.options import define, options
import jinja2
from datetime import datetime, timedelta

define("port", default=5052, help="run on the given port", type=int)
loader = jinja2.FileSystemLoader("templates")
env = jinja2.Environment(loader=loader)

sing_alongs: dict[str, dict[str, list[tornado.websocket.WebSocketHandler] | set[str]]] = {}
INACTIVITY_TIMEOUT = timedelta(hours=5)  # 5 hours
VERSION = '1.0.3'

class MainHandler(tornado.web.RequestHandler):
    def get(self):
        template = env.get_template("index.html")
        rendered_template = template.render()
        self.write(rendered_template)

class ServiceWorkerHandler(tornado.web.RequestHandler):
    def get(self):
        self.set_header('Content-Type', 'application/javascript')
        self.render("static/sw.js")

class PublicSingAlongsHandler(tornado.web.RequestHandler):
    def get(self):
        public_sing_alongs = [
            {"name": key, "description": value["description"]}
            for key, value in sing_alongs.items() if not value["private"]
        ]
        self.write(json.dumps(public_sing_alongs))


class VersionHandler(tornado.web.RequestHandler):
    def get(self):
        self.write({"version": VERSION})

class SingAlongWebSocket(tornado.websocket.WebSocketHandler):
    def open(self):
        self.sing_along_id = None
        self.is_host = False

    def on_message(self, message):
        data = json.loads(message)
        action = data.get("action")

        if action == "create":
            self.create_sing_along(data)
        elif action == "join":
            self.join_sing_along(data)
        elif action == "change_song":
            self.change_song(data)
        elif action == "leave":
            self.leave_sing_along()
        elif action == "end":
            self.end_sing_along()
        elif action == "sync":
            self.sync_client()

    def create_sing_along(self, data: dict[str, str | bool | list[str]]):
        sing_along_id = data.get("sing_along_id")
        host_password = data.get("host_password")
        description = data.get("description")
        song_list = data.get("song_list")
        private = data.get("private")

        current_song = song_list[0] if song_list else None
        sing_alongs[sing_along_id] = {
            "host": self,
            "host_password": host_password,
            "description": description,
            "song_list": song_list,
            "current_song": current_song,
            "private": private,
            "clients": [],
            "played_songs": set(),
            "last_activity": datetime.now(),
        }

        self.sing_along_id = sing_along_id
        self.is_host = True
        self.write_message({"action": "created", "sing_along_id": sing_along_id})

    def join_sing_along(self, data):
        sing_along_id = data.get("sing_along_id")
        if sing_along := sing_alongs.get(sing_along_id):
            self.sing_along_id = sing_along_id
            if data.get("host_password") == sing_alongs[sing_along_id]['host_password']:
                self.is_host = True
            else:
                sing_along["clients"].append(self)
            played_songs_list = list(sing_along["played_songs"])
            song_list = sing_along["song_list"]
            self.write_message({"action": "joined", "sing_along_id": sing_along_id, "current_song": sing_along["current_song"], "played_songs": played_songs_list, "song_list": song_list, 'connected_clients': len(sing_along["clients"])})
        else:
            self.write_message({"action": "error", "message": "Sing-along not found"})

    def change_song(self, data):
        sing_along_id = self.sing_along_id
        song = data.get("song")

        if sing_along_id and sing_along_id in sing_alongs:
            sing_along = sing_alongs[sing_along_id]
            sing_along["current_song"] = song
            sing_along["played_songs"].add(song)
            sing_along["last_activity"] = datetime.now()

            played_songs_list = list(sing_along["played_songs"])
            song_list = sing_along["song_list"]
            for client in sing_along["clients"]:
                client.write_message({"action": "change_song", "song": song, "played_songs": played_songs_list, "song_list": song_list, 'connected_clients': len(sing_along["clients"])})
            self.write_message({"action": "change_song", "song": song, "played_songs": played_songs_list, "song_list": song_list, 'connected_clients': len(sing_along["clients"])})

    def sync_client(self):
        if self.sing_along_id and self.sing_along_id in sing_alongs:
            sing_along = sing_alongs[self.sing_along_id]
            song = sing_along["current_song"]
            played_songs_list = list(sing_along["played_songs"])
            song_list = sing_along["song_list"]
            self.write_message({"action": "sync", "song": song, "played_songs": played_songs_list, "song_list": song_list, 'connected_clients': len(sing_along["clients"])})

    def leave_sing_along(self):
        if self.sing_along_id and self.sing_along_id in sing_alongs:
            sing_along = sing_alongs[self.sing_along_id]

            sing_along["clients"].remove(self)
            self.write_message({"action": "left"})


    def end_sing_along(self):
        if self.is_host and self.sing_along_id and self.sing_along_id in sing_alongs:
            sing_along = sing_alongs[self.sing_along_id]
            for client in sing_along["clients"]:
                client.write_message({"action": "end_sing_along"})
            del sing_alongs[self.sing_along_id]
            self.sing_along_id = None

    def on_close(self):
        if self.sing_along_id and self.sing_along_id in sing_alongs:
            sing_along = sing_alongs[self.sing_along_id]
            sing_along["clients"].remove(self)
            if self.is_host:
                for client in sing_along["clients"]:
                    client.write_message({"action": "end_sing_along"})
                del sing_alongs[self.sing_along_id]

def check_inactive_sessions():
    now = datetime.now()
    inactive_sing_alongs = [id for id, sa in sing_alongs.items() if now - sa["last_activity"] > INACTIVITY_TIMEOUT]

    for sing_along_id in inactive_sing_alongs:
        sing_along = sing_alongs[sing_along_id]
        for client in sing_along["clients"]:
            client.write_message({"action": "end_sing_along"})
        del sing_alongs[sing_along_id]

def make_app():
    return tornado.web.Application([
        (r"/", MainHandler),
        (r"/ws", SingAlongWebSocket),
        (r"/sw.js", ServiceWorkerHandler),
        (r"/version", VersionHandler),
        (r"/public_sing_alongs", PublicSingAlongsHandler),
    ], static_path=os.path.join(os.path.dirname(__file__), "static")
                                   )

if __name__ == "__main__":
    options.parse_command_line()

    app = tornado.httpserver.HTTPServer(make_app())
    app.listen(options.port)
    tornado.ioloop.PeriodicCallback(check_inactive_sessions, 60 * 60 * 1000).start()  # Check every hour
    tornado.ioloop.IOLoop.instance().start()

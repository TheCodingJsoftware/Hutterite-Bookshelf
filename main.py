import gzip
import json
import os
from datetime import datetime, timedelta
from io import BytesIO

import jinja2
import psycopg2
import tornado.gen
import tornado.httpserver
import tornado.ioloop
import tornado.web
import tornado.websocket
from tornado.options import define, options

loader = jinja2.FileSystemLoader("dist")
env = jinja2.Environment(loader=loader)

sing_alongs: dict[str, dict[str, list[tornado.websocket.WebSocketHandler] | set[str]]] = {}
INACTIVITY_TIMEOUT = timedelta(hours=5)  # 5 hours
VERSION = '1.0.0'

define("port", default=5052, help="run on the given port", type=int)

with open("POSTGRES.json") as f:
    data = json.load(f)
    POSTGRES_USER = data["POSTGRES_USER"]
    POSTGRES_PASSWORD = data["POSTGRES_PASSWORD"]
    POSTGRES_DB = data["POSTGRES_DB"]
    POSTGRES_HOST = data["POSTGRES_HOST"]
    POSTGRES_PORT = data["POSTGRES_PORT"]


class SingAlong:
    def __init__(self, host: tornado.websocket.WebSocketHandler):
        self.host = host
        self.host_password = ""
        self.description = ""
        self.song_list: list[str] = []
        self.current_song = ""
        self.private = False
        self.clients: list[tornado.websocket.WebSocketHandler] = []
        self.played_songs: set[str] = set()
        self.last_activity = datetime.now()

    def to_dict(self) -> dict[str, str | bool | list[str]]:
        return {
            "host_password": self.host_password,
            "description": self.description,
            "song_list": self.song_list,
            "current_song": self.current_song,
            "private": self.private,
            "played_songs": list(self.played_songs),
            "last_activity": self.last_activity.isoformat(),
        }


def connect_db():
    return psycopg2.connect(
        dbname=POSTGRES_DB,
        user=POSTGRES_USER,
        password=POSTGRES_PASSWORD,
        host=POSTGRES_HOST,
        port=POSTGRES_PORT,
    )


class MainHandler(tornado.web.RequestHandler):
    def get(self):
        template = env.get_template("index.html")
        rendered_template = template.render()
        self.write(rendered_template)


class VersionHandler(tornado.web.RequestHandler):
    def get(self):
        self.write({"version": VERSION})


class FileHandler(tornado.web.RequestHandler):
    @tornado.gen.coroutine
    def get(self):
        conn = connect_db()
        files = []

        with conn.cursor() as cursor:
            cursor.execute(
                "SELECT tablename FROM pg_tables WHERE schemaname = 'public';"
            )
            tables = cursor.fetchall()
            for table in tables:
                table_name = f'"{table[0]}"'
                cursor.execute(
                    f"SELECT file_name, relative_path, file_content, is_private FROM {table_name};"
                )
                for record in cursor.fetchall():
                    files.append(
                        {
                            "fileName": record[0],
                            "relativePath": record[1],
                            "fileContent": record[2],
                            "isPrivate": record[3],
                        }
                    )
        conn.close()

        json_data = json.dumps(files)

        buffer = BytesIO()
        with gzip.GzipFile(fileobj=buffer, mode="wb") as gz:
            gz.write(json_data.encode("utf-8"))

        compressed_data = buffer.getvalue()

        self.set_header("Content-Encoding", "gzip")
        self.set_header("Content-Type", "application/json")
        self.set_header("Content-Length", str(len(compressed_data)))

        self.write(compressed_data)

    @tornado.gen.coroutine
    def post(self):
        data = json.loads(self.request.body)
        action = data.get("action")

        if action == "create_folder":
            folder_name = data.get("folder_name")
            is_private = data.get("is_private", False)
            result = self.create_folder(folder_name, is_private)
            if result:
                self.write({"status": "success", "message": "Folder created successfully"})
            else:
                self.set_status(400)
                self.write({"status": "error", "message": "Folder creation failed"})

        elif action == "add_file":
            file_name = data.get("file_name")
            folder_path = data.get("folder_path")
            file_content = data.get("file_content")
            is_private = data.get("is_private", False)
            result = self.add_file(file_name, folder_path, file_content, is_private)
            if result:
                self.write({"status": "success", "message": "File added successfully"})
            else:
                self.set_status(400)
                self.write({"status": "error", "message": "File addition failed"})

    def folder_exists(self, db_conn, folder_path):
        with db_conn.cursor() as cursor:
            cursor.execute("SELECT id FROM custom_content WHERE full_path = %s AND is_folder = TRUE", (folder_path,))
            return cursor.fetchone() is not None

    def create_folder(self, folder_name, is_private):
        conn = connect_db()
        try:
            with conn.cursor() as cursor:
                cursor.execute(
                    "INSERT INTO custom_content (file_name, full_path, is_folder, is_private) VALUES (%s, %s, TRUE, %s) RETURNING id",
                    (folder_name, folder_name, is_private)
                )
                conn.commit()
                return cursor.fetchone()[0]
        except Exception as e:
            print(f"Error creating folder: {e}")
            return None
        finally:
            conn.close()

    def add_file(self, file_name, folder_path, file_content, is_private):
        conn = connect_db()
        try:
            with conn.cursor() as cursor:
                # Get the parent folder ID
                cursor.execute(
                    "SELECT id FROM custom_content WHERE full_path = %s AND is_folder = TRUE", (folder_path,)
                )
                parent_folder_id = cursor.fetchone()
                if not parent_folder_id:
                    raise ValueError("Specified folder path does not exist")

                cursor.execute(
                    "INSERT INTO custom_content (file_name, full_path, file_content, is_folder, is_private, parent_folder_id) "
                    "VALUES (%s, %s, %s, FALSE, %s, %s) RETURNING id",
                    (file_name, os.path.join(folder_path, file_name), file_content, is_private, parent_folder_id[0])
                )
                conn.commit()
                return cursor.fetchone()[0]
        except Exception as e:
            print(f"Error adding file: {e}")
            return None
        finally:
            conn.close()


class PublicSingAlongsHandler(tornado.web.RequestHandler):
    def get(self):
        public_sing_alongs = [
            {"name": key, "description": value["description"]}
            for key, value in sing_alongs.items() if not value["private"]
        ]
        self.write(json.dumps(public_sing_alongs))


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


def make_app():
    return tornado.web.Application(
        [
            (r"/", MainHandler),
            (r"/dist/(.*)", tornado.web.StaticFileHandler, {"path": "dist"}),
            (r"/api/files", FileHandler),
            (r"/api/create_folder", FileHandler),
            (r"/api/add_file", FileHandler),
            (r"/ws", SingAlongWebSocket),
            (r"/version", VersionHandler),
            (r"/public_sing_alongs", PublicSingAlongsHandler),
        ],
        static_path=os.path.join(os.path.dirname(__file__), "static"),
        compress_response=True,
    )


def check_inactive_sessions():
    now = datetime.now()
    inactive_sing_alongs = [id for id, sa in sing_alongs.items() if now - sa["last_activity"] > INACTIVITY_TIMEOUT]

    for sing_along_id in inactive_sing_alongs:
        sing_along = sing_alongs[sing_along_id]
        for client in sing_along["clients"]:
            client.write_message({"action": "end_sing_along"})
        del sing_alongs[sing_along_id]


if __name__ == "__main__":
    options.parse_command_line()
    app = tornado.httpserver.HTTPServer(make_app())
    app.listen(options.port)
    tornado.ioloop.PeriodicCallback(check_inactive_sessions, 60 * 60 * 1000).start()  # Check every hour
    tornado.ioloop.IOLoop.instance().start()

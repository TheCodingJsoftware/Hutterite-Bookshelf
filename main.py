import gzip
import json
import os
import re
from datetime import datetime, timedelta
from io import BytesIO
from typing import Literal, Union

from dotenv import load_dotenv
import jinja2
import psycopg2
from psycopg2 import sql
import tornado.gen
import tornado.httpserver
import tornado.ioloop
import tornado.web
import tornado.websocket
from tornado.options import define, options
from tornado.concurrent import run_on_executor
from concurrent.futures import ThreadPoolExecutor

load_dotenv()

loader = jinja2.FileSystemLoader("dist/html")
env = jinja2.Environment(loader=loader)

sing_alongs: dict[str, "SingAlong"] = {}

GLOBAL_TABLES = [
    "abend & morgen",
    "alleluia sing\\german",
    "hymns\\english",
    "hymns\\german",
    "kleine gesangbuch",
    "lutherische gesangbuch",
    "stories",
    "alleluia sing\\english",
    "vaterlieder",
]

CUSTOM_COLLECTION_TABLES = [
    "custom collections",
]

INACTIVITY_TIMEOUT = timedelta(hours=5)  # 5 hours
VERSION = "0.0.9"


POSTGRES_USER = os.environ.get("POSTGRES_USER")
POSTGRES_PASSWORD = os.environ.get("POSTGRES_PASSWORD")
POSTGRES_DB = os.environ.get("POSTGRES_DB")
POSTGRES_HOST = os.environ.get("POSTGRES_HOST")
POSTGRES_PORT = os.environ.get("POSTGRES_PORT")


class SingAlong:
    def __init__(self, host: tornado.websocket.WebSocketHandler):
        self.host = host
        self.description = ""
        self.song_list: list[str] = []
        self.current_song = ""
        self.private = False
        self.clients: list[tornado.websocket.WebSocketHandler] = []
        self.played_songs: set[str] = set()
        self.last_activity = datetime.now()

    def to_dict(self) -> dict[str, str | bool | list[str]]:
        return {
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


class BaptismBookletHandler(tornado.web.RequestHandler):
    def get(self):
        template = env.get_template("baptismBooklet.html")
        with open("static/data/baptism_booklet_data.json", "r", encoding="utf-8") as f:
            data = json.load(f)
        rendered_template = template.render(baptism_booklet_data=data)
        self.write(rendered_template)


class PrivacyPolicyHandler(tornado.web.RequestHandler):
    def get(self):
        template = env.get_template("privacyPolicy.html")
        rendered_template = template.render()
        self.write(rendered_template)


class ServiceWorkerHandler(tornado.web.RequestHandler):
    def get(self):
        self.set_header("Content-Type", "application/javascript")
        with open("serviceWorker.js", "r") as file:
            script = file.read()
            # script = re.sub(r"const VERSION = '.*?';", f"const VERSION = '{VERSION}';", script)
            self.write(script)


class VersionHandler(tornado.web.RequestHandler):
    def get(self):
        self.write({"version": VERSION})


class FilesHandler(tornado.web.RequestHandler):
    executor = ThreadPoolExecutor(
        max_workers=int(os.getenv("MAX_POSTGRES_WORKERS", default=5)),
        thread_name_prefix="postgres_worker",
    )

    @tornado.gen.coroutine
    def get(self):
        load_type = self.get_argument("type", "global")
        folders = self.get_arguments("folders")  # Get folders parameter as a list

        files: list[dict[str, Union[str, bool]]] = yield self.download_files(
            load_type, folders
        )

        json_data = json.dumps(files)
        buffer = BytesIO()
        with gzip.GzipFile(fileobj=buffer, mode="wb") as gz:
            gz.write(json_data.encode("utf-8"))

        compressed_data = buffer.getvalue()

        self.set_header("Content-Encoding", "gzip")
        self.set_header("Content-Type", "application/json")
        self.set_header("Content-Length", str(len(compressed_data)))

        self.write(compressed_data)

    @run_on_executor
    def download_files(
        self, load_type: Literal["global", "custom"], folders: list[str]
    ) -> list[dict[str, Union[str, bool]]]:
        files: list[dict[str, Union[str, bool]]] = []
        conn = connect_db()

        tables_to_load = (
            GLOBAL_TABLES if load_type == "global" else CUSTOM_COLLECTION_TABLES
        )

        with conn.cursor() as cursor:
            for table in tables_to_load:
                if folders and load_type == "custom":
                    cursor.execute(
                        f'SELECT file_name, relative_path, file_content, is_private FROM "{table}" WHERE relative_path = ANY(%s);',
                        (folders,),
                    )
                elif load_type == "global":
                    cursor.execute(
                        f'SELECT file_name, relative_path, file_content, is_private FROM "{table}";'
                    )
                try:
                    records = cursor.fetchall()
                except (
                    psycopg2.ProgrammingError
                ):  # No folders specified, so return any records
                    continue
                for record in records:
                    files.append(
                        {
                            "fileName": record[0],
                            "relativePath": record[1],
                            "fileContent": record[2],
                            "isPrivate": record[3],
                        }
                    )

        conn.close()
        return files

    @tornado.gen.coroutine
    def post(self):
        yield self.add_files()

    @run_on_executor
    def add_files(self):
        try:
            data = json.loads(self.request.body.decode("utf-8"))
            folder_name = data["folderName"]
            is_private = data["isPrivate"]
            files = data["files"]

            conn = connect_db()
            with conn.cursor() as cursor:
                for file in files:
                    file_name = file["fileName"]
                    relative_path = folder_name
                    file_content = file["fileContent"]
                    cursor.execute(
                        sql.SQL(
                            """
                        INSERT INTO {} (file_name, relative_path, file_content, is_private)
                        VALUES (%s, %s, %s, %s)
                    """
                        ).format(sql.Identifier("custom collections")),
                        (file_name, relative_path, file_content, is_private),
                    )
            conn.commit()
            conn.close()

            self.write(
                {"status": "success", "message": "Files added to custom collections."}
            )

        except Exception as e:
            self.set_status(500)
            self.write({"status": "error", "message": str(e)})


class PublicFoldersHandler(tornado.web.RequestHandler):
    @tornado.gen.coroutine
    def get(self):
        conn = connect_db()
        public_folders = set()

        with conn.cursor() as cursor:
            # Loop through all custom collection tables and fetch public folders
            for table in CUSTOM_COLLECTION_TABLES:
                cursor.execute(
                    f'SELECT DISTINCT relative_path FROM "{table}" WHERE is_private = False;'
                )
                records = cursor.fetchall()
                for record in records:
                    public_folders.add(record[0])

        conn.close()

        self.write(json.dumps(list(public_folders)))

        self.set_header("Content-Type", "application/json")


class PublicSingAlongsHandler(tornado.web.RequestHandler):
    def get(self):
        public_sing_alongs = [
            {"name": key, "description": value.description}
            for key, value in sing_alongs.items()
            if not value.private
        ]
        self.write(json.dumps(public_sing_alongs))


class SingAlongWebSocket(tornado.websocket.WebSocketHandler):
    async def open(self):
        self.sing_along_id = None
        self.is_host = False

    async def on_message(self, message):
        data = json.loads(message)
        action = data.get("action")

        if action == "create":
            await self.create_sing_along(data)
        elif action == "join":
            await self.join_sing_along(data)
        elif action == "change_song":
            await self.change_song(data)
        elif action == "get_song":
            await self.get_song(data)
        elif action == "leave":
            await self.leave_sing_along()
        elif action == "end":
            await self.end_sing_along()
        elif action == "sync":
            await self.sync_client()

    async def create_sing_along(self, data: dict[str, Union[str, bool, list[str]]]):
        sing_along = SingAlong(self)
        sing_along.description = data.get("description", "Unspecified description")
        sing_along.song_list = data.get("song_list", [])
        sing_along.private = data.get("private", False)
        sing_along.current_song = (
            sing_along.song_list[0] if sing_along.song_list else None
        )

        sing_along_id: str = data.get("sing_along_id")
        if not sing_along_id:
            self.write_message(
                {"action": "error", "message": "Sing-along ID is required"}
            )
            return

        if sing_alongs.get(sing_along_id):
            self.write_message(
                {"action": "error", "message": "Sing-along ID already exists"}
            )
            return

        sing_alongs[sing_along_id] = sing_along

        self.sing_along_id = sing_along_id
        self.is_host = True
        self.write_message({"action": "created", "sing_along_id": sing_along_id})

    async def join_sing_along(self, data):
        sing_along_id = data.get("sing_along_id")
        is_host = data.get("is_host")
        if not sing_along_id:
            self.write_message(
                {"action": "error", "message": "Sing-along ID is required"}
            )
            return

        sing_along = sing_alongs.get(sing_along_id)
        if sing_along:
            self.sing_along_id = sing_along_id
            if is_host:
                sing_along.host = self
                self.is_host = True
            else:
                sing_along.clients.append(self)
            played_songs_list = list(sing_along.played_songs)
            song_list = sing_along.song_list
            self.write_message(
                {
                    "action": "joined",
                    "sing_along_id": sing_along_id,
                    "current_song": sing_along.current_song,
                    "played_songs": played_songs_list,
                    "song_list": song_list,
                    "connected_clients": len(sing_along.clients),
                }
            )
        else:
            self.write_message({"action": "error", "message": "Sing-along not found"})

    async def change_song(self, data):
        if not self.sing_along_id:
            self.write_message(
                {"action": "error", "message": "You are not in a sing-along"}
            )
            return

        song = data.get("song")
        if not song:
            self.write_message({"action": "error", "message": "Song is required"})
            return

        sing_along = sing_alongs.get(self.sing_along_id)
        if sing_along:
            sing_along.current_song = song
            sing_along.played_songs.add(song)
            sing_along.last_activity = datetime.now()

            played_songs_list = list(sing_along.played_songs)
            song_list = sing_along.song_list
            for client in sing_along.clients:
                await client.write_message(
                    {
                        "action": "change_song",
                        "song": song,
                        "played_songs": played_songs_list,
                        "song_list": song_list,
                        "connected_clients": len(sing_along.clients),
                    }
                )
            self.write_message(
                {
                    "action": "sync",
                    "song": song,
                    "played_songs": played_songs_list,
                    "song_list": song_list,
                    "connected_clients": len(sing_along.clients),
                }
            )

    async def get_song(self, data):
        if self.sing_along_id and self.sing_along_id in sing_alongs:
            sing_along = sing_alongs[self.sing_along_id]
            song = sing_along.current_song
            self.write_message({"action": "get_song", "song": song})

    async def sync_client(self):
        if self.sing_along_id and self.sing_along_id in sing_alongs:
            sing_along = sing_alongs[self.sing_along_id]
            song = sing_along.current_song
            played_songs_list = list(sing_along.played_songs)
            song_list = sing_along.song_list
            self.write_message(
                {
                    "action": "sync",
                    "song": song,
                    "played_songs": played_songs_list,
                    "song_list": song_list,
                    "connected_clients": len(sing_along.clients),
                }
            )

    async def leave_sing_along(self):
        if self.sing_along_id and self.sing_along_id in sing_alongs:
            sing_along = sing_alongs[self.sing_along_id]
            sing_along.clients.remove(self)
            self.write_message({"action": "left"})

    async def end_sing_along(self):
        if self.is_host and self.sing_along_id and self.sing_along_id in sing_alongs:
            sing_along = sing_alongs[self.sing_along_id]
            for client in sing_along.clients:
                await client.write_message({"action": "end_sing_along"})
            del sing_alongs[self.sing_along_id]
            self.sing_along_id = None

    def on_close(self):
        if self.sing_along_id and self.sing_along_id in sing_alongs:
            sing_along = sing_alongs[self.sing_along_id]
            sing_along.clients.remove(self)
            if self.is_host:
                for client in sing_along.clients:
                    client.write_message({"action": "end_sing_along"})
                del sing_alongs[self.sing_along_id]


def make_app():
    return tornado.web.Application(
        [
            (r"/", MainHandler),
            (r"/baptism_booklet", BaptismBookletHandler),
            (r"/privacy_policy", PrivacyPolicyHandler),
            (r"/privacy", PrivacyPolicyHandler),
            (r"/serviceWorker.js", ServiceWorkerHandler),
            (r"/dist/(.*)", tornado.web.StaticFileHandler, {"path": "dist"}),
            (r"/static/(.*)", tornado.web.StaticFileHandler, {"path": "static"}),
            (r"/src/(.*)", tornado.web.StaticFileHandler, {"path": "src"}),
            (r"/api/files", FilesHandler),
            (r"/api/public_folders", PublicFoldersHandler),
            (r"/ws", SingAlongWebSocket),
            (r"/version", VersionHandler),
            (r"/api/public_sing_alongs", PublicSingAlongsHandler),
        ],
        static_path=os.path.join(os.path.dirname(__file__), "static"),
    )


def check_inactive_sessions():
    now = datetime.now()
    inactive_sing_alongs = [
        id
        for id, sa in sing_alongs.items()
        if now - sa.last_activity > INACTIVITY_TIMEOUT
    ]

    for sing_along_id in inactive_sing_alongs:
        sing_along = sing_alongs[sing_along_id]
        for client in sing_along.clients:
            client.write_message({"action": "end_sing_along"})
        del sing_alongs[sing_along_id]


if __name__ == "__main__":
    options.parse_command_line()
    app = tornado.httpserver.HTTPServer(make_app())
    app.listen(int(os.getenv("PORT", default=5052)))
    tornado.ioloop.PeriodicCallback(
        check_inactive_sessions, 60 * 60 * 1000
    ).start()  # Check every hour
    tornado.ioloop.IOLoop.instance().start()

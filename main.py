import os

import tornado.ioloop
import tornado.web
import tornado.gen
import psycopg2
import jinja2
import msgspec
import tornado.ioloop
import tornado.web
from psycopg2 import sql
import json

loader = jinja2.FileSystemLoader("templates")
env = jinja2.Environment(loader=loader)
# Database connection setup
def connect_db():
    return psycopg2.connect(
        dbname="Jared",
        user="Jared",
        password="password",
        host="localhost",
        port="5432"
    )

class IndexHandler(tornado.web.RequestHandler):
    def get(self):
        template = env.get_template("index.html")
        rendered_template = template.render()
        self.write(rendered_template)


class FetchTablesHandler(tornado.web.RequestHandler):
    @tornado.gen.coroutine
    def get(self):
        conn = connect_db()
        cursor = conn.cursor()
        cursor.execute("SELECT table_name FROM information_schema.tables WHERE table_schema='public'")
        tables = cursor.fetchall()
        self.write(json.dumps([table[0] for table in tables]))
        cursor.close()
        conn.close()

class FetchDataHandler(tornado.web.RequestHandler):
    @tornado.gen.coroutine
    def get(self, table_name):
        conn = connect_db()
        cursor = conn.cursor()
        cursor.execute(sql.SQL("SELECT * FROM {}").format(sql.Identifier(table_name)))
        rows = cursor.fetchall()
        self.write(json.dumps(rows))
        cursor.close()
        conn.close()


class FileHandler(tornado.web.RequestHandler):
    @tornado.gen.coroutine
    def get(self):
        conn = connect_db()
        files = []

        with conn.cursor() as cursor:
            cursor.execute("SELECT tablename FROM pg_tables WHERE schemaname = 'public';")
            tables = cursor.fetchall()
            for table in tables:
                table_name = f'"{table[0]}"'
                cursor.execute(f"SELECT file_name, relative_path, file_content FROM {table_name};")
                for record in cursor.fetchall():
                    files.append({
                        'fileName': record[0],
                        'relativePath': record[1],
                        'fileContent': record[2]
                    })
        conn.close()

        self.write(json.dumps(files))


def make_app():
    return tornado.web.Application([
        (r"/", IndexHandler),
        (r"/dist/(.*)", tornado.web.StaticFileHandler, {"path": "dist"}),
        (r"/api/tables", FetchTablesHandler),
        (r"/api/files", FileHandler),
        (r"/api/data/(.*)", FetchDataHandler),
    ],
    static_path=os.path.join(os.path.dirname(__file__), "static"),
    template_path=os.path.join(os.path.dirname(__file__), "templates"),
    debug=True
    )

if __name__ == "__main__":
    app = make_app()
    app.listen(8888)
    tornado.ioloop.IOLoop.current().start()

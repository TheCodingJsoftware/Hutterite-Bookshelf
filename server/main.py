import tornado.ioloop
import tornado.web
import tornado.gen
import psycopg2
from psycopg2 import sql
import json

# Database connection setup
def get_db_connection():
    conn = psycopg2.connect(
        dbname='your_dbname',
        user='your_user',
        password='your_password',
        host='localhost',
        port='5432'
    )
    return conn

class FetchTablesHandler(tornado.web.RequestHandler):
    @tornado.gen.coroutine
    def get(self):
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT table_name FROM information_schema.tables WHERE table_schema='public'")
        tables = cursor.fetchall()
        self.write(json.dumps([table[0] for table in tables]))
        cursor.close()
        conn.close()

class FetchDataHandler(tornado.web.RequestHandler):
    @tornado.gen.coroutine
    def get(self, table_name):
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute(sql.SQL("SELECT * FROM {}").format(sql.Identifier(table_name)))
        rows = cursor.fetchall()
        self.write(json.dumps(rows))
        cursor.close()
        conn.close()

def make_app():
    return tornado.web.Application([
        (r"/api/tables", FetchTablesHandler),
        (r"/api/data/(.*)", FetchDataHandler),
    ])

if __name__ == "__main__":
    app = make_app()
    app.listen(8888)
    tornado.ioloop.IOLoop.current().start()

import os
import psycopg2
from psycopg2 import sql

# Database connection setup
def connect_db():
    return psycopg2.connect(
        dbname="your_dbname",
        user="your_username",
        password="your_password",
        host="your_host",
        port="your_port"
    )

# Function to sanitize table names to make them SQL-compatible
def sanitize_table_name(name: str):
    return name.replace("/", "_").replace("-", "_").replace(".", "_").lower()

# Function to create a table for a given directory path
def create_table_for_directory(conn, directory_path):
    table_name = sanitize_table_name(directory_path)

    with conn.cursor() as cursor:
        cursor.execute(sql.SQL("""
            CREATE TABLE IF NOT EXISTS {} (
                id SERIAL PRIMARY KEY,
                file_name TEXT,
                relative_path TEXT,
                file_content TEXT
            )
        """).format(sql.Identifier(table_name)))
        conn.commit()

# Function to insert file data into the corresponding table
def insert_file_data(conn, table_name, file_name, relative_path, file_content):
    with conn.cursor() as cursor:
        cursor.execute(sql.SQL("""
            INSERT INTO {} (file_name, relative_path, file_content)
            VALUES (%s, %s, %s)
        """).format(sql.Identifier(table_name)), (file_name, relative_path, file_content))
        conn.commit()

# Function to process all .txt files in a directory and its subdirectories
def process_directory(conn, root_directory):
    for dirpath, _, filenames in os.walk(root_directory):
        # Skip empty directories
        if not filenames:
            continue

        # Sanitize and create the table for this directory
        relative_dir_path = os.path.relpath(dirpath, root_directory)
        table_name = sanitize_table_name(relative_dir_path)
        # create_table_for_directory(conn, relative_dir_path)

        # Insert data for each .txt file in this directory
        for file_name in filenames:
            if file_name.endswith('.txt'):
                file_path = os.path.join(dirpath, file_name)
                with open(file_path, 'r', encoding='utf-8') as file:
                    file_content = file.read()
                    print(table_name, file_name, relative_dir_path, file_content)
                    # insert_file_data(conn, table_name, file_name, relative_dir_path, file_content)

# Main execution
if __name__ == "__main__":
    root_directory = r"C:\Users\jared\Documents\Code\Hutterite Bookshelf\static\Documents"

    conn = connect_db()
    try:
        process_directory(conn, root_directory)
    finally:
        conn.close()

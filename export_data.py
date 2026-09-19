import json, psycopg2
from psycopg2.extras import RealDictCursor
from datetime import datetime

conn = psycopg2.connect(dbname="websitedb", user="postgres", host="/var/run/postgresql")
cur = conn.cursor(cursor_factory=RealDictCursor)

def dump(query, name):
    cur.execute(query)
    rows = cur.fetchall()
    for r in rows:
        for k, v in r.items():
            if isinstance(v, datetime):
                r[k] = v.strftime("%Y-%m-%d %H:%M:%S")
    with open(f"data/{name}.json", "w") as f:
        json.dump(rows, f, indent=2, ensure_ascii=False)
    print(f"{name}: {len(rows)} rows")

# Public content only — feedback/contact contain private messages, never exported
dump("SELECT content, video, images, tags, posted, title, url FROM posts ORDER BY posted DESC;", "posts")
dump("SELECT name, wqformatname, year FROM films WHERE name IS NOT NULL;", "films")
dump("SELECT name, scheduled, info, start FROM events ORDER BY scheduled;", "events")

conn.close()

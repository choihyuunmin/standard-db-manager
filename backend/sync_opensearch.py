import os
import sqlite3
from opensearchpy import OpenSearch, helpers
from sentence_transformers import SentenceTransformer

SQLITE_DB = os.path.join(os.path.dirname(__file__), 'standard_dict.db')
OPENSEARCH_HOST = os.environ.get('OPENSEARCH_HOST', 'localhost')
OPENSEARCH_PORT = int(os.environ.get('OPENSEARCH_PORT', 9200))
INDEX_NAME = 'standard_dict_vectors'

def sync():
    print("Connecting to SQLite...")
    if not os.path.exists(SQLITE_DB):
        print(f"Error: Database file not found at {SQLITE_DB}")
        return

    conn = sqlite3.connect(SQLITE_DB)
    c = conn.cursor()
    
    # Check if table exists
    c.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='terms'")
    if not c.fetchone():
        print("Error: The 'terms' table does not exist in the database. You might have an empty database file.")
        return

    print("Loading embedding model...")
    model = SentenceTransformer('jhgan/ko-sroberta-multitask')
    
    print(f"Connecting to OpenSearch at {OPENSEARCH_HOST}:{OPENSEARCH_PORT}...")
    client = OpenSearch(
        hosts=[{'host': OPENSEARCH_HOST, 'port': OPENSEARCH_PORT}],
        http_compress=True,
        use_ssl=False,
        verify_certs=False,
        ssl_assert_hostname=False,
        ssl_show_warn=False
    )
    
    if client.indices.exists(index=INDEX_NAME):
        client.indices.delete(index=INDEX_NAME)
        
    client.indices.create(index=INDEX_NAME, body={
        "settings": {
            "index": {
                "knn": True,
                "knn.algo_param.ef_search": 100
            }
        },
        "mappings": {
            "properties": {
                "type": {"type": "keyword"},
                "name": {"type": "text"},
                "eng_abbr": {"type": "keyword"},
                "description": {"type": "text"},
                "embedding": {
                    "type": "knn_vector",
                    "dimension": 768,
                    "method": {
                        "name": "hnsw",
                        "space_type": "l2",
                        "engine": "nmslib"
                    }
                }
            }
        }
    })
    
    actions = []
    
    print("Processing terms from SQLite...")
    c.execute('SELECT term_name, description, eng_abbr FROM terms')
    for row in c.fetchall():
        name, desc, eng = row
        if not name: continue
        emb = model.encode(name).tolist()
        actions.append({
            "_index": INDEX_NAME,
            "_source": {
                "type": "term",
                "name": name,
                "eng_abbr": eng,
                "description": desc,
                "embedding": emb
            }
        })
        
    print("Processing words from SQLite...")
    c.execute('SELECT word_name, description, eng_abbr FROM words')
    for row in c.fetchall():
        name, desc, eng = row
        if not name: continue
        emb = model.encode(name).tolist()
        actions.append({
            "_index": INDEX_NAME,
            "_source": {
                "type": "word",
                "name": name,
                "eng_abbr": eng,
                "description": desc,
                "embedding": emb
            }
        })
        
    print(f"Indexing {len(actions)} vectors into OpenSearch...")
    helpers.bulk(client, actions, chunk_size=500)
    print("OpenSearch Indexing Done!")

if __name__ == '__main__':
    sync()

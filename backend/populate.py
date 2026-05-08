import pandas as pd
import sqlite3
import math
import os
from opensearchpy import OpenSearch, helpers
from sentence_transformers import SentenceTransformer

EXCEL_FILE = '/Users/choi/Workspace/gov_standard/공공데이터 공통표준(2025.11월).xlsx'
SQLITE_DB = 'standard_dict.db'
OPENSEARCH_HOST = os.environ.get('OPENSEARCH_HOST', 'localhost')
OPENSEARCH_PORT = int(os.environ.get('OPENSEARCH_PORT', 9200))
INDEX_NAME = 'standard_dict_vectors'

def sanitize_value(val):
    if isinstance(val, float) and math.isnan(val):
        return None
    return str(val) if val is not None else None

def init_sqlite():
    conn = sqlite3.connect(SQLITE_DB)
    c = conn.cursor()
    c.execute('''
        CREATE TABLE IF NOT EXISTS terms (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            term_name TEXT,
            description TEXT,
            eng_abbr TEXT,
            domain_name TEXT
        )
    ''')
    c.execute('''
        CREATE TABLE IF NOT EXISTS words (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            word_name TEXT,
            eng_abbr TEXT,
            eng_name TEXT,
            description TEXT
        )
    ''')
    c.execute('''
        CREATE TABLE IF NOT EXISTS domains (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            domain_group TEXT,
            domain_category TEXT,
            domain_name TEXT,
            description TEXT,
            data_type TEXT,
            data_length TEXT
        )
    ''')
    conn.commit()
    return conn

def populate():
    print("Loading embedding model...")
    model = SentenceTransformer('jhgan/ko-sroberta-multitask')
    
    print("Reading Excel...")
    xl = pd.ExcelFile(EXCEL_FILE)
    df_terms = xl.parse('공통표준용어').fillna('')
    df_words = xl.parse('공통표준단어').fillna('')
    df_domains = xl.parse('공통표준도메인').fillna('')
    
    conn = init_sqlite()
    c = conn.cursor()
    c.execute('DELETE FROM terms')
    c.execute('DELETE FROM words')
    c.execute('DELETE FROM domains')
    
    print("Connecting to OpenSearch...")
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
    
    print("Processing terms...")
    for idx, row in df_terms.iterrows():
        name = str(row.get('공통표준용어명', ''))
        if not name: continue
        desc = str(row.get('공통표준용어설명', ''))
        eng = str(row.get('공통표준용어영문약어명', ''))
        domain = str(row.get('공통표준도메인명', ''))
        c.execute('INSERT INTO terms (term_name, description, eng_abbr, domain_name) VALUES (?, ?, ?, ?)', (name, desc, eng, domain))
        
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

    print("Processing words...")
    for idx, row in df_words.iterrows():
        name = str(row.get('공통표준단어명', ''))
        if not name: continue
        eng = str(row.get('공통표준단어영문약어명', ''))
        eng_name = str(row.get('공통표준단어 영문명', ''))
        desc = str(row.get('공통표준단어 설명', ''))
        c.execute('INSERT INTO words (word_name, eng_abbr, eng_name, description) VALUES (?, ?, ?, ?)', (name, eng, eng_name, desc))
        
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
        
    print("Processing domains...")
    for idx, row in df_domains.iterrows():
        d_group = str(row.get('공통표준도메인그룹명', ''))
        d_cat = str(row.get('공통표준도메인분류명', ''))
        d_name = str(row.get('공통표준도메인명', ''))
        if not d_name: continue
        desc = str(row.get('공통표준도메인설명', ''))
        d_type = str(row.get('데이터타입', ''))
        d_len = str(row.get('데이터길이', ''))
        c.execute('INSERT INTO domains (domain_group, domain_category, domain_name, description, data_type, data_length) VALUES (?, ?, ?, ?, ?, ?)', 
                  (d_group, d_cat, d_name, desc, d_type, d_len))

    conn.commit()
    
    print("Indexing into OpenSearch...")
    helpers.bulk(client, actions, chunk_size=500)
    print("Done!")

if __name__ == '__main__':
    populate()

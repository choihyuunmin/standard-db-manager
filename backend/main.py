from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import sqlite3
import os
from opensearchpy import OpenSearch
from sentence_transformers import SentenceTransformer

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

OPENSEARCH_HOST = os.environ.get('OPENSEARCH_HOST', 'localhost')
OPENSEARCH_PORT = int(os.environ.get('OPENSEARCH_PORT', 9200))
INDEX_NAME = 'standard_dict_vectors'
DB_PATH = '/Users/choi/Workspace/gov_standard/standard-db-manager/backend/standard_dict.db'

print("Loading embedding model...")
model = SentenceTransformer('jhgan/ko-sroberta-multitask')

client = OpenSearch(
    hosts=[{'host': OPENSEARCH_HOST, 'port': OPENSEARCH_PORT}],
    http_compress=True,
    use_ssl=False,
    verify_certs=False
)

class SuggestRequest(BaseModel):
    query: str
    top_k: int = 5

class ColumnRequest(BaseModel):
    logical_names: list[str]
    table_name: str = "T_NEW_TABLE"

class TermModel(BaseModel):
    term_name: str
    description: str
    eng_abbr: str
    domain_name: str

class WordModel(BaseModel):
    word_name: str
    eng_abbr: str
    eng_name: str
    description: str

class DomainModel(BaseModel):
    domain_group: str
    domain_category: str
    domain_name: str
    description: str
    data_type: str
    data_length: str

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

# --------- TERMS ---------
@app.get("/api/terms")
def get_terms(page: int = 1, size: int = 20, search: Optional[str] = None):
    conn = get_db()
    c = conn.cursor()
    query_cond = ""
    params = []
    if search:
        query_cond = "WHERE term_name LIKE ? OR eng_abbr LIKE ?"
        params = [f"%{search}%", f"%{search}%"]
        
    c.execute(f"SELECT count(*) FROM terms {query_cond}", params)
    total = c.fetchone()[0]
    
    c.execute(f"SELECT * FROM terms {query_cond} ORDER BY id DESC LIMIT ? OFFSET ?", (*params, size, (page-1)*size))
    items = [dict(row) for row in c.fetchall()]
    return {"total": total, "items": items, "page": page, "size": size}

@app.post("/api/terms")
def create_term(term: TermModel):
    conn = get_db()
    c = conn.cursor()
    c.execute("INSERT INTO terms (term_name, description, eng_abbr, domain_name) VALUES (?, ?, ?, ?)",
              (term.term_name, term.description, term.eng_abbr, term.domain_name))
    conn.commit()
    
    # Also index into OpenSearch
    emb = model.encode(term.term_name).tolist()
    client.index(index=INDEX_NAME, body={
        "type": "term",
        "name": term.term_name,
        "eng_abbr": term.eng_abbr,
        "description": term.description,
        "embedding": emb
    })
    return {"message": "Success"}

@app.put("/api/terms/{item_id}")
def update_term(item_id: int, term: TermModel):
    conn = get_db()
    c = conn.cursor()
    c.execute("UPDATE terms SET term_name=?, description=?, eng_abbr=?, domain_name=? WHERE id=?",
              (term.term_name, term.description, term.eng_abbr, term.domain_name, item_id))
    conn.commit()
    return {"message": "Success"}

# --------- WORDS ---------
@app.get("/api/words")
def get_words(page: int = 1, size: int = 20, search: Optional[str] = None):
    conn = get_db()
    c = conn.cursor()
    query_cond = ""
    params = []
    if search:
        query_cond = "WHERE word_name LIKE ? OR eng_abbr LIKE ?"
        params = [f"%{search}%", f"%{search}%"]
        
    c.execute(f"SELECT count(*) FROM words {query_cond}", params)
    total = c.fetchone()[0]
    
    c.execute(f"SELECT * FROM words {query_cond} ORDER BY id DESC LIMIT ? OFFSET ?", (*params, size, (page-1)*size))
    items = [dict(row) for row in c.fetchall()]
    return {"total": total, "items": items, "page": page, "size": size}

@app.post("/api/words")
def create_word(word: WordModel):
    conn = get_db()
    c = conn.cursor()
    c.execute("INSERT INTO words (word_name, eng_abbr, eng_name, description) VALUES (?, ?, ?, ?)",
              (word.word_name, word.eng_abbr, word.eng_name, word.description))
    conn.commit()
    
    emb = model.encode(word.word_name).tolist()
    client.index(index=INDEX_NAME, body={
        "type": "word",
        "name": word.word_name,
        "eng_abbr": word.eng_abbr,
        "description": word.description,
        "embedding": emb
    })
    return {"message": "Success"}

@app.put("/api/words/{item_id}")
def update_word(item_id: int, word: WordModel):
    conn = get_db()
    c = conn.cursor()
    c.execute("UPDATE words SET word_name=?, eng_abbr=?, eng_name=?, description=? WHERE id=?",
              (word.word_name, word.eng_abbr, word.eng_name, word.description, item_id))
    conn.commit()
    return {"message": "Success"}

# --------- DOMAINS ---------
@app.get("/api/domains")
def get_domains(page: int = 1, size: int = 20, search: Optional[str] = None):
    conn = get_db()
    c = conn.cursor()
    query_cond = ""
    params = []
    if search:
        query_cond = "WHERE domain_name LIKE ? OR domain_category LIKE ?"
        params = [f"%{search}%", f"%{search}%"]
        
    c.execute(f"SELECT count(*) FROM domains {query_cond}", params)
    total = c.fetchone()[0]
    
    c.execute(f"SELECT * FROM domains {query_cond} ORDER BY id DESC LIMIT ? OFFSET ?", (*params, size, (page-1)*size))
    items = [dict(row) for row in c.fetchall()]
    return {"total": total, "items": items, "page": page, "size": size}

@app.post("/api/domains")
def create_domain(dom: DomainModel):
    conn = get_db()
    c = conn.cursor()
    c.execute("INSERT INTO domains (domain_group, domain_category, domain_name, description, data_type, data_length) VALUES (?, ?, ?, ?, ?, ?)",
              (dom.domain_group, dom.domain_category, dom.domain_name, dom.description, dom.data_type, dom.data_length))
    conn.commit()
    return {"message": "Success"}

@app.put("/api/domains/{item_id}")
def update_domain(item_id: int, dom: DomainModel):
    conn = get_db()
    c = conn.cursor()
    c.execute("UPDATE domains SET domain_group=?, domain_category=?, domain_name=?, description=?, data_type=?, data_length=? WHERE id=?",
              (dom.domain_group, dom.domain_category, dom.domain_name, dom.description, dom.data_type, dom.data_length, item_id))
    conn.commit()
    return {"message": "Success"}

@app.get("/api/words/search")
def search_words_simple(q: str = ""):
    conn = get_db()
    c = conn.cursor()
    c.execute("SELECT id, word_name, eng_abbr, eng_name FROM words WHERE word_name LIKE ? OR eng_abbr LIKE ? LIMIT 20", (f"%{q}%", f"%{q}%"))
    return [dict(row) for row in c.fetchall()]

@app.get("/api/domains/search")
def search_domains_simple(q: str = ""):
    conn = get_db()
    c = conn.cursor()
    c.execute("SELECT id, domain_name, domain_category, data_type, data_length FROM domains WHERE domain_name LIKE ? OR domain_category LIKE ? LIMIT 20", (f"%{q}%", f"%{q}%"))
    return [dict(row) for row in c.fetchall()]

@app.get("/api/dictionary")
def get_dictionary(page: int = 1, size: int = 20, search: Optional[str] = None, type_filter: str = "all"):
    conn = get_db()
    c = conn.cursor()
    
    queries = []
    params = []
    count_queries = []
    count_params = []
    
    search_param = f"%{search}%" if search else "%"
    
    if type_filter in ["all", "terms"]:
        queries.append("SELECT 'terms' as type, id, term_name as name, eng_abbr, description, domain_name as extra1, '' as extra2 FROM terms WHERE term_name LIKE ? OR eng_abbr LIKE ?")
        params.extend([search_param, search_param])
        count_queries.append("SELECT count(*) FROM terms WHERE term_name LIKE ? OR eng_abbr LIKE ?")
        count_params.extend([search_param, search_param])
        
    if type_filter in ["all", "words"]:
        queries.append("SELECT 'words' as type, id, word_name as name, eng_abbr, description, eng_name as extra1, '' as extra2 FROM words WHERE word_name LIKE ? OR eng_abbr LIKE ?")
        params.extend([search_param, search_param])
        count_queries.append("SELECT count(*) FROM words WHERE word_name LIKE ? OR eng_abbr LIKE ?")
        count_params.extend([search_param, search_param])
        
    if type_filter in ["all", "domains"]:
        queries.append("SELECT 'domains' as type, id, domain_name as name, data_type as eng_abbr, description, domain_category as extra1, data_length as extra2 FROM domains WHERE domain_name LIKE ? OR domain_category LIKE ?")
        params.extend([search_param, search_param])
        count_queries.append("SELECT count(*) FROM domains WHERE domain_name LIKE ? OR domain_category LIKE ?")
        count_params.extend([search_param, search_param])
        
    union_query = " UNION ALL ".join(queries)
    final_query = f"SELECT * FROM ({union_query}) ORDER BY type, id DESC LIMIT ? OFFSET ?"
    
    c.execute("SELECT (" + " + ".join(f"({cq})" for cq in count_queries) + ")", count_params)
    total = c.fetchone()[0]
    
    c.execute(final_query, (*params, size, (page-1)*size))
    items = [dict(row) for row in c.fetchall()]
    
    return {"total": total, "items": items, "page": page, "size": size}

@app.post("/api/suggest")
def suggest_terms(req: SuggestRequest):
    try:
        emb = model.encode(req.query).tolist()
        query_body = {
            "size": req.top_k,
            "query": {
                "knn": {
                    "embedding": {
                        "vector": emb,
                        "k": req.top_k
                    }
                }
            }
        }
        res = client.search(index=INDEX_NAME, body=query_body)
        hits = res['hits']['hits']
        results = []
        for hit in hits:
            source = hit['_source']
            results.append({
                "type": source.get("type"),
                "name": source.get("name"),
                "eng_abbr": source.get("eng_abbr"),
                "description": source.get("description"),
                "score": hit['_score']
            })
        return {"results": results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/generate_ddl")
def generate_ddl(req: ColumnRequest):
    try:
        columns = []
        for logic_name in req.logical_names:
            emb = model.encode(logic_name).tolist()
            query_body = {
                "size": 1,
                "query": {
                    "knn": {
                        "embedding": {
                            "vector": emb,
                            "k": 1
                        }
                    }
                }
            }
            res = client.search(index=INDEX_NAME, body=query_body)
            hits = res['hits']['hits']
            if hits:
                best = hits[0]['_source']
                phys_name = best.get("eng_abbr", "UNKNOWN")
                columns.append({
                    "logical_name": logic_name,
                    "physical_name": phys_name,
                    "matched_standard": best.get("name"),
                    "type": best.get("type")
                })
            else:
                columns.append({
                    "logical_name": logic_name,
                    "physical_name": "UNKNOWN",
                    "matched_standard": None,
                    "type": None
                })
        
        # Build DDL
        ddl = f"CREATE TABLE {req.table_name} (\\n"
        ddl_lines = []
        for c in columns:
            col_name = c["physical_name"] if c["physical_name"] else "UNKNOWN_COL"
            ddl_lines.append(f"    {col_name} VARCHAR(100) /* {c['logical_name']} ({c['matched_standard']}) */")
        ddl += ",\\n".join(ddl_lines)
        ddl += "\\n);"
        
        return {"columns": columns, "ddl": ddl}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class AbbrRequest(BaseModel):
    eng_name: str

@app.post("/api/recommend_abbr")
def recommend_abbr(req: AbbrRequest):
    import re
    word = req.eng_name.strip().upper()
    if not word:
        return {"abbr": ""}
        
    # Remove special chars and spaces
    word = re.sub(r'[^A-Z0-9]', '', word)
    
    # Custom known rules
    known = {
        "MONTH": "MM", "DAY": "DD", "ERROR": "ERR", "BUSINESS": "BIZ",
        "DELETE": "DEL", "DELETION": "DEL", "EDUCATION": "EDU", "YEAR": "YR",
        "RETURN": "RTN", "NUMBER": "NO", "AMOUNT": "AMT", "MESSAGE": "MSG",
        "PASSWORD": "PSWD", "USER": "USER", "DATE": "DT", "TIME": "TM"
    }
    if word in known:
        return {"abbr": known[word]}
        
    # Rule 5: Length <= 4
    if len(word) <= 4:
        return {"abbr": word}
        
    # Rule 1 & 6: Remove vowels except first char
    first_char = word[0]
    rest = word[1:]
    rest_no_vowels = re.sub(r'[AEIOU]', '', rest)
    
    # Rule 2: Remove consecutive duplicate consonants
    deduped = ""
    for char in rest_no_vowels:
        if not deduped or deduped[-1] != char:
            deduped += char
            
    abbr = first_char + deduped
    
    # Rule 3: Max 6 letters (usually 4)
    abbr = abbr[:4]
    
    return {"abbr": abbr}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

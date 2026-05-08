import { useState, useEffect, useRef } from 'react'
import axios from 'axios'
import { Database, Search, Library, Plus, Edit2, ChevronLeft, ChevronRight, LayoutTemplate, Terminal, Trash2, CheckCircle2, BookOpen, Download, FileText, FileSpreadsheet } from 'lucide-react'
import './index.css'

function App() {
  const [activePage, setActivePage] = useState<'ddl' | 'search' | 'dict' | 'guide'>('ddl')
  
  // ------------------
  // 1. DDL Generator State
  // ------------------
  const [tableName, setTableName] = useState('T_NEW_TABLE')
  const [tableColumns, setTableColumns] = useState<any[]>([])
  const [ddl, setDdl] = useState('')

  // Column Builder State
  const [builderLogical, setBuilderLogical] = useState('')
  const [builderPhysical, setBuilderPhysical] = useState('')
  const [builderDataType, setBuilderDataType] = useState('VARCHAR(100)')
  
  // Autocomplete for Column Builder
  const [colWordSearch, setColWordSearch] = useState('')
  const [colWordResults, setColWordResults] = useState<any[]>([])
  const [colDomainSearch, setColDomainSearch] = useState('')
  const [colDomainResults, setColDomainResults] = useState<any[]>([])
  const [showColDomainDropdown, setShowColDomainDropdown] = useState(false)

  // ------------------
  // 2. Vector Search State
  // ------------------
  const [searchQuery, setSearchQuery] = useState('')
  const [suggestions, setSuggestions] = useState<any[]>([])
  const [searchLoading, setSearchLoading] = useState(false)

  // ------------------
  // 3. Dictionary Management State
  // ------------------
  const [dictType, setDictType] = useState<'all' | 'terms' | 'words' | 'domains'>('all')
  const [dictData, setDictData] = useState<any[]>([])
  const [dictTotal, setDictTotal] = useState(0)
  const [dictPage, setDictPage] = useState(1)
  const [dictSearch, setDictSearch] = useState('')
  const [dictLoading, setDictLoading] = useState(false)
  
  // Modal State for Dict
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalType, setModalType] = useState<'terms' | 'words' | 'domains'>('terms')
  const [editingItem, setEditingItem] = useState<any>(null)
  const [formData, setFormData] = useState<any>({})

  // Autocomplete for Dict Modal
  const [wordSearch, setWordSearch] = useState('')
  const [wordResults, setWordResults] = useState<any[]>([])
  const [domainSearch, setDomainSearch] = useState('')
  const [domainResults, setDomainResults] = useState<any[]>([])
  const [showDomainDropdown, setShowDomainDropdown] = useState(false)

  // ==========================================
  // Effects & Functions
  // ==========================================
  const fetchDictData = async () => {
    setDictLoading(true)
    try {
      const res = await axios.get(`/api/dictionary?page=${dictPage}&size=15&search=${dictSearch}&type_filter=${dictType}`)
      setDictData(res.data.items)
      setDictTotal(res.data.total)
    } catch (e) {
      console.error(e)
    }
    setDictLoading(false)
  }

  useEffect(() => {
    if (activePage === 'dict') fetchDictData()
  }, [activePage, dictType, dictPage])

  const handleVectorSearch = async () => {
    if (!searchQuery.trim()) return
    setSearchLoading(true)
    try {
      const res = await axios.post('/api/suggest', { query: searchQuery, top_k: 8 })
      setSuggestions(res.data.results)
    } catch (e) {
      console.error(e)
    }
    setSearchLoading(false)
  }

  const handleDictSearch = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      setDictPage(1)
      fetchDictData()
    }
  }

  const openModal = (item: any = null, mType: 'terms' | 'words' | 'domains' = 'terms') => {
    setEditingItem(item)
    setModalType(mType)
    if (item) {
      if (mType === 'terms') {
        setFormData({ id: item.id, term_name: item.name, eng_abbr: item.eng_abbr, description: item.description, domain_name: item.extra1 })
        setDomainSearch(item.extra1 || '')
      } else if (mType === 'words') {
        setFormData({ id: item.id, word_name: item.name, eng_abbr: item.eng_abbr, description: item.description, eng_name: item.extra1 })
      } else if (mType === 'domains') {
        setFormData({ id: item.id, domain_name: item.name, data_type: item.eng_abbr, description: item.description, domain_category: item.extra1, data_length: item.extra2 })
      }
    } else {
      setFormData({})
      setDomainSearch('')
      setWordSearch('')
    }
    setWordResults([])
    setShowDomainDropdown(false)
    setIsModalOpen(true)
  }

  const saveDictItem = async () => {
    try {
      if (editingItem && editingItem.id) {
        await axios.put(`/api/${modalType}/${editingItem.id}`, formData)
      } else {
        await axios.post(`/api/${modalType}`, formData)
      }
      setIsModalOpen(false)
      fetchDictData()
    } catch (e) {
      console.error(e)
    }
  }

  // --- Search Word/Domain for Modal ---
  useEffect(() => {
    if (wordSearch.trim().length > 0) {
      const delay = setTimeout(async () => {
        try {
          const res = await axios.get(`/api/words/search?q=${wordSearch}`)
          setWordResults(res.data)
        } catch (e) {}
      }, 300)
      return () => clearTimeout(delay)
    } else { setWordResults([]) }
  }, [wordSearch])

  useEffect(() => {
    if (domainSearch.trim().length > 0 && showDomainDropdown) {
      const delay = setTimeout(async () => {
        try {
          const res = await axios.get(`/api/domains/search?q=${domainSearch}`)
          setDomainResults(res.data)
        } catch (e) {}
      }, 300)
      return () => clearTimeout(delay)
    } else { setDomainResults([]) }
  }, [domainSearch, showDomainDropdown])

  const addWordToTerm = (word: any) => {
    const currentName = formData.term_name || ''
    const currentAbbr = formData.eng_abbr || ''
    setFormData({
      ...formData,
      term_name: currentName + word.word_name,
      eng_abbr: currentAbbr + (currentAbbr ? '_' : '') + word.eng_abbr
    })
    setWordSearch('')
  }

  const selectDomain = (domain: any) => {
    setFormData({ ...formData, domain_name: domain.domain_name })
    setDomainSearch(domain.domain_name)
    setShowDomainDropdown(false)
  }

  // --- Search Word/Domain for DDL Builder ---
  useEffect(() => {
    if (colWordSearch.trim().length > 0) {
      const delay = setTimeout(async () => {
        try {
          const res = await axios.get(`/api/words/search?q=${colWordSearch}`)
          setColWordResults(res.data)
        } catch (e) {}
      }, 300)
      return () => clearTimeout(delay)
    } else { setColWordResults([]) }
  }, [colWordSearch])

  useEffect(() => {
    if (colDomainSearch.trim().length > 0 && showColDomainDropdown) {
      const delay = setTimeout(async () => {
        try {
          const res = await axios.get(`/api/domains/search?q=${colDomainSearch}`)
          setColDomainResults(res.data)
        } catch (e) {}
      }, 300)
      return () => clearTimeout(delay)
    } else { setColDomainResults([]) }
  }, [colDomainSearch, showColDomainDropdown])

  const addWordToColumn = (word: any) => {
    setBuilderLogical(prev => prev + word.word_name)
    setBuilderPhysical(prev => prev + (prev ? '_' : '') + word.eng_abbr)
    setColWordSearch('')
  }

  const selectColDomain = (domain: any) => {
    setBuilderDataType(`${domain.data_type}(${domain.data_length})`)
    setColDomainSearch(domain.domain_name)
    setShowColDomainDropdown(false)
  }

  // AI 자동완성 및 벡터 추천
  const [vectorQuery, setVectorQuery] = useState('')
  const [vectorColResults, setVectorColResults] = useState<any[]>([])
  const [vectorLoading, setVectorLoading] = useState(false)

  const searchVectorForColumn = async () => {
    if (!vectorQuery.trim()) return
    setVectorLoading(true)
    try {
      const res = await axios.post('/api/suggest', { query: vectorQuery, top_k: 6 })
      setVectorColResults(res.data.results)
    } catch (e) { console.error(e) }
    setVectorLoading(false)
  }

  const addVectorResultToColumn = (item: any) => {
    setBuilderLogical(prev => prev + item.name)
    setBuilderPhysical(prev => prev + (prev ? '_' : '') + (item.eng_abbr || ''))
    // 도메인이 있으면 자동 세팅
    if (item.type === 'term' && item.extra1) {
      // term은 도메인 정보가 있을 수 있음
    }
  }

  const handleAddColumn = () => {
    if (!builderPhysical.trim()) return
    if (!colDomainSearch.trim() && !builderDataType.trim()) {
      alert('끝 단어는 항상 도메인(분류단어)으로 지정해야 합니다. 도메인을 선택해주세요.')
      return
    }
    setTableColumns([...tableColumns, {
      logical: builderLogical,
      physical: builderPhysical,
      dataType: builderDataType
    }])
    setBuilderLogical('')
    setBuilderPhysical('')
    setColDomainSearch('')
    setBuilderDataType('')
  }

  const generateDDLString = () => {
    let output = `CREATE TABLE ${tableName} (\\n`
    const lines = tableColumns.map(c => `    ${c.physical} ${c.dataType} /* ${c.logical} */`)
    output += lines.join(',\\n')
    output += '\\n);'
    setDdl(output)
  }

  const recommendAbbr = async () => {
    if (!formData.eng_name) {
      alert("영문명을 먼저 입력해주세요.")
      return
    }
    try {
      const res = await axios.post('/api/recommend_abbr', { eng_name: formData.eng_name })
      setFormData({ ...formData, eng_abbr: res.data.abbr })
    } catch (e) { console.error(e) }
  }

  return (
    <div className="layout">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="brand">
          <Database size={24} />
          <span>GovData Std</span>
        </div>
        
        <nav>
          <div className={`nav-item ${activePage === 'ddl' ? 'active' : ''}`} onClick={() => setActivePage('ddl')}>
            <Terminal size={20} />
            <span>DDL 생성기</span>
          </div>
          <div className={`nav-item ${activePage === 'search' ? 'active' : ''}`} onClick={() => setActivePage('search')}>
            <Search size={20} />
            <span>벡터 검색</span>
          </div>
          <div className={`nav-item ${activePage === 'dict' ? 'active' : ''}`} onClick={() => {setActivePage('dict'); setDictPage(1);}}>
            <Library size={20} />
            <span>표준사전 관리</span>
          </div>
          <div className={`nav-item ${activePage === 'guide' ? 'active' : ''}`} onClick={() => setActivePage('guide')}>
            <BookOpen size={20} />
            <span>가이드 및 양식</span>
          </div>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        {activePage === 'ddl' && (
          <div className="page-content">
            <div className="header-area">
              <h1>정밀 DDL 빌더</h1>
              <p>표준단어 및 도메인을 직접 검색하고 조합하여 정확한 표준 컬럼을 설계하세요.</p>
            </div>
            
            <div className="card">
              <div className="card-title">
                <LayoutTemplate size={20} /> 테이블 기본 정보
              </div>
              <div className="input-group">
                <div className="input-wrapper">
                  <input 
                    type="text" 
                    placeholder="테이블 물리명 (예: T_USER)" 
                    value={tableName}
                    onChange={(e) => setTableName(e.target.value)}
                  />
                </div>
              </div>

              <hr style={{ margin: '2rem 0', borderColor: 'var(--border-color)', opacity: 0.5 }}/>
              
              <div className="card-title">
                <Plus size={20} /> 표준 컬럼 조합기 (AI 벡터 검색 & 도메인 선택)
              </div>
              
              <div className="word-composer" style={{ background: 'transparent', border: 'none', padding: 0 }}>
                {/* 1단계: 벡터 검색으로 단어/용어 찾기 */}
                <div style={{ display: 'flex', gap: '0.5rem', width: '100%', marginBottom: '1rem', alignItems: 'center' }}>
                  <div className="input-wrapper" style={{ flex: 1 }}>
                    <Search size={16} className="icon" />
                    <input 
                      type="text" 
                      className="with-icon"
                      placeholder="자연어로 의미 검색 (예: 회원 집 주소)" 
                      value={vectorQuery}
                      onChange={(e) => setVectorQuery(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && searchVectorForColumn()}
                    />
                  </div>
                  <button className="btn btn-secondary" onClick={searchVectorForColumn} disabled={vectorLoading}>
                    {vectorLoading ? '검색 중...' : '의미 기반 단어 찾기'}
                  </button>
                </div>

                {vectorColResults.length > 0 && (
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1.5rem', padding: '1rem', background: 'var(--hover-bg)', borderRadius: '8px' }}>
                    <div style={{ width: '100%', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>추천 단어 (클릭하여 조합)</div>
                    {vectorColResults.map((v, i) => (
                      <button key={i} className="btn-outline" style={{ padding: '0.4rem 0.8rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.9rem' }} onClick={() => addVectorResultToColumn(v)}>
                        <strong>{v.name}</strong> ({v.eng_abbr})
                      </button>
                    ))}
                  </div>
                )}

                {/* 2단계: 끝 단어(도메인/분류) 선택 강제 */}
                <div style={{ width: '100%', marginBottom: '0.5rem', fontWeight: 600, color: 'var(--danger)' }}>* 항상 끝 단어는 분류단어(도메인)여야 합니다. 도메인을 검색해 선택하세요.</div>
                <div className="input-wrapper" style={{ width: '100%', marginBottom: '1.5rem' }}>
                  <Search size={16} className="icon" />
                  <input 
                    type="text" 
                    className="with-icon"
                    placeholder="도메인(분류단어) 검색 및 타입 지정 (예: 식별번호, 일자, 여부)" 
                    value={colDomainSearch}
                    onChange={(e) => {
                      setColDomainSearch(e.target.value);
                      setShowColDomainDropdown(true);
                    }}
                    onFocus={() => setShowColDomainDropdown(true)}
                  />
                  {colDomainResults.length > 0 && showColDomainDropdown && (
                    <div className="autocomplete-dropdown">
                      {colDomainResults.map((d, idx) => (
                        <div key={idx} className="autocomplete-item" onClick={() => selectColDomain(d)}>
                          <div className="autocomplete-item-title">{d.domain_name}</div>
                          <div className="autocomplete-item-desc">{d.data_type}({d.data_length})</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '1rem', width: '100%', alignItems: 'center' }}>
                  <div className="form-group" style={{ flex: 1, margin: 0 }}>
                    <label>조합된 논리 컬럼명</label>
                    <input type="text" value={builderLogical} onChange={e => setBuilderLogical(e.target.value)} />
                  </div>
                  <div className="form-group" style={{ flex: 1, margin: 0 }}>
                    <label>조합된 물리 컬럼명</label>
                    <input type="text" value={builderPhysical} onChange={e => setBuilderPhysical(e.target.value)} />
                  </div>
                  <div className="form-group" style={{ flex: 1, margin: 0 }}>
                    <label>데이터 타입 (도메인)</label>
                    <input type="text" value={builderDataType} onChange={e => setBuilderDataType(e.target.value)} />
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.5rem' }}>
                    <button className="btn btn-secondary" onClick={() => { setBuilderLogical(''); setBuilderPhysical(''); setBuilderDataType('VARCHAR(100)') }}>
                      초기화
                    </button>
                    <button className="btn" onClick={handleAddColumn} disabled={!builderPhysical}>
                      추가
                    </button>
                  </div>
                </div>
              </div>

              {/* 추가된 컬럼 목록 */}
              {tableColumns.length > 0 && (
                <div className="table-wrapper" style={{ marginTop: '2rem' }}>
                  <table>
                    <thead>
                      <tr>
                        <th>논리명</th>
                        <th>물리명</th>
                        <th>데이터타입</th>
                        <th width="80">삭제</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tableColumns.map((col, idx) => (
                        <tr key={idx}>
                          <td>{col.logical}</td>
                          <td className="abbr">{col.physical}</td>
                          <td>{col.dataType}</td>
                          <td>
                            <button className="action-btn" style={{ color: 'var(--danger)' }} onClick={() => {
                              setTableColumns(tableColumns.filter((_, i) => i !== idx))
                            }}>
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div style={{ padding: '1rem', textAlign: 'right', borderTop: '1px solid var(--border-color)' }}>
                    <button className="btn" onClick={generateDDLString}>
                      <Terminal size={16} /> 최종 DDL 생성
                    </button>
                  </div>
                </div>
              )}

              {ddl && (
                <div className="result-box">
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                    <strong>생성된 쿼리</strong>
                    <CheckCircle2 size={18} color="var(--success)" />
                  </div>
                  <pre>{ddl}</pre>
                </div>
              )}
            </div>
          </div>
        )}

        {activePage === 'search' && (
          <div className="page-content">
            <div className="header-area">
              <h1>표준 용어 벡터 검색</h1>
              <p>모호한 단어나 의미를 검색하면 가장 유사한 공공데이터 표준어를 추천해줍니다.</p>
            </div>

            <div className="card">
              <div className="input-group">
                <div className="input-wrapper">
                  <Search size={18} className="icon" />
                  <input 
                    type="text" 
                    className="with-icon"
                    placeholder="검색할 용어 입력 (예: 고객의 집 주소)" 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleVectorSearch()}
                  />
                </div>
                <button className="btn" onClick={handleVectorSearch} disabled={searchLoading}>
                  {searchLoading ? '검색 중...' : '검색'}
                </button>
              </div>

              <div className="suggestions-list">
                {suggestions.map((item, idx) => (
                  <div key={idx} className="suggestion-card">
                    <div className="suggestion-content">
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <h3>{item.name}</h3>
                        <span className={`tag ${item.type}`}>
                          {item.type === 'term' ? '표준용어' : item.type === 'word' ? '표준단어' : '표준도메인'}
                        </span>
                      </div>
                      <p>{item.description}</p>
                      <div className="abbr">물리명(영문약어): {item.eng_abbr || '없음'}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activePage === 'dict' && (
          <div className="page-content">
            <div className="header-area">
              <h1>표준 사전 통합 관리</h1>
              <p>전체 표준사전(단어/용어/도메인)을 한곳에서 통합 검색하고 관리할 수 있습니다.</p>
            </div>

            <div className="card" style={{ padding: '0', background: 'transparent', border: 'none', boxShadow: 'none' }}>
              <div className="dict-controls">
                <div className="tabs-inline">
                  <button className={`tab-inline-btn ${dictType === 'all' ? 'active' : ''}`} onClick={() => {setDictType('all'); setDictPage(1);}}>전체보기</button>
                  <button className={`tab-inline-btn ${dictType === 'terms' ? 'active' : ''}`} onClick={() => {setDictType('terms'); setDictPage(1);}}>표준용어</button>
                  <button className={`tab-inline-btn ${dictType === 'words' ? 'active' : ''}`} onClick={() => {setDictType('words'); setDictPage(1);}}>표준단어</button>
                  <button className={`tab-inline-btn ${dictType === 'domains' ? 'active' : ''}`} onClick={() => {setDictType('domains'); setDictPage(1);}}>표준도메인</button>
                </div>

                <div style={{ display: 'flex', gap: '1rem' }}>
                  <div className="input-wrapper" style={{ width: '250px' }}>
                    <Search size={16} className="icon" style={{ left: '0.75rem' }} />
                    <input 
                      type="text" 
                      className="with-icon"
                      placeholder="이름/약어 검색 후 Enter" 
                      style={{ paddingLeft: '2.25rem', paddingRight: '0.75rem', paddingBottom: '0.5rem', paddingTop: '0.5rem' }}
                      value={dictSearch}
                      onChange={(e) => setDictSearch(e.target.value)}
                      onKeyDown={handleDictSearch}
                    />
                  </div>
                  <button className="btn" onClick={() => openModal(null, dictType === 'all' ? 'terms' : dictType as any)}>
                    <Plus size={18} /> 새 항목
                  </button>
                </div>
              </div>

              <div className="table-wrapper">
                {dictLoading ? (
                  <div style={{ padding: '3rem', textAlign: 'center' }}>데이터를 불러오는 중...</div>
                ) : (
                  <table>
                    <thead>
                      <tr>
                        <th width="100">분류</th>
                        <th>이름(명칭)</th>
                        <th>영문약어/타입</th>
                        <th>설명</th>
                        <th>추가정보(도메인/길이)</th>
                        <th width="80">관리</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dictData.map((item, i) => (
                        <tr key={i}>
                          <td>
                            <span className={`tag ${item.type}`}>
                              {item.type === 'terms' ? '용어' : item.type === 'words' ? '단어' : '도메인'}
                            </span>
                          </td>
                          <td style={{ fontWeight: 500 }}>{item.name}</td>
                          <td><span className="abbr">{item.eng_abbr}</span></td>
                          <td>{item.description}</td>
                          <td>
                            {item.extra1} {item.extra2 ? `(${item.extra2})` : ''}
                          </td>
                          <td>
                            <button className="action-btn" onClick={() => openModal(item, item.type)}>
                              <Edit2 size={16} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
              
              <div className="pagination">
                <button className="btn-secondary btn" disabled={dictPage === 1} onClick={() => setDictPage(p => p - 1)}>
                  <ChevronLeft size={18} /> 이전
                </button>
                <span>{dictPage} / {Math.max(1, Math.ceil(dictTotal / 15))} 페이지 (총 {dictTotal}건)</span>
                <button className="btn-secondary btn" disabled={dictPage * 15 >= dictTotal} onClick={() => setDictPage(p => p + 1)}>
                  다음 <ChevronRight size={18} />
                </button>
              </div>
            </div>
          </div>
        )}

        {activePage === 'guide' && (
          <div className="page-content">
            <div className="header-area">
              <h1>표준화관리 매뉴얼 및 공통표준</h1>
              <p>공공데이터 데이터베이스 표준화 관리 매뉴얼과 공통표준 엑셀 파일을 확인하고 다운로드하세요.</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
              <div className="card" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                  <div style={{ padding: '0.75rem', background: 'rgba(59, 130, 246, 0.1)', color: 'var(--primary)', borderRadius: '8px' }}>
                    <FileText size={24} />
                  </div>
                  <div>
                    <h2 style={{ margin: 0, fontSize: '1.1rem' }}>표준화관리 매뉴얼</h2>
                    <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>PDF Document</p>
                  </div>
                </div>
                <div style={{ flex: 1, color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem', lineHeight: 1.6 }}>
                  데이터베이스의 메타데이터 표준화에 대한 전반적인 지침을 제공합니다. 단어/용어/도메인의 정의 규칙, 영어 약어 생성 규칙, 데이터베이스 스키마 설계 가이드라인 등이 포함되어 있습니다.
                </div>
                <button className="btn" style={{ width: '100%', justifyContent: 'center' }} onClick={() => {
                  const link = document.createElement('a');
                  link.href = '/standard_manual.pdf';
                  link.download = '표준화관리_매뉴얼.pdf';
                  link.click();
                }}>
                  <Download size={18} /> 매뉴얼 다운로드
                </button>
              </div>

              <div className="card" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                  <div style={{ padding: '0.75rem', background: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)', borderRadius: '8px' }}>
                    <FileSpreadsheet size={24} />
                  </div>
                  <div>
                    <h2 style={{ margin: 0, fontSize: '1.1rem' }}>공통표준사전 엑셀</h2>
                    <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>Excel Spreadsheet</p>
                  </div>
                </div>
                <div style={{ flex: 1, color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem', lineHeight: 1.6 }}>
                  행정안전부에서 제공하는 공공데이터 공통표준용어 및 도메인 사전을 담은 엑셀 파일입니다. 시스템에 등록하기 전 대량의 데이터를 확인하거나 외부 시스템 연계 시 활용할 수 있습니다.
                </div>
                <button className="btn" style={{ width: '100%', justifyContent: 'center', background: 'var(--success)', borderColor: 'var(--success)' }} onClick={() => {
                  const link = document.createElement('a');
                  link.href = '/common_standard.xlsx';
                  link.download = '공통표준사전.xlsx';
                  link.click();
                }}>
                  <Download size={18} /> 엑셀 파일 다운로드
                </button>
              </div>
            </div>

            <div className="card">
              <div className="card-title">
                <BookOpen size={20} /> 핵심 표준화 규칙 (요약)
              </div>
              <div className="table-wrapper" style={{ marginTop: '1rem' }}>
                <table>
                  <thead>
                    <tr>
                      <th>구분</th>
                      <th>핵심 규칙</th>
                      <th>예시</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td style={{ fontWeight: 600 }}>표준 단어</td>
                      <td>
                        <ul style={{ margin: 0, paddingLeft: '1.2rem' }}>
                          <li>최소 단위의 의미를 가지는 명사</li>
                          <li>동음이의어 금지, 영문약어는 3~5자 권장</li>
                        </ul>
                      </td>
                      <td>고객 (CUST), 주소 (ADDR)</td>
                    </tr>
                    <tr>
                      <td style={{ fontWeight: 600 }}>표준 용어</td>
                      <td>
                        <ul style={{ margin: 0, paddingLeft: '1.2rem' }}>
                          <li>단어들의 조합 + 마지막은 도메인으로 끝남</li>
                          <li>총 길이 30자 이내, 약어 조합 시 언더바(_) 사용 (선택)</li>
                        </ul>
                      </td>
                      <td>고객주소 (CUST_ADDR)</td>
                    </tr>
                    <tr>
                      <td style={{ fontWeight: 600 }}>표준 도메인</td>
                      <td>
                        <ul style={{ margin: 0, paddingLeft: '1.2rem' }}>
                          <li>컬럼의 데이터 타입과 길이를 그룹화</li>
                          <li>분류어(금액, 명, 번호, 일자 등)를 기준으로 생성</li>
                        </ul>
                      </td>
                      <td>명_30 (VARCHAR 30), 금액_15 (NUMBER 15)</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Modal */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal">
            <h2>
              {editingItem ? '수정하기' : '새로 추가하기'} 
              <span className={`tag ${modalType}`} style={{ marginLeft: '1rem', verticalAlign: 'middle' }}>
                {modalType === 'terms' ? '표준용어' : modalType === 'words' ? '표준단어' : '표준도메인'}
              </span>
            </h2>
            
            {modalType === 'terms' && (
              <>
                {!editingItem && (
                  <div className="word-composer">
                    <div style={{ width: '100%', marginBottom: '0.5rem', fontWeight: 600, fontSize: '0.9rem' }}>단어 조합기로 용어 만들기</div>
                    <div className="input-wrapper" style={{ flex: 1 }}>
                      <Search size={16} className="icon" />
                      <input 
                        type="text" 
                        className="with-icon"
                        placeholder="단어 검색 후 선택하여 조합 (예: 고객)" 
                        value={wordSearch}
                        onChange={(e) => setWordSearch(e.target.value)}
                      />
                      {wordResults.length > 0 && (
                        <div className="autocomplete-dropdown">
                          {wordResults.map((w, idx) => (
                            <div key={idx} className="autocomplete-item" onClick={() => addWordToTerm(w)}>
                              <div className="autocomplete-item-title">{w.word_name}</div>
                              <div className="autocomplete-item-desc">{w.eng_abbr} | {w.eng_name}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
                <div className="form-group">
                  <label>용어명</label>
                  <input type="text" value={formData.term_name || ''} onChange={e => setFormData({...formData, term_name: e.target.value})} />
                </div>
                <div className="form-group">
                  <label>영문약어</label>
                  <input type="text" value={formData.eng_abbr || ''} onChange={e => setFormData({...formData, eng_abbr: e.target.value})} />
                </div>
                <div className="form-group">
                  <label>도메인 선택</label>
                  <div className="input-wrapper">
                    <input 
                      type="text" 
                      placeholder="도메인 검색" 
                      value={domainSearch}
                      onChange={(e) => {
                        setDomainSearch(e.target.value);
                        setShowDomainDropdown(true);
                      }}
                      onFocus={() => setShowDomainDropdown(true)}
                    />
                    {domainResults.length > 0 && showDomainDropdown && (
                      <div className="autocomplete-dropdown">
                        {domainResults.map((d, idx) => (
                          <div key={idx} className="autocomplete-item" onClick={() => selectDomain(d)}>
                            <div className="autocomplete-item-title">{d.domain_name}</div>
                            <div className="autocomplete-item-desc">{d.domain_category} | {d.data_type}({d.data_length})</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="form-group">
                  <label>설명</label>
                  <input type="text" value={formData.description || ''} onChange={e => setFormData({...formData, description: e.target.value})} />
                </div>
              </>
            )}

            {modalType === 'words' && (
              <>
                <div className="form-group">
                  <label>단어명</label>
                  <input type="text" value={formData.word_name || ''} onChange={e => setFormData({...formData, word_name: e.target.value})} />
                </div>
                <div className="form-group">
                  <label>영문명</label>
                  <input type="text" value={formData.eng_name || ''} onChange={e => setFormData({...formData, eng_name: e.target.value})} />
                </div>
                <div className="form-group">
                  <label>영문약어</label>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <input type="text" value={formData.eng_abbr || ''} onChange={e => setFormData({...formData, eng_abbr: e.target.value})} />
                    <button className="btn btn-secondary" onClick={recommendAbbr}>약어 추천</button>
                  </div>
                </div>
                <div className="form-group">
                  <label>설명</label>
                  <input type="text" value={formData.description || ''} onChange={e => setFormData({...formData, description: e.target.value})} />
                </div>
              </>
            )}

            {modalType === 'domains' && (
              <>
                <div className="form-group">
                  <label>도메인명</label>
                  <input type="text" value={formData.domain_name || ''} onChange={e => setFormData({...formData, domain_name: e.target.value})} />
                </div>
                <div className="form-group">
                  <label>분류명</label>
                  <input type="text" value={formData.domain_category || ''} onChange={e => setFormData({...formData, domain_category: e.target.value})} />
                </div>
                <div className="form-group" style={{ display: 'flex', gap: '1rem' }}>
                  <div style={{ flex: 1 }}>
                    <label>데이터타입</label>
                    <input type="text" value={formData.data_type || ''} onChange={e => setFormData({...formData, data_type: e.target.value})} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label>데이터길이</label>
                    <input type="text" value={formData.data_length || ''} onChange={e => setFormData({...formData, data_length: e.target.value})} />
                  </div>
                </div>
                <div className="form-group">
                  <label>설명</label>
                  <input type="text" value={formData.description || ''} onChange={e => setFormData({...formData, description: e.target.value})} />
                </div>
              </>
            )}

            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>취소</button>
              <button className="btn" onClick={saveDictItem}>저장</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App

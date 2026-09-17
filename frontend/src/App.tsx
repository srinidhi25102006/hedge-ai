import { useState, useEffect } from 'react';
import { 
  Send, 
  Sparkles, 
  ExternalLink, 
  ChevronDown, 
  ChevronUp, 
  HelpCircle, 
  Info, 
  AlertTriangle, 
  XCircle,
  MessageSquare,
  User,
  Edit3,
  Trash2,
  Check,
  CheckCircle2,
  X,
  ServerOff
} from 'lucide-react';

interface EvidenceItem {
  title: string;
  url: string;
  snippet: string;
}

interface TimelineData {
  initial: number;
  after_search: number;
  final: number;
}

interface QueryResponseData {
  query_type: string;
  answer: string;
  confidence: number;
  label: string;
  timeline: TimelineData;
  evidence: EvidenceItem[];
  explanation: string;
  raw_answer?: string | null;
}

interface ChatMessage {
  id: string;
  userQuery: string;
  response: QueryResponseData;
  timestamp: string;
}

const PRESET_QUERIES = [
  { label: '🇫🇷 Capital of France', query: "What's the capital of France?", type: 'High Factual' },
  { label: '📊 Mobile Traffic Share', query: "What is the global mobile traffic share in Q3 2026?", type: 'Disputed Fact' },
  { label: '🔒 Secret Quantum Chip', query: "What is Apple's secret internal code name for its 2029 quantum chip?", type: 'Low Confidence' },
  { label: '🌧️ Rain Haiku', query: "Write a haiku about rain.", type: 'Creative' },
  { label: '🐍 Tell me about Python', query: "Tell me about Python.", type: 'Ambiguous' },
];

const MAX_HISTORY_ITEMS = 20;

// Safe localStorage helpers for private browsing resilience
const safeGetItem = (key: string): string | null => {
  try {
    return localStorage.getItem(key);
  } catch (e) {
    console.warn(`[Hedge Storage] Read failed for "${key}":`, e);
    return null;
  }
};

const safeSetItem = (key: string, value: string): void => {
  try {
    localStorage.setItem(key, value);
  } catch (e) {
    console.warn(`[Hedge Storage] Write failed for "${key}":`, e);
  }
};

const safeRemoveItem = (key: string): void => {
  try {
    localStorage.removeItem(key);
  } catch (e) {
    console.warn(`[Hedge Storage] Remove failed for "${key}":`, e);
  }
};

export default function App() {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingStage, setLoadingStage] = useState(0);
  const [compareMode, setCompareMode] = useState<boolean>(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [openEvidence, setOpenEvidence] = useState<Record<string, boolean>>({});

  // Feature A: Anonymous Session Identity State
  const [sessionId, setSessionId] = useState<string>('');
  const [userName, setUserName] = useState<string>('Guest');
  const [isEditingName, setIsEditingName] = useState<boolean>(false);
  const [nameInput, setNameInput] = useState<string>('');
  const [showFirstTimeModal, setShowFirstTimeModal] = useState<boolean>(false);

  // Initialize Session ID, User Name & Load Persisted History
  useEffect(() => {
    // 1. Session ID
    let currentSessionId = safeGetItem('hedge_session_id');
    if (!currentSessionId) {
      currentSessionId = typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : 'sess_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
      safeSetItem('hedge_session_id', currentSessionId);
    }
    setSessionId(currentSessionId);

    // 2. User Display Name
    const savedName = safeGetItem('hedge_user_name');
    if (savedName && savedName.trim()) {
      setUserName(savedName.trim());
    } else {
      setUserName('Guest');
      const prompted = safeGetItem('hedge_name_prompted');
      if (!prompted) {
        setShowFirstTimeModal(true);
      }
    }

    // 3. Session Chat History
    const historyKey = `hedge_history_${currentSessionId}`;
    const savedHistoryRaw = safeGetItem(historyKey);
    if (savedHistoryRaw) {
      try {
        const parsed = JSON.parse(savedHistoryRaw);
        if (Array.isArray(parsed)) {
          setMessages(parsed.slice(0, MAX_HISTORY_ITEMS));
        }
      } catch (e) {
        console.error('[Hedge History] Error parsing stored history:', e);
      }
    }
  }, []);

  // Cycle through short sequence of static status messages during query execution
  useEffect(() => {
    let timer1: ReturnType<typeof setTimeout>;
    let timer2: ReturnType<typeof setTimeout>;
    let timer3: ReturnType<typeof setTimeout>;
    if (loading) {
      setLoadingStage(0);
      timer1 = setTimeout(() => setLoadingStage(1), 1500); // Stage 1: Generating & cross-checking (~1.5s)
      timer2 = setTimeout(() => setLoadingStage(2), 3500); // Stage 2: Searching for evidence (~3.5s)
      timer3 = setTimeout(() => setLoadingStage(3), 5500); // Stage 3: Finalizing score (~5.5s)
    } else {
      setLoadingStage(0);
    }
    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  }, [loading]);

  const toggleEvidence = (id: string) => {
    setOpenEvidence(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleSaveName = (newName: string) => {
    const trimmed = newName.trim();
    const finalName = trimmed || 'Guest';
    setUserName(finalName);
    safeSetItem('hedge_user_name', finalName);
    safeSetItem('hedge_name_prompted', 'true');
    setIsEditingName(false);
    setShowFirstTimeModal(false);
  };

  const handleDismissFirstTimeModal = () => {
    safeSetItem('hedge_name_prompted', 'true');
    setShowFirstTimeModal(false);
  };

  const handleClearHistory = () => {
    setMessages([]);
    if (sessionId) {
      safeRemoveItem(`hedge_history_${sessionId}`);
    }
  };

  const handleSend = async (textToSend?: string) => {
    const targetQuery = (textToSend || query).trim();
    if (!targetQuery || loading) return;

    console.log(`[Hedge UI] Dispatching query request: "${targetQuery}" (compare_mode=${compareMode})`);
    setLoading(true);
    setQuery(''); // Always reset input box query state on submit

    try {
      let res: Response | null = null;
      try {
        res = await fetch('/api/query', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: targetQuery, compare_mode: compareMode }),
        });
      } catch (proxyErr) {
        console.warn('[Hedge UI] Vite proxy connection failed, trying direct backend ports...', proxyErr);
      }

      // If proxy fetch failed or returned server/gateway error, attempt direct fetch to 8001 and 8000
      if (!res || !res.ok) {
        for (const port of [8001, 8000]) {
          try {
            const fallbackRes = await fetch(`http://127.0.0.1:${port}/api/query`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ query: targetQuery, compare_mode: compareMode }),
            });
            if (fallbackRes.ok) {
              res = fallbackRes;
              break;
            }
          } catch (e) {
            // continue to next port
          }
        }
      }

      if (!res || !res.ok) {
        throw new Error(`Server returned ${res ? res.status : 'No Connection'}`);
      }

      const data: QueryResponseData = await res.json();
      console.log(`[Hedge UI] Received response for "${targetQuery}":`, data);

      const newMsg: ChatMessage = {
        id: Date.now().toString() + Math.random().toString(36).substring(2, 5),
        userQuery: targetQuery,
        response: data,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages(prev => {
        const updated = [newMsg, ...prev].slice(0, MAX_HISTORY_ITEMS);
        if (sessionId) {
          safeSetItem(`hedge_history_${sessionId}`, JSON.stringify(updated));
        }
        return updated;
      });
    } catch (err: any) {
      console.error('[Hedge UI] Error processing query:', err);
      const fallbackMsg: ChatMessage = {
        id: Date.now().toString(),
        userQuery: targetQuery,
        response: {
          query_type: 'factual',
          answer: 'Unable to connect to backend server. Please ensure backend FastAPI server is running on http://localhost:8001 or http://localhost:8000.',
          confidence: 0.0,
          label: 'Service Unavailable',
          timeline: { initial: 0, after_search: 0, final: 0 },
          evidence: [],
          explanation: 'Backend connection error.',
          raw_answer: compareMode ? 'Unable to connect to backend server.' : null,
        },
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages(prev => {
        const updated = [fallbackMsg, ...prev].slice(0, MAX_HISTORY_ITEMS);
        if (sessionId) {
          safeSetItem(`hedge_history_${sessionId}`, JSON.stringify(updated));
        }
        return updated;
      });
    } finally {
      setLoading(false);
    }
  };

  const getBadgeClass = (label: string, queryType: string) => {
    if (label.includes('Service Unavailable')) return 'badge badge-service-unavailable';
    if (queryType === 'ambiguous') return 'badge badge-ambiguous';
    if (label.includes('Very Confident') || label.includes('Confident')) return 'badge badge-very-confident';
    if (label.includes('Uncertain') && !label.includes('Very')) return 'badge badge-uncertain';
    return 'badge badge-very-uncertain';
  };

  const getBadgeIcon = (label: string, queryType: string) => {
    if (label.includes('Service Unavailable')) return <ServerOff size={14} />;
    if (queryType === 'ambiguous') return <HelpCircle size={14} />;
    if (label.includes('Very Confident') || label.includes('Confident')) return <CheckCircle2 size={14} />;
    if (label.includes('Uncertain') && !label.includes('Very')) return <AlertTriangle size={14} />;
    return <XCircle size={14} />;
  };

  return (
    <div className="app-layout">
      {/* First-Time Optional Name Prompt Modal */}
      {showFirstTimeModal && (
        <div className="modal-backdrop">
          <div className="name-prompt-modal">
            <div className="modal-header">
              <h3>Welcome to Hedge 👋</h3>
              <button className="icon-btn-close" onClick={handleDismissFirstTimeModal}>
                <X size={16} />
              </button>
            </div>
            <p className="modal-desc">
              Would you like to set a display name for your session? (Stored locally in your browser only)
            </p>
            <form onSubmit={(e) => { e.preventDefault(); handleSaveName(nameInput); }} className="modal-form">
              <input
                type="text"
                className="modal-input"
                placeholder="Enter your name (e.g., Srini)..."
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                autoFocus
              />
              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={handleDismissFirstTimeModal}>
                  Skip (Use Guest)
                </button>
                <button type="submit" className="btn-primary">
                  Save Name
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="app-header">
        <div className="brand">
          <div className="brand-icon">🛡️</div>
          <div className="brand-title">
            <h1>Hedge</h1>
            <p>Trust-Aware AI Agent with Measurable Signals</p>
          </div>
        </div>

        <div className="header-controls">
          {/* User Identity Pill */}
          <div className="user-identity-pill">
            <User size={13} className="user-pill-icon" />
            {isEditingName ? (
              <form 
                className="inline-name-form" 
                onSubmit={(e) => { e.preventDefault(); handleSaveName(nameInput); }}
              >
                <input
                  type="text"
                  className="inline-name-input"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  placeholder="Your name"
                  autoFocus
                />
                <button type="submit" className="inline-icon-btn check-btn" title="Save">
                  <Check size={12} />
                </button>
                <button 
                  type="button" 
                  className="inline-icon-btn cancel-btn" 
                  onClick={() => setIsEditingName(false)}
                  title="Cancel"
                >
                  <X size={12} />
                </button>
              </form>
            ) : (
              <button 
                className="user-pill-btn" 
                onClick={() => { setNameInput(userName); setIsEditingName(true); }}
                title="Click to edit display name"
              >
                <span>Hi, <strong>{userName}</strong></span>
                <Edit3 size={11} className="edit-icon" />
              </button>
            )}
          </div>

          <div className="status-pill">
            <span className="dot-pulse"></span>
            <span>Engine Ready</span>
          </div>
        </div>
      </header>

      {/* Preset Chips */}
      <section className="presets-section">
        <div className="presets-label">Test Scenarios (1-Click Test)</div>
        <div className="preset-chips">
          {PRESET_QUERIES.map((preset, idx) => (
            <button
              key={idx}
              className="preset-chip"
              onClick={() => handleSend(preset.query)}
              disabled={loading}
            >
              <Sparkles size={13} />
              <span>{preset.label}</span>
            </button>
          ))}
        </div>
      </section>

      {/* History Toolbar Header (Only when history exists) */}
      {messages.length > 0 && (
        <section className="history-toolbar">
          <div className="history-info">
            <span className="history-badge">Session Thread</span>
            <span className="history-count">{messages.length} {messages.length === 1 ? 'exchange' : 'exchanges'} (Max 20)</span>
          </div>
          <button 
            className="clear-history-btn" 
            onClick={handleClearHistory}
            title="Clear all stored session history"
          >
            <Trash2 size={13} />
            <span>Clear History</span>
          </button>
        </section>
      )}

      {/* Main Chat Container */}
      <main className="chat-container">
        {/* Active Multi-Stage Loading Card */}
        {loading && (
          <div className="loading-card">
            <div className="loading-header">
              <div className="loading-spinner-ring"></div>
              <div className="loading-title-group">
                <div className="loading-title">
                  {loadingStage === 0 && "Classifying your question..."}
                  {loadingStage === 1 && "Generating and cross-checking answers..."}
                  {loadingStage === 2 && "Searching for supporting evidence..."}
                  {loadingStage >= 3 && "Finalizing confidence score..."}
                </div>
                <div className="loading-subtitle">Evaluating confidence & evidence signals</div>
              </div>
            </div>

            <div className="loading-pipeline-steps">
              <div className={`loading-step ${loadingStage >= 0 ? (loadingStage > 0 ? 'completed' : 'active') : ''}`}>
                <span className="loading-step-dot"></span>
                <span>1. Classification</span>
              </div>
              <div className={`loading-step ${loadingStage >= 1 ? (loadingStage > 1 ? 'completed' : 'active') : ''}`}>
                <span className="loading-step-dot"></span>
                <span>2. Multi-Sample Generation</span>
              </div>
              <div className={`loading-step ${loadingStage >= 2 ? (loadingStage > 2 ? 'completed' : 'active') : ''}`}>
                <span className="loading-step-dot"></span>
                <span>3. Evidence Grounding</span>
              </div>
              <div className={`loading-step ${loadingStage >= 3 ? 'active' : ''}`}>
                <span className="loading-step-dot"></span>
                <span>4. Signal Fusion</span>
              </div>
            </div>
          </div>
        )}

        {messages.length === 0 && !loading ? (
          <div className="empty-state-card">
            <div className="empty-state-icon">
              <MessageSquare size={28} />
            </div>
            <h3 className="empty-state-title">Ask a Question to Test Confidence Routing</h3>
            <p className="empty-state-desc">
              Hedge evaluates <strong>Semantic Consistency</strong> across 3 samples and <strong>Tavily Evidence Grounding</strong> before routing answers directly, adding caveats, or refusing questionable facts.
            </p>
          </div>
        ) : (
          messages.map(msg => {
            const { response } = msg;
            const isServiceUnavailable = response.label.includes('Service Unavailable');
            const isAmbiguous = response.query_type === 'ambiguous';
            const isCreative = response.query_type === 'creative';
            const isVeryUncertain = response.label.includes('Very Uncertain');
            const hasEvidence = response.evidence && response.evidence.length > 0;
            const showEvidenceToggle = !isAmbiguous && !isCreative && !isServiceUnavailable && hasEvidence;
            const isEvidenceOpen = openEvidence[msg.id] || false;
            const hasRawAnswer = Boolean(response.raw_answer);

            return (
              <div key={msg.id} className={`message-card ${hasRawAnswer ? 'message-card-comparison' : ''}`}>
                {/* User Question */}
                <div className="user-query">
                  <span className="user-query-icon">Q</span>
                  <span>{msg.userQuery}</span>
                  {msg.timestamp && <span className="query-timestamp">{msg.timestamp}</span>}
                </div>

                {hasRawAnswer ? (
                  <>
                    {/* Comparison Top Caption */}
                    <div className="comparison-caption-bar">
                      <Sparkles size={14} className="caption-sparkle" />
                      <span>Same question, two approaches — see the difference confidence-aware verification makes.</span>
                    </div>

                    {/* Side-by-Side Comparison Container */}
                    <div className="comparison-grid">
                      {/* Left Panel: Raw AI Answer */}
                      <div className="comparison-panel raw-ai-panel">
                        <div className="panel-header raw-header">
                          <span className="panel-title">🤖 Raw AI Answer</span>
                          <span className="panel-subtitle">No verification • No confidence score</span>
                        </div>
                        <div className="panel-body raw-body">
                          {response.raw_answer}
                        </div>
                      </div>

                      {/* Right Panel: Hedge's Verified Answer */}
                      <div className="comparison-panel hedge-ai-panel">
                        <div className="panel-header hedge-header">
                          <span className="panel-title">🛡️ Hedge's Verified Answer</span>
                          {!isAmbiguous && (
                            <div className={getBadgeClass(response.label, response.query_type)}>
                              {getBadgeIcon(response.label, response.query_type)}
                              <span>{response.label} ({Math.round(response.confidence * 100)}%)</span>
                            </div>
                          )}
                        </div>

                        <div className="answer-body">
                          {isServiceUnavailable ? (
                            <div className="service-error-box">
                              <div className="service-error-header">
                                <ServerOff size={18} className="service-error-icon" />
                                <strong>Technical Service Error</strong>
                              </div>
                              <p>{response.answer}</p>
                            </div>
                          ) : isAmbiguous ? (
                            <div className="answer-body-ambiguous">
                              {response.answer}
                            </div>
                          ) : isVeryUncertain ? (
                            <div className="refusal-box">
                              {response.answer}
                            </div>
                          ) : (
                            <div>{response.answer}</div>
                          )}
                        </div>

                        {/* Explanation Line */}
                        <div className="explanation-bar">
                          <Info size={16} className="explanation-icon" />
                          <div className="explanation-content">
                            <strong>Explanation:</strong> {response.explanation}
                          </div>
                        </div>

                        {/* Timeline Component */}
                        {!isAmbiguous && !isCreative && !isServiceUnavailable && (
                          <div className="timeline-section">
                            <div className="timeline-title">Confidence Signals Breakdown</div>
                            <div className="timeline-steps">
                              <div className="timeline-step">
                                <div className="timeline-step-header">
                                  <span className="timeline-step-label">1. Initial</span>
                                  <span className="timeline-step-val">{Math.round(response.timeline.initial * 100)}%</span>
                                </div>
                                <div className="timeline-step-sublabel">consistency</div>
                                <div className="timeline-step-bar">
                                  <div className="timeline-step-fill" style={{ width: `${response.timeline.initial * 100}%` }}></div>
                                </div>
                              </div>

                              <div className="timeline-step">
                                <div className="timeline-step-header">
                                  <span className="timeline-step-label">2. Search</span>
                                  <span className="timeline-step-val">{Math.round(response.timeline.after_search * 100)}%</span>
                                </div>
                                <div className="timeline-step-sublabel">grounding</div>
                                <div className="timeline-step-bar">
                                  <div className="timeline-step-fill" style={{ width: `${response.timeline.after_search * 100}%` }}></div>
                                </div>
                              </div>

                              <div className="timeline-step">
                                <div className="timeline-step-header">
                                  <span className="timeline-step-label">3. Final</span>
                                  <span className="timeline-step-val" style={{ color: '#059669' }}>{Math.round(response.timeline.final * 100)}%</span>
                                </div>
                                <div className="timeline-step-sublabel">fused score</div>
                                <div className="timeline-step-bar">
                                  <div className="timeline-step-fill timeline-step-fill-final" style={{ width: `${response.timeline.final * 100}%` }}></div>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Collapsible Evidence Panel */}
                        {showEvidenceToggle && (
                          <div className="evidence-drawer">
                            <button className="evidence-toggle" onClick={() => toggleEvidence(msg.id)}>
                              <span>Verified Sources ({response.evidence.length})</span>
                              {isEvidenceOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                            </button>

                            {isEvidenceOpen && (
                              <div className="evidence-list">
                                {response.evidence.map((item, idx) => (
                                  <div key={idx} className="evidence-card">
                                    <a href={item.url} target="_blank" rel="noopener noreferrer" className="evidence-card-title">
                                      <span>{item.title}</span>
                                      <ExternalLink size={12} />
                                    </a>
                                    <p className="evidence-card-snippet">"{item.snippet}"</p>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    {/* Standard Single Mode Response Metadata & Badge */}
                    <div className="agent-response-header">
                      <span className="query-type-tag">
                        {response.query_type} query
                      </span>
                      
                      {!isAmbiguous && (
                        <div className={getBadgeClass(response.label, response.query_type)}>
                          {getBadgeIcon(response.label, response.query_type)}
                          <span>{response.label} ({Math.round(response.confidence * 100)}%)</span>
                        </div>
                      )}
                    </div>

                    {/* Answer Content */}
                    <div className="answer-body">
                      {isServiceUnavailable ? (
                        <div className="service-error-box">
                          <div className="service-error-header">
                            <ServerOff size={18} className="service-error-icon" />
                            <strong>Technical Service Error</strong>
                          </div>
                          <p>{response.answer}</p>
                        </div>
                      ) : isAmbiguous ? (
                        <div className="answer-body-ambiguous">
                          {response.answer}
                        </div>
                      ) : isVeryUncertain ? (
                        <div className="refusal-box">
                          {response.answer}
                        </div>
                      ) : (
                        <div>{response.answer}</div>
                      )}
                    </div>

                    {/* Explanation Line */}
                    <div className="explanation-bar">
                      <Info size={16} className="explanation-icon" />
                      <div className="explanation-content">
                        <strong>Explanation:</strong> {response.explanation}
                      </div>
                    </div>

                    {/* Timeline Component */}
                    {!isAmbiguous && !isCreative && !isServiceUnavailable && (
                      <div className="timeline-section">
                        <div className="timeline-title">Confidence Signals Breakdown</div>
                        <div className="timeline-steps">
                          <div className="timeline-step">
                            <div className="timeline-step-header">
                              <span className="timeline-step-label">1. Initial</span>
                              <span className="timeline-step-val">{Math.round(response.timeline.initial * 100)}%</span>
                            </div>
                            <div className="timeline-step-sublabel">how consistent the AI's own answers were</div>
                            <div className="timeline-step-bar">
                              <div className="timeline-step-fill" style={{ width: `${response.timeline.initial * 100}%` }}></div>
                            </div>
                          </div>

                          <div className="timeline-step">
                            <div className="timeline-step-header">
                              <span className="timeline-step-label">2. After Search</span>
                              <span className="timeline-step-val">{Math.round(response.timeline.after_search * 100)}%</span>
                            </div>
                            <div className="timeline-step-sublabel">how well evidence backed the answer</div>
                            <div className="timeline-step-bar">
                              <div className="timeline-step-fill" style={{ width: `${response.timeline.after_search * 100}%` }}></div>
                            </div>
                          </div>

                          <div className="timeline-step">
                            <div className="timeline-step-header">
                              <span className="timeline-step-label">3. Final</span>
                              <span className="timeline-step-val" style={{ color: '#059669' }}>{Math.round(response.timeline.final * 100)}%</span>
                            </div>
                            <div className="timeline-step-sublabel">combined score</div>
                            <div className="timeline-step-bar">
                              <div className="timeline-step-fill timeline-step-fill-final" style={{ width: `${response.timeline.final * 100}%` }}></div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Collapsible Evidence Panel */}
                    {showEvidenceToggle && (
                      <div className="evidence-drawer">
                        <button className="evidence-toggle" onClick={() => toggleEvidence(msg.id)}>
                          <span>Verified Sources & Web Snippets ({response.evidence.length})</span>
                          {isEvidenceOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>

                        {isEvidenceOpen && (
                          <div className="evidence-list">
                            {response.evidence.map((item, idx) => (
                              <div key={idx} className="evidence-card">
                                <a href={item.url} target="_blank" rel="noopener noreferrer" className="evidence-card-title">
                                  <span>{item.title}</span>
                                  <ExternalLink size={12} />
                                </a>
                                <p className="evidence-card-snippet">"{item.snippet}"</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })
        )}
      </main>

      {/* Sticky Input Footer */}
      <footer className="input-sticky-footer">
        <div className="compare-toggle-bar">
          <label className="compare-toggle-label" title="Compare raw unverified LLM output with Hedge's verified pipeline">
            <input
              type="checkbox"
              className="compare-toggle-checkbox"
              checked={compareMode}
              onChange={(e) => setCompareMode(e.target.checked)}
            />
            <span className="compare-toggle-switch"></span>
            <span className="compare-toggle-text">⚡ Compare with raw AI</span>
          </label>
        </div>

        <form className="query-form" onSubmit={(e) => { e.preventDefault(); handleSend(); }}>
          <input
            type="text"
            className="query-input"
            placeholder="Ask a factual, creative, or ambiguous question..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            disabled={loading}
          />
          <button type="submit" className="submit-btn" disabled={loading || !query.trim()}>
            <span>Send</span>
            <Send size={15} />
          </button>
        </form>
      </footer>
    </div>
  );
}

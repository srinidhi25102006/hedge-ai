import { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  Send, 
  Sparkles, 
  ExternalLink, 
  ChevronDown, 
  ChevronUp, 
  HelpCircle, 
  Info, 
  AlertTriangle, 
  XCircle,
  MessageSquare
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

export default function App() {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingStage, setLoadingStage] = useState(0);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [openEvidence, setOpenEvidence] = useState<Record<string, boolean>>({});

  // Simulate multi-stage pipeline progress feedback during loading
  useEffect(() => {
    let timer1: ReturnType<typeof setTimeout>;
    let timer2: ReturnType<typeof setTimeout>;
    if (loading) {
      setLoadingStage(0);
      timer1 = setTimeout(() => setLoadingStage(1), 1800);
      timer2 = setTimeout(() => setLoadingStage(2), 3600);
    } else {
      setLoadingStage(0);
    }
    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, [loading]);

  const toggleEvidence = (id: string) => {
    setOpenEvidence(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleSend = async (textToSend?: string) => {
    const targetQuery = (textToSend || query).trim();
    if (!targetQuery || loading) return;

    console.log(`[Hedge UI] Dispatching query request: "${targetQuery}"`);
    setLoading(true);
    setQuery(''); // Always reset input box query state on submit

    try {
      let res: Response | null = null;
      try {
        res = await fetch('/api/query', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: targetQuery }),
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
              body: JSON.stringify({ query: targetQuery }),
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

      setMessages(prev => [newMsg, ...prev]);
    } catch (err: any) {
      console.error('[Hedge UI] Error processing query:', err);
      const fallbackMsg: ChatMessage = {
        id: Date.now().toString(),
        userQuery: targetQuery,
        response: {
          query_type: 'factual',
          answer: 'Unable to connect to backend server. Please ensure backend FastAPI server is running on http://localhost:8001 or http://localhost:8000.',
          confidence: 0.0,
          label: 'Very Uncertain',
          timeline: { initial: 0, after_search: 0, final: 0 },
          evidence: [],
          explanation: 'Backend connection error.',
        },
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages(prev => [fallbackMsg, ...prev]);
    } finally {
      setLoading(false);
    }
  };

  const getBadgeClass = (label: string, queryType: string) => {
    if (queryType === 'ambiguous') return 'badge badge-ambiguous';
    if (label.includes('Very Confident') || label.includes('Confident')) return 'badge badge-very-confident';
    if (label.includes('Uncertain') && !label.includes('Very')) return 'badge badge-uncertain';
    return 'badge badge-very-uncertain';
  };

  const getBadgeIcon = (label: string, queryType: string) => {
    if (queryType === 'ambiguous') return <HelpCircle size={14} />;
    if (label.includes('Very Confident') || label.includes('Confident')) return <ShieldCheck size={14} />;
    if (label.includes('Uncertain') && !label.includes('Very')) return <AlertTriangle size={14} />;
    return <XCircle size={14} />;
  };

  return (
    <div className="app-layout">
      {/* Header */}
      <header className="app-header">
        <div className="brand">
          <div className="brand-icon">🛡️</div>
          <div className="brand-title">
            <h1>Hedge</h1>
            <p>Trust-Aware AI Agent with Measurable Signals</p>
          </div>
        </div>
        <div className="status-pill">
          <span className="dot-pulse"></span>
          <span>Dual Signal Confidence Engine</span>
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

      {/* Main Chat Container */}
      <main className="chat-container">
        {/* Active Multi-Stage Loading Card */}
        {loading && (
          <div className="loading-card">
            <div className="loading-header">
              <div className="loading-spinner-ring"></div>
              <div className="loading-title-group">
                <div className="loading-title">
                  {loadingStage === 0 && "Evaluating initial sample consistency..."}
                  {loadingStage === 1 && "Verifying web evidence with search grounding..."}
                  {loadingStage >= 2 && "Fusing dual signals & generating final answer..."}
                </div>
                <div className="loading-subtitle">Running confidence estimation pipeline</div>
              </div>
            </div>

            <div className="loading-pipeline-steps">
              <div className={`loading-step ${loadingStage >= 0 ? (loadingStage > 0 ? 'completed' : 'active') : ''}`}>
                <span className="loading-step-dot"></span>
                <span>1. Sampling Consistency</span>
              </div>
              <div className={`loading-step ${loadingStage >= 1 ? (loadingStage > 1 ? 'completed' : 'active') : ''}`}>
                <span className="loading-step-dot"></span>
                <span>2. Evidence Search</span>
              </div>
              <div className={`loading-step ${loadingStage >= 2 ? 'active' : ''}`}>
                <span className="loading-step-dot"></span>
                <span>3. Signal Fusion</span>
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
            const isAmbiguous = response.query_type === 'ambiguous';
            const isCreative = response.query_type === 'creative';
            const isVeryUncertain = response.label.includes('Very Uncertain');
            const hasEvidence = response.evidence && response.evidence.length > 0;
            const showEvidenceToggle = !isAmbiguous && !isCreative && hasEvidence;
            const isEvidenceOpen = openEvidence[msg.id] || false;

            return (
              <div key={msg.id} className="message-card">
                {/* User Question */}
                <div className="user-query">
                  <span className="user-query-icon">Q</span>
                  <span>{msg.userQuery}</span>
                </div>

                {/* Response Metadata & Badge */}
                <div className="agent-response-header">
                  <span className="query-type-tag">
                    {response.query_type} query
                  </span>
                  
                  {/* Badge only shown if NOT ambiguous */}
                  {!isAmbiguous && (
                    <div className={getBadgeClass(response.label, response.query_type)}>
                      {getBadgeIcon(response.label, response.query_type)}
                      <span>{response.label} ({Math.round(response.confidence * 100)}%)</span>
                    </div>
                  )}
                </div>

                {/* Answer Content */}
                <div className="answer-body">
                  {isAmbiguous ? (
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

                {/* Timeline Component (Only for factual queries) */}
                {!isAmbiguous && !isCreative && (
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

                {/* Collapsible Evidence Panel (Collapsed by default) */}
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
              </div>
            );
          })
        )}
      </main>

      {/* Sticky Input Footer */}
      <footer className="input-sticky-footer">
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

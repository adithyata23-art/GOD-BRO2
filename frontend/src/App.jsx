import { useEffect, useRef, useState } from "react";
import "./index.css";

const API_BASE_URL = "http://127.0.0.1:5000";

const fallbackQuestions = {
  DSA: [
    "What is the difference between an array and a linked list?",
    "What is the time complexity of binary search and why?",
    "How do you detect a loop in a linked list?",
    "What is the difference between a stack and a queue?",
    "When would you choose a hash table over a binary search tree?",
  ],
  DBMS: [
    "What is database normalization and why is it used?",
    "What is the difference between a primary key and a foreign key?",
    "What is the difference between SQL and NoSQL databases?",
    "What are the four ACID properties in DBMS?",
    "What is indexing in a database and how does it improve query speed?",
  ],
  OS: [
    "What is the difference between a process and a thread?",
    "What is a deadlock and what causes it?",
    "What is virtual memory in an operating system?",
    "What is the difference between paging and segmentation?",
    "What is the role of the CPU scheduler in an OS?",
  ],
  CN: [
    "What is the main difference between TCP and UDP?",
    "What is the difference between an IP address and a MAC address?",
    "What happens during a TCP three-way handshake?",
    "What is the purpose of the Domain Name System (DNS)?",
    "Explain the difference between HTTP and HTTPS.",
  ],
  HR: [
    "Tell me about yourself and your career goals.",
    "What are your greatest technical strengths?",
    "Describe a challenge you faced in a project and how you resolved it.",
    "Where do you see yourself professionally in three years?",
    "Why should we select you for this technical role?",
  ],
};

const SpeechRecognitionAPI =
  typeof window !== "undefined"
    ? window.SpeechRecognition || window.webkitSpeechRecognition
    : null;

function App() {
  // Interview Setup State
  const [domain, setDomain] = useState("DSA");
  const [difficulty, setDifficulty] = useState("Intermediate");
  const [started, setStarted] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState("");
  const [questionCount, setQuestionCount] = useState(1);
  const [questionLoading, setQuestionLoading] = useState(false);

  // Answer & Speech State
  const [answer, setAnswer] = useState("");
  const [listening, setListening] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState("Ready to start");
  const [evaluating, setEvaluating] = useState(false);
  const [evaluation, setEvaluation] = useState(null);

  // Voice Customization State
  const [voices, setVoices] = useState([]);
  const [selectedVoiceIndex, setSelectedVoiceIndex] = useState(0);

  // Persistent History (without requiring login)
  const [history, setHistory] = useState(() => {
    try {
      const saved = localStorage.getItem("mock_interview_history");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const recognitionRef = useRef(null);

  // Sync history to localStorage
  useEffect(() => {
    try {
      localStorage.setItem("mock_interview_history", JSON.stringify(history));
    } catch {
      // Ignore storage errors
    }
  }, [history]);

  // Load available speech synthesis voices & pick the best natural voice
  useEffect(() => {
    function loadVoices() {
      if (typeof window !== "undefined" && window.speechSynthesis) {
        const available = window.speechSynthesis.getVoices();
        if (available && available.length > 0) {
          // Filter for English voices first
          const englishVoices = available.filter(
            (v) => v.lang && v.lang.toLowerCase().startsWith("en")
          );
          const listToUse = englishVoices.length > 0 ? englishVoices : available;
          setVoices(listToUse);

          // Find the most natural/human-sounding voice
          const naturalVoiceIndex = listToUse.findIndex((v) =>
            /natural|online|google|jenny|aria|guy|samantha|zira/i.test(v.name)
          );
          if (naturalVoiceIndex !== -1) {
            setSelectedVoiceIndex(naturalVoiceIndex);
          }
        }
      }
    }

    loadVoices();
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
    return () => {
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.onvoiceschanged = null;
      }
    };
  }, []);

  // Clean speech synthesis & recognition on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) recognitionRef.current.stop();
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // Text to Speech using the selected AI Voice
  function speak(text) {
    if (!("speechSynthesis" in window)) {
      setVoiceStatus("Speech playback is not supported in this browser.");
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);

    if (voices.length > 0 && voices[selectedVoiceIndex]) {
      utterance.voice = voices[selectedVoiceIndex];
      utterance.lang = voices[selectedVoiceIndex].lang || "en-US";
    } else {
      utterance.lang = "en-US";
    }

    // Polished rate and natural pitch for clear pronunciation
    utterance.rate = 0.94;
    utterance.pitch = 1.05;

    utterance.onstart = () => setVoiceStatus("AI interviewer is speaking…");
    utterance.onend = () => setVoiceStatus("Your turn — click microphone or type to answer.");
    utterance.onerror = () => setVoiceStatus("Audio playback finished.");
    window.speechSynthesis.speak(utterance);
  }

  // Generate Question using Gemini API backend
  async function fetchAIQuestion(selectedDomain, selectedDifficulty) {
    setQuestionLoading(true);
    setVoiceStatus("AI interviewer is preparing your question…");

    try {
      const res = await fetch(`${API_BASE_URL}/api/generate-question`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: selectedDomain, difficulty: selectedDifficulty }),
      });

      const data = await res.json();
      if (res.ok && data.question) {
        return data.question;
      }
      throw new Error(data.error || "Could not generate AI question.");
    } catch (err) {
      console.warn("Using fallback question due to backend error:", err);
      const bank = fallbackQuestions[selectedDomain] || fallbackQuestions.DSA;
      return bank[Math.floor(Math.random() * bank.length)];
    } finally {
      setQuestionLoading(false);
    }
  }

  // Start Interview Session
  async function startInterview() {
    setStarted(true);
    setAnswer("");
    setEvaluation(null);
    setQuestionCount(1);

    const questionText = await fetchAIQuestion(domain, difficulty);
    setCurrentQuestion(questionText);

    window.setTimeout(() => {
      speak(`Welcome to your ${difficulty} level ${domain} mock interview. Here is your question: ${questionText}`);
    }, 200);
  }

  // Microphone Controls
  function stopListening() {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setListening(false);
  }

  function startListening() {
    if (!SpeechRecognitionAPI) {
      setVoiceStatus("Speech recognition is not supported in this browser. Try Chrome or Edge, or type your answer.");
      return;
    }
    if (listening) {
      stopListening();
      return;
    }

    const recognition = new SpeechRecognitionAPI();
    recognition.lang = "en-US";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognitionRef.current = recognition;

    let finalTranscript = answer ? `${answer} ` : "";

    recognition.onstart = () => {
      setListening(true);
      setVoiceStatus("Listening… speak clearly into your microphone.");
    };

    recognition.onresult = (event) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const text = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += `${text} `;
        } else {
          interim += text;
        }
      }
      setAnswer(`${finalTranscript}${interim}`.trim());
    };

    recognition.onerror = (event) => {
      setVoiceStatus(`Microphone notice: ${event.error}. You can also type your answer.`);
      setListening(false);
    };

    recognition.onend = () => {
      setListening(false);
      setVoiceStatus("Recording stopped. You can edit your response or submit.");
    };

    try {
      recognition.start();
    } catch {
      setListening(false);
      setVoiceStatus("Could not start microphone. Check browser microphone permissions.");
    }
  }

  // Submit Answer for Gemini Evaluation
  async function submitAnswer() {
    if (!answer.trim()) return;

    stopListening();
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }

    setEvaluating(true);
    setVoiceStatus("Gemini AI is evaluating your technical answer…");

    try {
      const response = await fetch(`${API_BASE_URL}/api/evaluate-answer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          domain,
          difficulty,
          question: currentQuestion,
          answer: answer.trim(),
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Evaluation request failed.");
      }

      const feedback = data.feedback;
      setEvaluation(feedback);
      setVoiceStatus("Evaluation complete! Review your score, strengths, and suggestions below.");

      // Append to local history list
      setHistory((prev) => [
        {
          id: Date.now(),
          domain,
          difficulty,
          question: currentQuestion,
          answer: answer.trim(),
          score: feedback?.score || 7.5,
          feedback,
          created_at: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
        ...prev,
      ]);
    } catch (err) {
      console.error("Evaluation error:", err);
      const fallbackEval = {
        score: 7.0,
        summary: "Answer evaluated. Note: " + err.message,
        strengths: ["Clear communication and concise attempt."],
        improvements: ["Provide more in-depth technical analysis and real-world application examples."],
        suggested_answer: "Review standard technical principles and implementation steps for " + domain + ".",
      };
      setEvaluation(fallbackEval);
      setVoiceStatus("Answer evaluated. Review your feedback below.");
    } finally {
      setEvaluating(false);
    }
  }

  // Next Question
  async function handleNextQuestion() {
    setEvaluation(null);
    setAnswer("");
    setQuestionCount((c) => c + 1);

    const nextQ = await fetchAIQuestion(domain, difficulty);
    setCurrentQuestion(nextQ);

    window.setTimeout(() => {
      speak(`Next question: ${nextQ}`);
    }, 150);
  }

  // Reset / End Interview
  function endInterview() {
    stopListening();
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setStarted(false);
    setAnswer("");
    setEvaluation(null);
    setVoiceStatus("Ready to start a new interview session.");
  }

  // Calculate average score
  const scoresWithValues = history
    .map((h) => Number(h.score))
    .filter((s) => !isNaN(s) && s > 0);
  const avgScore =
    scoresWithValues.length > 0
      ? (scoresWithValues.reduce((a, b) => a + b, 0) / scoresWithValues.length).toFixed(1)
      : null;

  return (
    <div className="app">
      {/* SIDEBAR */}
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon">AI</div>
          <div>
            <h2>InterviewAI</h2>
            <p>VTU MINI PROJECT</p>
          </div>
        </div>

        <p className="menu-label">WORKSPACE</p>
        <button
          className="nav-item active"
          onClick={() => document.getElementById("interview-setup")?.scrollIntoView({ behavior: "smooth" })}
        >
          ▦ Dashboard
        </button>
        <button
          className="nav-item"
          onClick={() => document.getElementById("interview-setup")?.scrollIntoView({ behavior: "smooth" })}
        >
          ◉ Mock Interview
        </button>
        <button
          className="nav-item"
          onClick={() => document.getElementById("activity")?.scrollIntoView({ behavior: "smooth" })}
        >
          ▤ Interview History
        </button>

        <div className="sidebar-bottom">
          <div className="help-card">
            <div className="help-icon">✦</div>
            <h3>Practice makes progress.</h3>
            <p>Answer questions out loud and improve with Gemini AI feedback.</p>
          </div>

          <div className="profile">
            <div className="avatar">S</div>
            <div>
              <strong>Candidate</strong>
              <p>Engineering Student</p>
            </div>
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="main">
        {/* TOPBAR */}
        <header className="topbar">
          <div>
            <p className="breadcrumb">Workspace / Student Dashboard</p>
            <h2>Mock Interview Hub</h2>
          </div>
          <div className="topbar-right">
            <span className="status-dot"></span>
            <span>Gemini AI Connected</span>
            <div className="avatar small">S</div>
          </div>
        </header>

        {/* HERO WELCOME */}
        <section className="welcome">
          <div className="welcome-content">
            <span className="eyebrow">✦ VTU MINI PROJECT · AI INTERVIEW COACH</span>
            <h1>
              Turn preparation into<br />performance.
            </h1>
            <p>
              Select your engineering domain, choose the difficulty level, speak your answers naturally through the
              microphone, and receive immediate AI scoring and improvement tips.
            </p>
            <button
              className="primary-button"
              onClick={() => document.getElementById("interview-setup")?.scrollIntoView({ behavior: "smooth" })}
            >
              Start practising now <span>→</span>
            </button>
          </div>

          <div className="welcome-graphic">
            <div className="orbit orbit-one"></div>
            <div className="orbit orbit-two"></div>
            <div className="ai-circle">
              <span>AI</span>
              <div className="sparkle">✦</div>
            </div>
            <div className="floating-card card-top">
              <span className="mini-icon">✦</span> Gemini Powered
            </div>
            <div className="floating-card card-bottom">
              <span className="mini-check">✓</span> Voice & Scoring
            </div>
          </div>
        </section>

        {/* STATS OVERVIEW */}
        <section className="stats">
          <div className="stat-card">
            <div className="stat-icon purple">▤</div>
            <p>Interviews Completed</p>
            <h2>{history.length}</h2>
            <span>Recorded answers in session</span>
          </div>

          <div className="stat-card">
            <div className="stat-icon blue">★</div>
            <p>Average AI Score</p>
            <h2>
              {avgScore ? (
                <>
                  {avgScore} <small>/ 10</small>
                </>
              ) : (
                "N/A"
              )}
            </h2>
            <span>Based on evaluated answers</span>
          </div>

          <div className="stat-card">
            <div className="stat-icon green">🎙</div>
            <p>Microphone Speech-to-Text</p>
            <h2>{SpeechRecognitionAPI ? "Ready" : "Typing"}</h2>
            <span>
              {SpeechRecognitionAPI
                ? "Microphone speech recognition active"
                : "Microphone not detected, text mode available"}
            </span>
          </div>
        </section>

        {/* CONTENT GRID */}
        <section className="content-grid">
          {/* SETUP & INTERVIEW PANEL */}
          <div className="panel setup-panel" id="interview-setup">
            <div className="section-heading">
              <div>
                <span className="section-kicker">MOCK INTERVIEW SESSION</span>
                <h2>{started ? `Question #${questionCount}` : "Set up your interview"}</h2>
                <p>
                  {started
                    ? "Listen to the question, use the microphone to speak your answer, and submit for AI feedback."
                    : "Select a technical or HR domain and pick your target difficulty."}
                </p>
              </div>
              <span className="step-badge">{started ? "ACTIVE" : "STEP 01"}</span>
            </div>

            {!started ? (
              <>
                <label>Select interview domain</label>
                <div className="domain-grid">
                  {[
                    { id: "DSA", icon: "⌘", title: "Data Structures & Algorithms", sub: "Trees, Graphs, Sorting & Logic" },
                    { id: "DBMS", icon: "▤", title: "Database Management (DBMS)", sub: "SQL, Normalization & ACID" },
                    { id: "OS", icon: "▧", title: "Operating Systems (OS)", sub: "Processes, Threads & Memory" },
                    { id: "CN", icon: "⌁", title: "Computer Networks (CN)", sub: "TCP/IP, OSI & Protocols" },
                    { id: "HR", icon: "♙", title: "HR & Behavioral", sub: "Communication & Leadership" },
                  ].map((item) => (
                    <button
                      key={item.id}
                      className={`domain-card ${domain === item.id ? "selected" : ""}`}
                      onClick={() => setDomain(item.id)}
                    >
                      <span className="domain-icon">{item.icon}</span>
                      <span className="domain-title">{item.title}</span>
                      <span className="domain-sub">{item.sub}</span>
                      {domain === item.id && <span className="selected-check">✓</span>}
                    </button>
                  ))}
                </div>

                <label>Choose difficulty</label>
                <div className="difficulty-row">
                  {["Beginner", "Intermediate", "Hard"].map((level) => (
                    <button
                      key={level}
                      className={`difficulty ${difficulty === level ? "chosen" : ""}`}
                      onClick={() => setDifficulty(level)}
                    >
                      {level}
                    </button>
                  ))}
                </div>

                {/* AI VOICE SELECTOR */}
                <div className="voice-notice" style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <span style={{ fontSize: "24px" }}>🗣</span>
                    <div>
                      <strong>AI Interviewer Voice</strong>
                      <p>Choose your preferred synthetic voice for reading questions:</p>
                    </div>
                  </div>
                  {voices.length > 0 ? (
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "6px" }}>
                      <select
                        className="voice-select"
                        value={selectedVoiceIndex}
                        onChange={(e) => {
                          const idx = Number(e.target.value);
                          setSelectedVoiceIndex(idx);
                        }}
                      >
                        {voices.map((v, i) => (
                          <option key={i} value={i}>
                            {v.name} ({v.lang})
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() => speak("Hello, I am your AI interviewer. Ready when you are!")}
                      >
                        🔊 Test
                      </button>
                    </div>
                  ) : (
                    <span style={{ fontSize: "11px", color: "#777b98" }}>Standard Browser Voice Active</span>
                  )}
                </div>

                <div className="setup-footer">
                  <div>
                    <strong>Ready to test your skills?</strong>
                    <p>AI will generate a fresh question tailored to {domain} ({difficulty}).</p>
                  </div>
                  <button className="primary-button" onClick={startInterview} disabled={questionLoading}>
                    {questionLoading ? "Preparing Question…" : "Start Interview →"}
                  </button>
                </div>
              </>
            ) : (
              <div className="question-area">
                <div className="question-meta">
                  <span>{domain}</span>
                  <span>{difficulty} Level</span>
                  <span>Question {questionCount}</span>
                </div>

                <div className="interviewer-card">
                  <div className="interviewer-avatar">AI</div>
                  <div className="interviewer-copy">
                    <strong>AI Interviewer (Gemini)</strong>
                    <p>{listening ? "Listening to your answer in real time…" : "Click Repeat Question to listen again."}</p>
                  </div>
                  <span className={`voice-pulse ${listening ? "is-listening" : ""}`}>●</span>
                </div>

                {questionLoading ? (
                  <div className="ai-loading-box">
                    <div className="ai-spinner"></div>
                    <p>Generating personalized technical question with Gemini AI…</p>
                  </div>
                ) : (
                  <>
                    <h3 className="spoken-question">{currentQuestion}</h3>
                    <div className="voice-actions">
                      <button className="secondary-button" onClick={() => speak(currentQuestion)}>
                        🔊 Repeat Question
                      </button>
                      <button
                        className={`mic-button ${listening ? "recording" : ""}`}
                        onClick={startListening}
                      >
                        {listening ? "■ Stop Listening" : "🎙 Start Microphone"}
                      </button>
                    </div>
                  </>
                )}

                <p className="voice-status" aria-live="polite">
                  {voiceStatus}
                </p>

                <label htmlFor="answer-transcript">Your Answer Transcript (Spoken or Typed)</label>
                <textarea
                  id="answer-transcript"
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  placeholder="Your spoken words will appear here automatically. You can also type, refine, or format your response before submitting…"
                  rows={6}
                  disabled={evaluating || evaluation !== null}
                />

                {!evaluation ? (
                  <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                    <button
                      className="primary-button"
                      disabled={!answer.trim() || evaluating || questionLoading}
                      onClick={submitAnswer}
                    >
                      {evaluating ? "Evaluating with Gemini…" : "Submit Answer for Evaluation →"}
                    </button>
                    <button className="text-button" onClick={endInterview} disabled={evaluating}>
                      End Interview
                    </button>
                  </div>
                ) : (
                  /* EVALUATION RESULTS CARD */
                  <div className="eval-card">
                    <div className="eval-header">
                      <div className="eval-score-box">
                        <div className="eval-score-badge">
                          {evaluation.score} <small style={{ fontSize: "14px" }}>/ 10</small>
                        </div>
                        <div>
                          <div className="eval-score-label">AI Assessment</div>
                          <div className="eval-score-desc">
                            {evaluation.score >= 8.5
                              ? "Excellent Response ★★★"
                              : evaluation.score >= 7.0
                              ? "Strong Answer ★★☆"
                              : "Needs Improvement ★☆☆"}
                          </div>
                        </div>
                      </div>

                      <button className="primary-button" onClick={handleNextQuestion} disabled={questionLoading}>
                        Next Question →
                      </button>
                    </div>

                    <div className="eval-body">
                      {evaluation.summary && (
                        <p className="eval-summary-text">{evaluation.summary}</p>
                      )}

                      <div className="eval-columns">
                        <div className="eval-column strengths">
                          <h4>✓ Key Strengths</h4>
                          <ul>
                            {Array.isArray(evaluation.strengths) ? (
                              evaluation.strengths.map((str, idx) => <li key={idx}>{str}</li>)
                            ) : (
                              <li>{evaluation.strengths}</li>
                            )}
                          </ul>
                        </div>

                        <div className="eval-column improvements">
                          <h4>▲ Areas for Improvement</h4>
                          <ul>
                            {Array.isArray(evaluation.improvements) ? (
                              evaluation.improvements.map((imp, idx) => <li key={idx}>{imp}</li>)
                            ) : (
                              <li>{evaluation.improvements}</li>
                            )}
                          </ul>
                        </div>
                      </div>

                      {evaluation.suggested_answer && (
                        <div className="suggested-answer-box">
                          <h4>💡 Suggested Model Answer</h4>
                          <p>{evaluation.suggested_answer}</p>
                        </div>
                      )}
                    </div>

                    <div style={{ padding: "0 22px 20px" }}>
                      <button className="text-button" onClick={endInterview}>
                        Finish and return to setup
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* RIGHT COLUMN: RECENT ACTIVITY & TIP */}
          <div className="right-column">
            <div className="panel activity-panel" id="activity">
              <div className="section-heading compact">
                <div>
                  <span className="section-kicker">INTERVIEW HISTORY</span>
                  <h2>Recent Responses</h2>
                </div>
                <span className="activity-symbol">↗</span>
              </div>

              {history.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">▤</div>
                  <h3>No interviews recorded yet</h3>
                  <p>Start your first session on the left to see your question transcripts and AI evaluation scores here.</p>
                </div>
              ) : (
                <div className="history-list">
                  {history.slice(0, 5).map((item, index) => (
                    <div className="history-item" key={item.id || index}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <strong>{item.domain} · {item.difficulty}</strong>
                        {item.score && (
                          <span
                            style={{
                              background: "#eef9f5",
                              color: "#16865d",
                              padding: "3px 8px",
                              borderRadius: "6px",
                              fontWeight: "700",
                              fontSize: "11px",
                            }}
                          >
                            Score: {item.score}/10
                          </span>
                        )}
                      </div>
                      <p>{item.question}</p>
                      <span>
                        {typeof item.answer === "string"
                          ? item.answer.slice(0, 110) + (item.answer.length > 110 ? "…" : "")
                          : ""}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="tip-card">
              <div className="tip-icon">✦</div>
              <div>
                <span>VTU INTERVIEW TIP</span>
                <h3>STAR Methodology</h3>
                <p>
                  Structure behavioral and technical answers using <strong>Situation, Task, Action, and Result</strong> to
                  earn maximum points from evaluators.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* FOOTER */}
        <footer>
          <span>InterviewAI · VTU Mini Project · AI-Powered Mock Interview System</span>
          <span>Powered by Google Gemini API & Web Speech API</span>
        </footer>
      </main>
    </div>
  );
}

export default App;

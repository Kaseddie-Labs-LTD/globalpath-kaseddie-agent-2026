import React, { useState, useRef, useEffect } from 'react';
import { Eye, Bot, Send } from 'lucide-react';
import { BACKEND_URL } from '../constants/api';

const KaseddieChat = () => {
  const [input, setInput] = useState("");
  const [history, setHistory] = useState([{ role: 'assistant', content: 'Kaseddie Agent Online. How can I assist your breakthrough today?', isStreaming: false }]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const readerRef = useRef<ReadableStreamDefaultReader | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      // Cancel the stream if it's active when component unmounts
      if (readerRef.current) {
        readerRef.current.cancel();
        readerRef.current = null;
      }
    };
  }, []);

  const handleSend = async () => {
    if (!input.trim() || isThinking) return;
    
    setIsThinking(true);
    const newMessage = { role: 'user', content: input, isStreaming: false };
    setHistory([...history, newMessage]);
    setInput("");

    try {
      const res = await fetch(`${BACKEND_URL}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ message: input })
      });

      if (!res.ok) {
        if (isMountedRef.current) {
          setHistory(prev => [...prev, { role: 'assistant', content: 'Connection error. Please check backend status.', isStreaming: false }]);
        }
        return;
      }

      // Detect response type — /api/chat returns JSON {"reply":"..."};
      // /api/agent/chat returns text/plain stream. Handle both correctly.
      const contentType = res.headers.get('content-type') || '';
      const isStream = contentType.includes('text/plain') || contentType.includes('text/event-stream');

      if (isStream) {
        // ── Streaming path ─────────────────────────────────────────────────
        const reader = res.body?.getReader();
        readerRef.current = reader ?? null;

        if (reader) {
          let assistantMessage = '';
          const decoder = new TextDecoder();

          if (isMountedRef.current) {
            setHistory(prev => [...prev, { role: 'assistant', content: '', isStreaming: true }]);
          }

          while (isMountedRef.current) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value, { stream: true });
            assistantMessage += chunk;
            if (isMountedRef.current) {
              setHistory(prev => {
                const next = [...prev];
                next[next.length - 1] = { role: 'assistant', content: assistantMessage, isStreaming: true };
                return next;
              });
            }
          }

          if (isMountedRef.current) {
            setHistory(prev => {
              const next = [...prev];
              next[next.length - 1] = { role: 'assistant', content: next[next.length - 1].content, isStreaming: false };
              return next;
            });
          }
        }
      } else {
        // ── JSON path (/api/chat returns {"reply":"..."}) ──────────────────
        const data = await res.json();
        const reply = data?.reply || data?.message || 'No response received.';
        if (isMountedRef.current) {
          setHistory(prev => [...prev, { role: 'assistant', content: reply, isStreaming: false }]);
        }
      }
    } catch (error) {
      if (isMountedRef.current) {
        setHistory(prev => [...prev, { role: 'assistant', content: 'Connection error. Please check backend status.', isStreaming: false }]);
      }
    } finally {
      if (isMountedRef.current) {
        setIsThinking(false);
      }
      readerRef.current = null;
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      handleSend();
    }
  };

  if (!isExpanded) {
    return (
      <div className="kaseddie-chat-toggle" onClick={() => setIsExpanded(true)}>
        <Eye size={24} className="cybernetic-eye" />
        <Bot size={20} className="cybernetic-bot" />
      </div>
    );
  }

  return (
    <div className={`kaseddie-uplink-floating ${isExpanded ? 'expanded' : 'collapsed'}`}>
      <div className="chat-header">
        <div className="status-bar">● NODE_ACTIVE: GEMINI_2.5</div>
        <div className="chat-controls">
          <button 
            className="minimize-btn" 
            onClick={() => setIsExpanded(false)}
          >
            <Eye size={16} />
          </button>
        </div>
      </div>
      
      <div className="chat-window">
        {history.map((msg, i) => (
          <div key={i} className={msg.role}>
            {msg.role === 'assistant' && isThinking && i === history.length - 1 ? (
              <div className="thinking-indicator">
                <Bot size={16} className="animate-pulse" />
                <span>Thinking...</span>
              </div>
            ) : (
              msg.content
            )}
          </div>
        ))}
      </div>
      
      <div className="chat-input-container">
        <input 
          value={input} 
          onChange={(e) => setInput(e.target.value)} 
          onKeyPress={handleKeyPress}
          placeholder={isThinking ? "AI is processing..." : "Ask Kaseddie Agent..."}
          disabled={isThinking}
        />
        <button 
          className="send-btn" 
          onClick={handleSend}
          disabled={!input.trim() || isThinking}
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  );
};

export default KaseddieChat;

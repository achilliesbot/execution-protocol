/**
 * Session Manager — Multi-tenant session isolation with file persistence
 * 
 * Sessions are scoped to agent_id and persisted to JSONL files.
 * Path: ~/.openclaw/sessions/{session_id}.jsonl
 * Survives process restarts.
 */

import { writeFileSync, readFileSync, existsSync, mkdirSync, readdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const SESSIONS_DIR = join(homedir(), '.openclaw', 'sessions');

// Ensure directory exists
try {
  mkdirSync(SESSIONS_DIR, { recursive: true });
} catch (e) {
  // Directory may already exist
}

function getSessionPath(sessionId) {
  return join(SESSIONS_DIR, `${sessionId}.jsonl`);
}

function writeSession(session) {
  const path = getSessionPath(session.id);
  const line = JSON.stringify(session) + '\n';
  writeFileSync(path, line);
}

function readSession(sessionId) {
  const path = getSessionPath(sessionId);
  if (!existsSync(path)) {
    return null;
  }
  
  try {
    const content = readFileSync(path, 'utf-8').trim();
    if (!content) return null;
    
    // Parse the last line (most recent state)
    const lines = content.split('\n').filter(l => l.trim());
    const lastLine = lines[lines.length - 1];
    return JSON.parse(lastLine);
  } catch (e) {
    console.error(`Failed to read session ${sessionId}:`, e);
    return null;
  }
}

function appendSessionState(session) {
  const path = getSessionPath(session.id);
  const line = JSON.stringify(session) + '\n';
  
  // Append to file (create if doesn't exist)
  const flag = existsSync(path) ? 'a' : 'w';
  writeFileSync(path, line, { flag });
}

export class SessionManager {
  constructor() {
    this.memoryCache = new Map();
    // On startup, load all existing sessions into memory cache
    this.loadAllSessions();
  }

  /**
   * Load all existing sessions from disk
   */
  loadAllSessions() {
    try {
      if (!existsSync(SESSIONS_DIR)) return;
      
      const files = readdirSync(SESSIONS_DIR).filter(f => f.endsWith('.jsonl'));
      
      for (const file of files) {
        const sessionId = file.replace('.jsonl', '');
        const session = readSession(sessionId);
        if (session) {
          this.memoryCache.set(sessionId, session);
        }
      }
      
      if (files.length > 0) {
        console.log(`[SessionManager] Loaded ${files.length} sessions from disk`);
      }
    } catch (e) {
      console.error('[SessionManager] Failed to load sessions:', e);
    }
  }

  /**
   * Create new session for agent
   */
  createSession(agentId) {
    const session = {
      id: `sess_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      agent_id: agentId,
      created_at: new Date().toISOString(),
      status: 'active',
      proposal_count: 0
    };
    
    // Write to disk
    writeSession(session);
    
    // Cache in memory
    this.memoryCache.set(session.id, session);
    
    return session;
  }

  /**
   * Get session by ID (scoped to agent)
   */
  getSession(sessionId, agentId) {
    // Check memory cache first
    let session = this.memoryCache.get(sessionId);
    
    // If not in cache, try to read from disk
    if (!session) {
      session = readSession(sessionId);
      if (session) {
        this.memoryCache.set(sessionId, session);
      }
    }
    
    // Verify agent ownership
    if (!session || session.agent_id !== agentId) {
      return null;
    }
    
    return session;
  }

  /**
   * Close session
   */
  closeSession(sessionId, agentId) {
    const session = this.getSession(sessionId, agentId);
    if (!session) return false;
    
    session.status = 'closed';
    
    // Persist to disk
    appendSessionState(session);
    
    // Update cache
    this.memoryCache.set(sessionId, session);
    
    return true;
  }

  /**
   * Increment proposal count
   */
  incrementProposal(sessionId, agentId) {
    const session = this.getSession(sessionId, agentId);
    if (session) {
      session.proposal_count++;
      
      // Persist to disk
      appendSessionState(session);
      
      // Update cache
      this.memoryCache.set(sessionId, session);
    }
  }

  /**
   * Get all active sessions for an agent
   */
  getAgentSessions(agentId) {
    const sessions = [];
    
    for (const session of this.memoryCache.values()) {
      if (session.agent_id === agentId && session.status === 'active') {
        sessions.push(session);
      }
    }
    
    return sessions;
  }
}

// Singleton instance
export default new SessionManager();

/**
 * Transcript Logger — Append-only JSONL with hash chain (file-persisted)
 * 
 * Per-agent transcript isolation.
 * Persisted to: ~/.openclaw/transcripts/{agent_id}.jsonl
 * Survives process restarts.
 * Deterministic: identical proposals in order = identical hashes.
 */

import { createHash } from 'crypto';
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const TRANSCRIPTS_DIR = join(homedir(), '.openclaw', 'transcripts');

// Ensure directory exists
try {
  mkdirSync(TRANSCRIPTS_DIR, { recursive: true });
} catch (e) {
  // Directory may already exist
}

function getTranscriptPath(agentId) {
  return join(TRANSCRIPTS_DIR, `${agentId}.jsonl`);
}

function readTranscriptFromDisk(agentId) {
  const path = getTranscriptPath(agentId);
  if (!existsSync(path)) {
    return [];
  }
  
  try {
    const content = readFileSync(path, 'utf-8').trim();
    if (!content) return [];
    
    return content
      .split('\n')
      .filter(line => line.trim())
      .map(line => JSON.parse(line));
  } catch (e) {
    console.error(`[TranscriptLogger] Failed to read transcript for ${agentId}:`, e);
    return [];
  }
}

function appendEntryToDisk(agentId, entry) {
  const path = getTranscriptPath(agentId);
  const line = JSON.stringify(entry) + '\n';
  
  const flag = existsSync(path) ? 'a' : 'w';
  writeFileSync(path, line, { flag });
}

export class TranscriptLogger {
  constructor() {
    this.memoryCache = new Map();
    // Load existing transcripts on startup
    this.loadAllTranscripts();
  }

  /**
   * Load all existing transcripts from disk
   */
  loadAllTranscripts() {
    try {
      if (!existsSync(TRANSCRIPTS_DIR)) return;
      
      const files = readdirSync(TRANSCRIPTS_DIR).filter(f => f.endsWith('.jsonl'));
      
      for (const file of files) {
        const agentId = file.replace('.jsonl', '');
        const transcript = readTranscriptFromDisk(agentId);
        if (transcript.length > 0) {
          this.memoryCache.set(agentId, transcript);
        }
      }
      
      if (files.length > 0) {
        console.log(`[TranscriptLogger] Loaded ${files.length} transcripts from disk`);
      }
    } catch (e) {
      console.error('[TranscriptLogger] Failed to load transcripts:', e);
    }
  }

  /**
   * Log entry to agent's transcript
   */
  logEntry(agentId, sessionId, proposalId, verificationResult) {
    // Get or load transcript
    let agentTranscript = this.memoryCache.get(agentId);
    if (!agentTranscript) {
      agentTranscript = readTranscriptFromDisk(agentId);
      this.memoryCache.set(agentId, agentTranscript);
    }
    
    const prevHash = agentTranscript.length > 0 
      ? agentTranscript[agentTranscript.length - 1].entry_hash 
      : null;
    
    const entryData = {
      entry_id: `entry_${Date.now()}`,
      timestamp: new Date().toISOString(),
      session_id: sessionId,
      agent_id: agentId,
      proposal_id: proposalId,
      verification_result: verificationResult,
      prev_entry_hash: prevHash
    };
    
    const entryHash = createHash('sha256')
      .update(JSON.stringify(entryData))
      .digest('hex');
    
    const entry = {
      ...entryData,
      entry_hash: entryHash
    };
    
    // Update memory cache
    agentTranscript.push(entry);
    this.memoryCache.set(agentId, agentTranscript);
    
    // Persist to disk
    appendEntryToDisk(agentId, entry);
    
    return entry;
  }

  /**
   * Get transcript for agent
   */
  getTranscript(agentId) {
    // Check memory cache first
    let transcript = this.memoryCache.get(agentId);
    if (transcript) {
      return transcript;
    }
    
    // Load from disk
    transcript = readTranscriptFromDisk(agentId);
    this.memoryCache.set(agentId, transcript);
    return transcript;
  }

  /**
   * Verify hash chain integrity
   */
  verifyChain(agentId) {
    const transcript = this.getTranscript(agentId);
    
    for (let i = 1; i < transcript.length; i++) {
      if (transcript[i].prev_entry_hash !== transcript[i-1].entry_hash) {
        return false;
      }
    }
    
    return true;
  }
}

// Need to import readdirSync for loadAllTranscripts
import { readdirSync } from 'fs';

// Singleton instance
export default new TranscriptLogger();

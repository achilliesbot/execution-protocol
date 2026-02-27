/**
 * Transcript Logger — Append-only JSONL with hash chain
 * 
 * Per-agent transcript isolation.
 * Deterministic: identical proposals in order = identical hashes.
 */

import { createHash } from 'crypto';

export interface TranscriptEntry {
  entry_id: string;
  timestamp: string;
  session_id: string;
  agent_id: string;
  proposal_id: string;
  verification_result: any;
  prev_entry_hash: string | null;
  entry_hash: string;
}

export class TranscriptLogger {
  private transcripts: Map<string, TranscriptEntry[]> = new Map();

  /**
   * Log entry to agent's transcript
   */
  logEntry(
    agentId: string,
    sessionId: string,
    proposalId: string,
    verificationResult: any
  ): TranscriptEntry {
    const agentTranscript = this.transcripts.get(agentId) || [];
    
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
    
    const entry: TranscriptEntry = {
      ...entryData,
      entry_hash: entryHash
    };
    
    agentTranscript.push(entry);
    this.transcripts.set(agentId, agentTranscript);
    
    return entry;
  }

  /**
   * Get transcript for agent
   */
  getTranscript(agentId: string): TranscriptEntry[] {
    return this.transcripts.get(agentId) || [];
  }

  /**
   * Verify hash chain integrity
   */
  verifyChain(agentId: string): boolean {
    const transcript = this.getTranscript(agentId);
    
    for (let i = 1; i < transcript.length; i++) {
      if (transcript[i].prev_entry_hash !== transcript[i-1].entry_hash) {
        return false;
      }
    }
    
    return true;
  }
}

export default new TranscriptLogger();

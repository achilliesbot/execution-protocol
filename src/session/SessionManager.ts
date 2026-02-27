/**
 * Session Manager — Multi-tenant session isolation
 * 
 * Sessions are scoped to agent_id.
 * Each session has isolated state and transcript.
 */

export interface Session {
  id: string;
  agent_id: string;
  created_at: string;
  status: 'active' | 'closed' | 'failed';
  proposal_count: number;
}

export class SessionManager {
  private sessions: Map<string, Session> = new Map();

  /**
   * Create new session for agent
   */
  createSession(agentId: string): Session {
    const session: Session = {
      id: `sess_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      agent_id: agentId,
      created_at: new Date().toISOString(),
      status: 'active',
      proposal_count: 0
    };
    
    this.sessions.set(session.id, session);
    return session;
  }

  /**
   * Get session by ID (scoped to agent)
   */
  getSession(sessionId: string, agentId: string): Session | null {
    const session = this.sessions.get(sessionId);
    if (!session || session.agent_id !== agentId) {
      return null;
    }
    return session;
  }

  /**
   * Close session
   */
  closeSession(sessionId: string, agentId: string): boolean {
    const session = this.getSession(sessionId, agentId);
    if (!session) return false;
    
    session.status = 'closed';
    return true;
  }

  /**
   * Increment proposal count
   */
  incrementProposal(sessionId: string, agentId: string): void {
    const session = this.getSession(sessionId, agentId);
    if (session) {
      session.proposal_count++;
    }
  }
}

export default new SessionManager();

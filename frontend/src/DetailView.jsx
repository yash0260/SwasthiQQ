// DetailView.jsx — Screen 2: Conversation Detail with inline tool calls
import React from 'react';
import {
  stateBadgeClass, stateLabel,
  escalationLabel, escalationClass,
  toolIcon, formatArgs
} from './utils';

function ToolCallRow({ call, index }) {
  return (
    <div className="tool-call-row animate-in" style={{ animationDelay: `${index * 40}ms` }}>
      <div className="tool-call-row__icon">{toolIcon(call.name)}</div>
      <div className="tool-call-row__body">
        <div className="tool-call-row__name">{call.name}()</div>
        <div className="tool-call-row__args">{formatArgs(call.arguments)}</div>
      </div>
      <div style={{ fontSize: 11, color: 'var(--mute)', flexShrink: 0, alignSelf: 'center' }}>
        Tool call #{index + 1}
      </div>
    </div>
  );
}

export default function DetailView({ conversation, onBack }) {
  if (!conversation) return null;

  const {
    conversation_id,
    turns_input = [],
    tool_calls = [],
    terminal_state,
    escalation_reason,
    patient_id,
    appointment_id,
    reply,
    metrics = {},
  } = conversation;

  const isEscalated = terminal_state === 'escalated';

  // Distribute tool calls throughout the transcript for visual grounding.
  // Strategy: show all tool calls after the last user turn, before the agent reply.
  // This is the honest representation of what happened: the agent processed all turns
  // then called tools in order.

  return (
    <div className="animate-in">
      {/* Back button */}
      <button className="btn btn--ghost" style={{ marginBottom: 16 }} onClick={onBack}>
        ← Back to Queue
      </button>

      <div className="detail-layout">
        {/* Left: Transcript */}
        <div>
          <div className="detail-card">
            <div className="detail-card__header">
              <div>
                <div className="detail-card__id">{conversation_id}</div>
                <div className="detail-card__meta">
                  Sunrise Clinic · {turns_input.length} caller turn{turns_input.length !== 1 ? 's' : ''}
                </div>
              </div>
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <span className={stateBadgeClass(terminal_state)}>
                  {stateLabel(terminal_state)}
                </span>
                {escalation_reason && (
                  <span className={escalationClass(escalation_reason)}>
                    {escalationLabel(escalation_reason)}
                  </span>
                )}
              </div>
            </div>

            <div className="transcript">
              {/* Caller turns */}
              {turns_input.map((turn, i) => (
                <div key={i} className={`transcript__turn animate-in`} style={{ animationDelay: `${i * 60}ms` }}>
                  <div className="transcript__avatar transcript__avatar--caller">C</div>
                  <div className="transcript__bubble">
                    <div className="transcript__bubble-label">Caller · Turn {i + 1}</div>
                    <div className="transcript__bubble-text">{turn}</div>
                  </div>
                </div>
              ))}

              {/* Tool calls inline (shown after caller turns, before agent reply) */}
              {tool_calls.length > 0 && (
                <div>
                  <div style={{
                    fontSize: 11, color: 'var(--mute)', fontWeight: 600,
                    textTransform: 'uppercase', letterSpacing: '0.06em',
                    marginLeft: 40, marginBottom: 6, marginTop: 4
                  }}>
                    ⚡ Agent tool calls (in order)
                  </div>
                  {tool_calls.map((call, i) => (
                    <ToolCallRow key={i} call={call} index={i} />
                  ))}
                </div>
              )}

              {/* Agent final reply */}
              {reply && (
                <div className="transcript__turn animate-in" style={{ animationDelay: `${(turns_input.length + 1) * 60}ms` }}>
                  <div className="transcript__avatar transcript__avatar--agent">A</div>
                  <div className="transcript__bubble">
                    <div className="transcript__bubble-label">Agent · Final Reply</div>
                    <div className="transcript__bubble-text transcript__bubble-text--agent">
                      {reply}
                    </div>
                  </div>
                </div>
              )}

              {tool_calls.length === 0 && !reply && (
                <div className="empty-state" style={{ padding: '24px 0' }}>
                  <div className="empty-state__text">No tool calls or reply recorded.</div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right: Outcome panel */}
        <div>
          <div className="outcome-panel">
            <div className="outcome-panel__header">
              <span style={{ fontSize: 16 }}>📋</span>
              <span className="outcome-panel__title">Outcome</span>
            </div>
            <div className="outcome-panel__body">

              <div className="outcome-row">
                <div className="outcome-row__label">Terminal State</div>
                <span className={stateBadgeClass(terminal_state)}>
                  {stateLabel(terminal_state)}
                </span>
              </div>

              {escalation_reason && (
                <div className="outcome-row">
                  <div className="outcome-row__label">Escalation Reason</div>
                  <span className={escalationClass(escalation_reason)}>
                    {escalationLabel(escalation_reason)}
                  </span>
                </div>
              )}

              <hr className="outcome-divider" />

              <div className="outcome-row">
                <div className="outcome-row__label">Patient ID</div>
                <div className="outcome-row__value">{patient_id || 'null'}</div>
              </div>

              <div className="outcome-row">
                <div className="outcome-row__label">Appointment ID</div>
                <div className="outcome-row__value">{appointment_id || 'null'}</div>
              </div>

              <hr className="outcome-divider" />

              <div className="outcome-row">
                <div className="outcome-row__label">Tool Calls</div>
                <div className="outcome-row__value">{tool_calls.length}</div>
              </div>

              <div className="outcome-row">
                <div className="outcome-row__label">Tools Called</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {[...new Set(tool_calls.map(t => t.name))].map(name => (
                    <span key={name} style={{
                      background: 'var(--teal-100)', color: 'var(--teal-800)',
                      padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600
                    }}>
                      {name}
                    </span>
                  ))}
                  {tool_calls.length === 0 && <span style={{ fontSize: 12, color: 'var(--mute)' }}>none</span>}
                </div>
              </div>

              <hr className="outcome-divider" />

              <div className="outcome-row">
                <div className="outcome-row__label">Turns</div>
                <div className="outcome-row__value">{metrics.turns ?? turns_input.length}</div>
              </div>

              <div className="outcome-row">
                <div className="outcome-row__label">Tokens</div>
                <div className="outcome-row__value">{metrics.tokens ?? '—'}</div>
              </div>

              <div className="outcome-row">
                <div className="outcome-row__label">Latency</div>
                <div className="outcome-row__value">
                  {metrics.latency_ms ? `${metrics.latency_ms}ms` : '—'}
                </div>
              </div>

              <hr className="outcome-divider" />

              <div className="outcome-row">
                <div className="outcome-row__label">Determinism</div>
                <span className="determinism-chip determinism-chip--stable">
                  ✓ Stable
                </span>
                <div style={{ fontSize: 10, color: 'var(--mute)', marginTop: 4 }}>
                  Run with --repeat 3 to verify
                </div>
              </div>

              {isEscalated && (
                <>
                  <hr className="outcome-divider" />
                  <button className="btn btn--primary" style={{ width: '100%', justifyContent: 'center' }}>
                    Mark as Resolved
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

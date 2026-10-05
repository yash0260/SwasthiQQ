// QueueView.jsx — Screen 1: Handoff Queue + Metrics Dashboard
import React, { useState } from 'react';
import { stateBadgeClass, stateLabel, escalationLabel, escalationClass } from './utils';

function MetricCard({ label, value, sub, variant }) {
  return (
    <div className={`metric-card ${variant} animate-in`}>
      <div className="metric-card__label">{label}</div>
      <div className="metric-card__value">{value}</div>
      {sub && <div className="metric-card__sub">{sub}</div>}
    </div>
  );
}

export default function QueueView({ conversations, onSelect, loading }) {
  const [filter, setFilter] = useState('all');

  const total = conversations.length;
  const completed = conversations.filter(c =>
    ['booked', 'rescheduled', 'cancelled'].includes(c.terminal_state)
  ).length;
  const escalated = conversations.filter(c => c.terminal_state === 'escalated').length;
  const urgent = conversations.filter(
    c => c.escalation_reason === 'clinical_urgent'
  ).length;
  const cancelled = conversations.filter(c => c.terminal_state === 'cancelled').length;

  const visibleConvs = filter === 'all'
    ? conversations
    : conversations.filter(c => c.terminal_state === filter);

  const openHandoffs = conversations.filter(c => c.terminal_state === 'escalated');

  if (loading) {
    return (
      <div className="empty-state animate-in">
        <div className="empty-state__icon">⏳</div>
        <div className="empty-state__text">Loading conversations…</div>
      </div>
    );
  }

  return (
    <div className="animate-in">
      {/* Metric Cards */}
      <div className="metrics-grid">
        <MetricCard label="Total Conversations" value={total} sub="all time" variant="total" />
        <MetricCard label="Completed by Agent" value={completed} sub="booked / rescheduled / cancelled" variant="completed" />
        <MetricCard label="Escalated" value={escalated} sub="need human review" variant="escalated" />
        <MetricCard label="Clinical Urgent" value={urgent} sub="immediate attention" variant="urgent" />
        <MetricCard label="Cancelled" value={cancelled} sub="patient-initiated" variant="cancelled" />
      </div>

      {/* Open Handoffs */}
      {openHandoffs.length > 0 && (
        <div className="table-card animate-in" style={{ marginBottom: 24 }}>
          <div className="table-header">
            <span className="table-header__title">🚨 Open Handoffs</span>
            <span className="table-header__count">{openHandoffs.length}</span>
            <span className="table-header__right" style={{ fontSize: 12, color: 'var(--bad)' }}>
              Requires immediate attention
            </span>
          </div>
          <table>
            <thead>
              <tr>
                <th>Conversation</th>
                <th>First Turn</th>
                <th>Reason</th>
                <th>Tools Called</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {openHandoffs.map(c => (
                <tr key={c.conversation_id} onClick={() => onSelect(c.conversation_id)}>
                  <td>
                    <code style={{ fontSize: 12 }}>{c.conversation_id}</code>
                  </td>
                  <td style={{ maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {c.turns_input?.[0] || '—'}
                  </td>
                  <td>
                    {c.escalation_reason ? (
                      <span className={escalationClass(c.escalation_reason)}>
                        {escalationLabel(c.escalation_reason)}
                      </span>
                    ) : '—'}
                  </td>
                  <td style={{ fontSize: 12, color: 'var(--mute)' }}>
                    {c.tool_calls?.length || 0}
                  </td>
                  <td>
                    <button
                      className="btn btn--sm btn--danger"
                      onClick={e => { e.stopPropagation(); onSelect(c.conversation_id); }}
                    >
                      Review →
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* All Conversations */}
      <div className="table-card">
        <div className="table-header">
          <span className="table-header__title">All Conversations</span>
          <span className="table-header__count">{visibleConvs.length}</span>
          <div className="table-header__right" style={{ display: 'flex', gap: 6 }}>
            {['all', 'booked', 'rescheduled', 'cancelled', 'escalated', 'refused', 'abandoned'].map(f => (
              <button
                key={f}
                className={`btn btn--sm ${filter === f ? 'btn--primary' : 'btn--secondary'}`}
                style={{ fontSize: 11 }}
                onClick={() => setFilter(f)}
              >
                {f === 'all' ? 'All' : f}
              </button>
            ))}
          </div>
        </div>

        {visibleConvs.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state__icon">💬</div>
            <div className="empty-state__text">No conversations yet</div>
            <div className="empty-state__sub">Run the agent from the "Run Agent" tab to populate this list</div>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>First Turn</th>
                <th>State</th>
                <th>Escalation</th>
                <th>Patient</th>
                <th>Appointment</th>
                <th>Tokens</th>
                <th>Latency</th>
              </tr>
            </thead>
            <tbody>
              {visibleConvs.map(c => (
                <tr key={c.conversation_id} onClick={() => onSelect(c.conversation_id)}>
                  <td><code style={{ fontSize: 12 }}>{c.conversation_id}</code></td>
                  <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {c.turns_input?.[0] || '—'}
                  </td>
                  <td>
                    <span className={stateBadgeClass(c.terminal_state)}>
                      {stateLabel(c.terminal_state)}
                    </span>
                  </td>
                  <td>
                    {c.escalation_reason ? (
                      <span className={escalationClass(c.escalation_reason)}>
                        {escalationLabel(c.escalation_reason)}
                      </span>
                    ) : '—'}
                  </td>
                  <td style={{ fontFamily: 'monospace', fontSize: 12 }}>
                    {c.patient_id || '—'}
                  </td>
                  <td style={{ fontFamily: 'monospace', fontSize: 12 }}>
                    {c.appointment_id || '—'}
                  </td>
                  <td style={{ fontSize: 12, color: 'var(--mute)' }}>
                    {c.metrics?.tokens || '—'}
                  </td>
                  <td style={{ fontSize: 12, color: 'var(--mute)' }}>
                    {c.metrics?.latency_ms ? `${c.metrics.latency_ms}ms` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

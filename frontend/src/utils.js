// utils.js — Formatting helpers

export function stateBadgeClass(state) {
  const map = {
    booked: 'badge--booked',
    rescheduled: 'badge--rescheduled',
    cancelled: 'badge--cancelled',
    escalated: 'badge--escalated',
    refused: 'badge--refused',
    abandoned: 'badge--abandoned',
  };
  return `badge ${map[state] || 'badge--abandoned'}`;
}

export function stateLabel(state) {
  return state ? state.toUpperCase() : 'UNKNOWN';
}

export function escalationLabel(reason) {
  const map = {
    clinical_urgent: '🚨 CLINICAL',
    medical_advice: '💊 MEDICAL',
    not_authorised: '🔒 NOT AUTH',
    ambiguous_patient: '👤 AMBIGUOUS',
    out_of_scope: '↗ OUT OF SCOPE',
  };
  return reason ? (map[reason] || reason.toUpperCase()) : '—';
}

export function escalationClass(reason) {
  return reason ? `esc-badge esc--${reason}` : '';
}

export function toolIcon(name) {
  const icons = {
    search_slots: '🔍',
    book_appointment: '📅',
    reschedule_appointment: '🔄',
    cancel_appointment: '❌',
    lookup_patient: '👤',
    escalate_to_human: '🚨',
  };
  return icons[name] || '⚙️';
}

export function formatArgs(args) {
  return Object.entries(args)
    .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
    .join('  ');
}

export function timeAgo(ts) {
  if (!ts) return '';
  const diff = Date.now() - new Date(ts).getTime();
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.round(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.round(diff / 3600000)}h ago`;
  return `${Math.round(diff / 86400000)}d ago`;
}

export const OPPORTUNITY_DECISIONS = [
  'submitted',
  'under_preparation',
  'internal_review',
  'overdue',
  'failed',
];

export const OPPORTUNITY_URGENCY_LEVELS = [
  'not_urgent',
  'urgent',
  'very_urgent',
  'past_due',
];

export const DEFAULT_OPPORTUNITY_DECISION = 'submitted';
export const DEFAULT_OPPORTUNITY_URGENCY = 'not_urgent';

export function isValidOpportunityDecision(value) {
  return OPPORTUNITY_DECISIONS.includes(value);
}

export function isValidOpportunityUrgency(value) {
  return OPPORTUNITY_URGENCY_LEVELS.includes(value);
}

export function normalizeBase64Document(document) {
  if (!document) return null;
  const value = String(document).trim();
  if (!value) return null;
  return value.startsWith('data:') ? value.split(',')[1] || '' : value;
}

export function validateBase64DocumentSize(base64Data, label = 'Document') {
  if (!base64Data) return null;

  const estimatedFileSize = (base64Data.length * 3) / 4;
  if (estimatedFileSize > 200 * 1024 * 1024) {
    return `${label} exceeds 200MB limit. Estimated size: ${(estimatedFileSize / 1024 / 1024).toFixed(2)}MB. Please upload a smaller file.`;
  }

  if (base64Data.length > 300 * 1024 * 1024) {
    return `${label} is too large after encoding. Please upload a smaller file.`;
  }

  return null;
}

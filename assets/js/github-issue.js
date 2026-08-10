/**
 * "Suggest a correction" links: pre-filled GitHub Issues against this site's
 * own repository, using GitHub's documented issue-prefill query parameters
 * (https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/creating-an-issue#creating-an-issue-from-a-url-query).
 * No backend, no external service beyond GitHub itself — the visitor reviews
 * and submits the issue themselves; nothing is sent on their behalf.
 */
const REPO = 'mpsarge/mpsarge.github.io';

function issueBody({ itemLabel, itemId, currentData }) {
  const lines = [
    `**Item:** ${itemLabel}${itemId ? ` (\`${itemId}\`)` : ''}`,
    '',
    '**What is inaccurate?**',
    '<!-- describe the issue -->',
    '',
    '**Correct value / source**',
    '<!-- your correction, with a source if you have one -->',
    '',
    '---',
    '<details><summary>Current data on file</summary>',
    '',
    '```json',
    JSON.stringify(currentData, null, 2),
    '```',
    '</details>',
  ];
  return lines.join('\n');
}

export function suggestCorrectionUrl({ itemLabel, itemId, currentData }) {
  const params = new URLSearchParams({
    title: `Data correction: ${itemLabel}`,
    body: issueBody({ itemLabel, itemId, currentData }),
    labels: 'data-correction',
  });
  return `https://github.com/${REPO}/issues/new?${params.toString()}`;
}

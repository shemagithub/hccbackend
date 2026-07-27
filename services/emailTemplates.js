function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function getLoginUrl() {
  const base =
    process.env.FRONTEND_URL ||
    process.env.APP_LOGIN_URL ||
    'https://management.hccafrica.com';
  return String(base).replace(/\/$/, '') + '/auth/login';
}

function layout({ title, preheader, bodyHtml }) {
  const brand = 'HCC Africa';
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background:#f3f5f7;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1f2937;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader || title)}</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3f5f7;padding:28px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e5e7eb;">
          <tr>
            <td style="background:linear-gradient(135deg,#0f766e 0%,#115e59 100%);padding:28px 32px;">
              <div style="font-size:13px;letter-spacing:0.08em;text-transform:uppercase;color:rgba(255,255,255,0.8);">HCC Africa</div>
              <div style="margin-top:8px;font-size:24px;font-weight:700;color:#ffffff;line-height:1.3;">${escapeHtml(title)}</div>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 32px;">
              ${bodyHtml}
            </td>
          </tr>
          <tr>
            <td style="padding:18px 32px 28px;border-top:1px solid #eef2f7;background:#fafbfc;">
              <p style="margin:0;font-size:12px;line-height:1.6;color:#6b7280;">
                This message was sent by ${escapeHtml(brand)} from
                <strong>${escapeHtml(process.env.HOSTINGER_MAIL_ADDRESS || 'info@support.hccafrica.com')}</strong>.
                If you were not expecting this email, contact your administrator.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function infoRow(label, value) {
  if (!value) return '';
  return `<tr>
    <td style="padding:8px 0;width:140px;vertical-align:top;font-size:13px;color:#6b7280;">${escapeHtml(label)}</td>
    <td style="padding:8px 0;font-size:14px;color:#111827;font-weight:600;">${escapeHtml(value)}</td>
  </tr>`;
}

function ctaButton(href, label) {
  return `<a href="${escapeHtml(href)}" style="display:inline-block;margin-top:8px;background:#0f766e;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 22px;border-radius:10px;">${escapeHtml(label)}</a>`;
}

function rolePurpose(role = '', position = '', projectRole = '') {
  const key = String(projectRole || role || '').toLowerCase();
  if (key.includes('project_manager') || key.includes('project manager')) {
    return 'Lead the project team, track progress, approve work, and keep delivery on schedule.';
  }
  if (key.includes('team_lead') || key.includes('team lead')) {
    return 'Coordinate day-to-day team work, support contributors, and escalate blockers promptly.';
  }
  if (key.includes('viewer')) {
    return 'View project updates and documents so you stay informed without editing records.';
  }
  if (key.includes('finance')) {
    return 'Review budgets, invoices, and financial controls related to HCC projects.';
  }
  if (key.includes('superadmin') || key.includes('admin')) {
    return 'Manage platform users, access controls, and overall HCC operations.';
  }
  if (position) {
    return `Use the HCC management platform for your role as ${position}.`;
  }
  return 'Collaborate on projects, complete assigned work, and stay updated with your team inside the HCC management platform.';
}

export function buildWelcomeEmail({
  firstName,
  lastName,
  email,
  password,
  role,
  position,
  projectName,
  projectRole,
  createdByName,
}) {
  const loginUrl = getLoginUrl();
  const name = [firstName, lastName].filter(Boolean).join(' ') || 'there';
  const purpose = rolePurpose(role, position, projectRole);
  const subject = projectName
    ? `Welcome to HCC Africa — you've been added to ${projectName}`
    : 'Welcome to HCC Africa — your account is ready';

  const bodyHtml = `
    <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">Hello ${escapeHtml(name)},</p>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">
      An account has been created for you on the <strong>HCC Africa</strong> management platform
      ${projectName ? `for the project <strong>${escapeHtml(projectName)}</strong>` : ''}.
    </p>
    <p style="margin:0 0 18px;font-size:15px;line-height:1.6;background:#f0fdfa;border:1px solid #ccfbf1;border-radius:12px;padding:14px 16px;">
      <strong>What this account is for:</strong><br/>
      ${escapeHtml(purpose)}
    </p>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 18px;">
      ${infoRow('Email / username', email)}
      ${password ? infoRow('Temporary password', password) : ''}
      ${infoRow('Role', projectRole || role)}
      ${infoRow('Position', position)}
      ${infoRow('Project', projectName)}
      ${infoRow('Created by', createdByName)}
    </table>
    <p style="margin:0 0 8px;font-size:15px;line-height:1.6;"><strong>How to sign in</strong></p>
    <ol style="margin:0 0 18px;padding-left:18px;font-size:15px;line-height:1.7;color:#374151;">
      <li>Open the sign-in page using the button below.</li>
      <li>Enter your email and the temporary password shown above.</li>
      <li>Change your password after your first login if prompted.</li>
    </ol>
    ${ctaButton(loginUrl, 'Sign in to HCC Africa')}
    <p style="margin:18px 0 0;font-size:13px;line-height:1.6;color:#6b7280;">
      Sign-in link: <a href="${escapeHtml(loginUrl)}" style="color:#0f766e;">${escapeHtml(loginUrl)}</a>
    </p>
  `;

  const text = [
    `Hello ${name},`,
    '',
    `An HCC Africa account has been created for you${projectName ? ` for project ${projectName}` : ''}.`,
    `What this is for: ${purpose}`,
    '',
    `Email: ${email}`,
    password ? `Temporary password: ${password}` : '',
    `Role: ${projectRole || role || ''}`,
    position ? `Position: ${position}` : '',
    createdByName ? `Created by: ${createdByName}` : '',
    '',
    `Sign in: ${loginUrl}`,
  ]
    .filter(Boolean)
    .join('\n');

  return { subject, text, html: layout({ title: 'Your HCC account is ready', preheader: subject, bodyHtml }) };
}

export function buildAssignmentEmail({
  firstName,
  lastName,
  projectName,
  projectRole,
  projectDescription,
  assignedByName,
  startDate,
  endDate,
}) {
  const loginUrl = getLoginUrl();
  const name = [firstName, lastName].filter(Boolean).join(' ') || 'there';
  const roleLabel = projectRole || 'Contributor';
  const purpose = rolePurpose('', '', projectRole);
  const subject = `You've been assigned to ${projectName || 'a project'} on HCC Africa`;

  const bodyHtml = `
    <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">Hello ${escapeHtml(name)},</p>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">
      You have been assigned to <strong>${escapeHtml(projectName || 'a project')}</strong>
      as <strong>${escapeHtml(roleLabel)}</strong>.
    </p>
    <p style="margin:0 0 18px;font-size:15px;line-height:1.6;background:#f0fdfa;border:1px solid #ccfbf1;border-radius:12px;padding:14px 16px;">
      <strong>What you will do:</strong><br/>
      ${escapeHtml(purpose)}
    </p>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 18px;">
      ${infoRow('Project', projectName)}
      ${infoRow('Your role', roleLabel)}
      ${infoRow('Assigned by', assignedByName)}
      ${infoRow('Start date', startDate)}
      ${infoRow('End date', endDate)}
    </table>
    ${projectDescription ? `<p style="margin:0 0 18px;font-size:14px;line-height:1.6;color:#374151;"><strong>Project overview:</strong><br/>${escapeHtml(projectDescription)}</p>` : ''}
    <p style="margin:0 0 12px;font-size:15px;line-height:1.6;">Sign in to review the project, documents, and your tasks:</p>
    ${ctaButton(loginUrl, 'Open HCC Africa')}
  `;

  const text = [
    `Hello ${name},`,
    '',
    `You have been assigned to ${projectName || 'a project'} as ${roleLabel}.`,
    `What you will do: ${purpose}`,
    assignedByName ? `Assigned by: ${assignedByName}` : '',
    '',
    `Sign in: ${loginUrl}`,
  ]
    .filter(Boolean)
    .join('\n');

  return { subject, text, html: layout({ title: 'New project assignment', preheader: subject, bodyHtml }) };
}

export function buildTaskAssignmentEmail({
  firstName,
  lastName,
  taskTitle,
  projectName,
  dueDate,
  priority,
  description,
  assignedByName,
}) {
  const loginUrl = getLoginUrl();
  const name = [firstName, lastName].filter(Boolean).join(' ') || 'there';
  const subject = `New task assigned: ${taskTitle || 'Task'}`;

  const bodyHtml = `
    <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">Hello ${escapeHtml(name)},</p>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">
      A task has been assigned to you on HCC Africa. Please review the details and complete the work in the platform.
    </p>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 18px;">
      ${infoRow('Task', taskTitle)}
      ${infoRow('Project', projectName)}
      ${infoRow('Priority', priority)}
      ${infoRow('Due date', dueDate)}
      ${infoRow('Assigned by', assignedByName)}
    </table>
    ${description ? `<p style="margin:0 0 18px;font-size:14px;line-height:1.6;color:#374151;"><strong>What to do:</strong><br/>${escapeHtml(description)}</p>` : ''}
    ${ctaButton(loginUrl, 'View task in HCC Africa')}
  `;

  const text = [
    `Hello ${name},`,
    '',
    `Task assigned: ${taskTitle}`,
    projectName ? `Project: ${projectName}` : '',
    dueDate ? `Due: ${dueDate}` : '',
    priority ? `Priority: ${priority}` : '',
    description ? `Details: ${description}` : '',
    '',
    `Sign in: ${loginUrl}`,
  ]
    .filter(Boolean)
    .join('\n');

  return { subject, text, html: layout({ title: 'New task assigned to you', preheader: subject, bodyHtml }) };
}

export function buildPasswordResetEmail({
  firstName,
  lastName,
  email,
  password,
  resetByName,
}) {
  const loginUrl = getLoginUrl();
  const name = [firstName, lastName].filter(Boolean).join(' ') || 'there';
  const subject = 'Your HCC Africa password was reset';

  const bodyHtml = `
    <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">Hello ${escapeHtml(name)},</p>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">
      Your password for the HCC Africa management platform has been reset
      ${resetByName ? `by <strong>${escapeHtml(resetByName)}</strong>` : 'by an administrator'}.
    </p>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 18px;">
      ${infoRow('Email', email)}
      ${infoRow('New temporary password', password)}
    </table>
    <p style="margin:0 0 12px;font-size:15px;line-height:1.6;">Sign in with the new password, then change it after login.</p>
    ${ctaButton(loginUrl, 'Sign in now')}
  `;

  const text = [
    `Hello ${name},`,
    '',
    'Your HCC Africa password was reset.',
    `Email: ${email}`,
    `New temporary password: ${password}`,
    '',
    `Sign in: ${loginUrl}`,
  ].join('\n');

  return { subject, text, html: layout({ title: 'Password reset', preheader: subject, bodyHtml }) };
}

export function buildClientProjectEmail({
  clientName,
  projectName,
  updateType,
  title,
  message,
  status,
  progress,
  manager,
  startDate,
  endDate,
  attachmentNames = [],
  sentByName,
}) {
  const subject = title || `Project update: ${projectName || 'HCC project'}`;

  const bodyHtml = `
    <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">Dear ${escapeHtml(clientName || 'Client')},</p>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">
      Please find the latest information for your project with <strong>HCC Africa</strong>.
    </p>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 18px;">
      ${infoRow('Project', projectName)}
      ${infoRow('Update type', updateType)}
      ${infoRow('Status', status)}
      ${infoRow('Progress', progress != null && progress !== '' ? `${progress}%` : '')}
      ${infoRow('Project manager', manager)}
      ${infoRow('Start date', startDate)}
      ${infoRow('End date', endDate)}
      ${infoRow('Sent by', sentByName)}
    </table>
    <div style="margin:0 0 18px;padding:16px;border-radius:12px;background:#f8fafc;border:1px solid #e2e8f0;">
      <div style="font-size:13px;color:#64748b;margin-bottom:6px;">Message</div>
      <div style="font-size:15px;line-height:1.7;color:#1e2937;white-space:pre-wrap;">${escapeHtml(message || '')}</div>
    </div>
    ${
      attachmentNames.length
        ? `<p style="margin:0 0 8px;font-size:14px;"><strong>Attached files</strong></p>
           <ul style="margin:0 0 12px;padding-left:18px;font-size:14px;line-height:1.7;color:#374151;">
             ${attachmentNames.map((n) => `<li>${escapeHtml(n)}</li>`).join('')}
           </ul>`
        : ''
    }
    <p style="margin:16px 0 0;font-size:14px;line-height:1.6;color:#4b5563;">
      If you have questions, reply to this email or contact your HCC Africa project contact.
    </p>
  `;

  const text = [
    `Dear ${clientName || 'Client'},`,
    '',
    `Project: ${projectName || ''}`,
    updateType ? `Update type: ${updateType}` : '',
    status ? `Status: ${status}` : '',
    progress != null && progress !== '' ? `Progress: ${progress}%` : '',
    '',
    message || '',
    '',
    attachmentNames.length ? `Attachments: ${attachmentNames.join(', ')}` : '',
    sentByName ? `Sent by: ${sentByName}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  return { subject, text, html: layout({ title: subject, preheader: subject, bodyHtml }) };
}

export { getLoginUrl };

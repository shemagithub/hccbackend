import { sendEmail } from './mailService.js';
import {
  buildWelcomeEmail,
  buildAssignmentEmail,
  buildTaskAssignmentEmail,
  buildPasswordResetEmail,
  buildClientProjectEmail,
} from './emailTemplates.js';
import Staff from '../models/Staff.js';
import Project from '../models/Project.js';
import Document from '../models/Document.js';
import Client from '../models/Client.js';

function formatRoleLabel(role) {
  if (!role) return 'Contributor';
  return String(role)
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function stripDataUrl(content = '') {
  const value = String(content || '');
  const match = value.match(/^data:[^;]+;base64,(.+)$/i);
  return match ? match[1] : value;
}

function staffDisplayName(staff) {
  if (!staff) return '';
  return [staff.firstName, staff.lastName].filter(Boolean).join(' ') || staff.email || '';
}

/**
 * Fire-and-forget safe send. Never throws to callers by default.
 */
export async function sendTransactional(payload, { throwOnError = false } = {}) {
  try {
    const result = await sendEmail({
      displayName: payload.displayName || 'HCC Africa',
      ...payload,
    });
    return { sent: true, result };
  } catch (error) {
    console.error('[transactionalMail]', error?.message || error);
    if (throwOnError) throw error;
    return { sent: false, error: error?.message || 'Failed to send email' };
  }
}

export async function sendWelcomeAccountEmail({
  staff,
  password,
  projectName,
  projectRole,
  createdByName,
}) {
  if (!staff?.email) return { sent: false, error: 'No email' };
  const tpl = buildWelcomeEmail({
    firstName: staff.firstName,
    lastName: staff.lastName,
    email: staff.email,
    password,
    role: staff.role,
    position: staff.position,
    projectName,
    projectRole: projectRole ? formatRoleLabel(projectRole) : '',
    createdByName,
  });
  return sendTransactional({
    to: [staff.email],
    subject: tpl.subject,
    text: tpl.text,
    html: tpl.html,
  });
}

export async function sendProjectAssignmentEmail({
  staffId,
  projectId,
  projectRole,
  assignedById,
}) {
  try {
    const staff = await Staff.findById(staffId);
    if (!staff?.email) return { sent: false, error: 'Staff email missing' };

    const project = await Project.findById(projectId);
    let assignedByName = '';
    if (assignedById) {
      const assigner = await Staff.findById(assignedById);
      assignedByName = staffDisplayName(assigner);
    }

    const tpl = buildAssignmentEmail({
      firstName: staff.firstName,
      lastName: staff.lastName,
      projectName: project?.name,
      projectRole: formatRoleLabel(projectRole),
      projectDescription: project?.description,
      assignedByName,
      startDate: project?.startDate,
      endDate: project?.endDate,
    });

    return sendTransactional({
      to: [staff.email],
      subject: tpl.subject,
      text: tpl.text,
      html: tpl.html,
    });
  } catch (error) {
    console.error('[sendProjectAssignmentEmail]', error?.message || error);
    return { sent: false, error: error?.message || 'Failed' };
  }
}

export async function sendTaskAssignmentEmails({
  assigneeIds = [],
  task,
  projectName,
  assignedById,
}) {
  const ids = [...new Set((assigneeIds || []).filter(Boolean).map((id) => Number(id)))];
  if (ids.length === 0) return { sent: 0, results: [] };

  let assignedByName = '';
  if (assignedById) {
    try {
      assignedByName = staffDisplayName(await Staff.findById(assignedById));
    } catch {
      // ignore
    }
  }

  const results = [];
  for (const id of ids) {
    try {
      const staff = await Staff.findById(id);
      if (!staff?.email) {
        results.push({ staffId: id, sent: false, error: 'No email' });
        continue;
      }
      const tpl = buildTaskAssignmentEmail({
        firstName: staff.firstName,
        lastName: staff.lastName,
        taskTitle: task?.title,
        projectName,
        dueDate: task?.dueDate,
        priority: task?.priority,
        description: task?.description,
        assignedByName,
      });
      const outcome = await sendTransactional({
        to: [staff.email],
        subject: tpl.subject,
        text: tpl.text,
        html: tpl.html,
      });
      results.push({ staffId: id, ...outcome });
    } catch (error) {
      results.push({ staffId: id, sent: false, error: error?.message });
    }
  }

  return {
    sent: results.filter((r) => r.sent).length,
    results,
  };
}

export async function sendPasswordResetEmail({ staff, password, resetByName }) {
  if (!staff?.email || !password) return { sent: false, error: 'Missing email or password' };
  const tpl = buildPasswordResetEmail({
    firstName: staff.firstName,
    lastName: staff.lastName,
    email: staff.email,
    password,
    resetByName,
  });
  return sendTransactional({
    to: [staff.email],
    subject: tpl.subject,
    text: tpl.text,
    html: tpl.html,
  });
}

/**
 * Send project information email to a client, optionally attaching project documents.
 */
export async function sendClientProjectUpdate({
  to = [],
  clientId,
  projectId,
  updateType = 'Project Update',
  title,
  message,
  documentIds = [],
  extraAttachments = [],
  sentById,
}) {
  const recipients = [...new Set((Array.isArray(to) ? to : String(to).split(','))
    .map((e) => String(e || '').trim())
    .filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)))];

  let client = null;
  if (clientId) {
    if (!Number.isNaN(Number(clientId))) {
      client = await Client.findById(Number(clientId));
    }
    if (!client) {
      client = await Client.findByClientId(String(clientId));
    }
    if (client?.email && !recipients.includes(client.email)) {
      recipients.unshift(client.email);
    }
  }

  if (recipients.length === 0) {
    const err = new Error('At least one valid recipient email is required');
    err.status = 400;
    err.code = 'ERR_MAIL_NO_RECIPIENTS';
    throw err;
  }

  if (!String(message || '').trim() && !String(title || '').trim()) {
    const err = new Error('Title or message is required');
    err.status = 400;
    err.code = 'ERR_MAIL_NO_BODY';
    throw err;
  }

  const project = projectId ? await Project.findById(projectId) : null;
  let sentByName = '';
  if (sentById) {
    try {
      sentByName = staffDisplayName(await Staff.findById(sentById));
    } catch {
      // ignore
    }
  }

  const attachments = [];
  const attachmentNames = [];

  for (const docId of documentIds || []) {
    let doc = null;
    if (!Number.isNaN(Number(docId))) {
      doc = await Document.findById(Number(docId));
    }
    if (!doc) {
      doc = await Document.findByDocumentId(String(docId));
    }
    if (!doc?.fileData) continue;
    const content = stripDataUrl(doc.fileData);
    if (!content) continue;
    const filename = doc.name || `document-${doc.id}`;
    attachments.push({
      filename,
      content,
      contentType: doc.fileType || 'application/octet-stream',
      encoding: 'base64',
    });
    attachmentNames.push(filename);
  }

  for (const file of extraAttachments || []) {
    if (!file?.content) continue;
    const filename = file.filename || file.name || 'attachment';
    attachments.push({
      filename,
      content: stripDataUrl(file.content),
      contentType: file.contentType || file.type || 'application/octet-stream',
      encoding: file.encoding || 'base64',
    });
    attachmentNames.push(filename);
  }

  if (attachments.length > 10) {
    const err = new Error('Maximum 10 attachments allowed');
    err.status = 400;
    throw err;
  }

  const tpl = buildClientProjectEmail({
    clientName: client?.name || client?.company || recipients[0],
    projectName: project?.name,
    updateType,
    title: title || `Update: ${project?.name || 'Your project'}`,
    message,
    status: project?.status,
    progress: project?.progress,
    manager: project?.manager,
    startDate: project?.startDate,
    endDate: project?.endDate,
    attachmentNames,
    sentByName,
  });

  const result = await sendEmail({
    to: recipients,
    subject: tpl.subject,
    text: tpl.text,
    html: tpl.html,
    displayName: 'HCC Africa',
    attachments,
  });

  return {
    success: true,
    from: result.from,
    to: result.to,
    subject: tpl.subject,
    attachmentCount: attachments.length,
    attachmentNames,
    client: client
      ? { id: client.id || client.dbId, name: client.name, email: client.email }
      : null,
    project: project
      ? { id: project.id || project.dbId, name: project.name, status: project.status, progress: project.progress }
      : null,
  };
}

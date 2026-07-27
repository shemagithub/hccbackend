import hostingerMail from 'hostinger-mail-api-sdk';

const {
  Configuration,
  AccountApi,
  FoldersApi,
  MessagesApi,
  SendApi,
} = hostingerMail;

/** UI folder id → IMAP path */
export const FOLDER_PATHS = {
  inbox: 'INBOX',
  sent: 'INBOX.Sent',
  drafts: 'INBOX.Drafts',
  spam: 'INBOX.Junk',
  trash: 'INBOX.Trash',
  archive: 'INBOX.Archive',
};

const PATH_TO_FOLDER = Object.fromEntries(
  Object.entries(FOLDER_PATHS).map(([id, path]) => [path, id]),
);

function getToken() {
  const token = process.env.HOSTINGER_MAIL_API_TOKEN?.trim();
  if (!token) {
    const err = new Error('HOSTINGER_MAIL_API_TOKEN is not configured');
    err.code = 'ERR_MAIL_NOT_CONFIGURED';
    err.status = 503;
    throw err;
  }
  return token;
}

function getConfig() {
  return new Configuration({ accessToken: getToken() });
}

function unwrap(response) {
  return response?.data;
}

function formatApiError(error) {
  const status = error?.response?.status || error?.status || 502;
  const data = error?.response?.data;
  const message =
    data?.error ||
    data?.message ||
    (typeof data === 'string' ? data : null) ||
    error?.message ||
    'Hostinger Mail API request failed';
  const code = data?.code || error?.code || 'ERR_MAIL_API';
  const err = new Error(message);
  err.status = status;
  err.code = code;
  err.params = data?.params;
  err.details = data;
  return err;
}

export function resolveFolderPath(folder) {
  if (!folder) return FOLDER_PATHS.inbox;
  if (FOLDER_PATHS[folder]) return FOLDER_PATHS[folder];
  // Allow raw IMAP paths from the API
  if (typeof folder === 'string' && folder.includes('.')) return folder;
  if (folder === 'INBOX' || folder.startsWith('INBOX')) return folder;
  return FOLDER_PATHS.inbox;
}

export function folderIdFromPath(path) {
  if (!path) return 'inbox';
  if (PATH_TO_FOLDER[path]) return PATH_TO_FOLDER[path];
  const lower = path.toLowerCase();
  if (lower.includes('sent')) return 'sent';
  if (lower.includes('draft')) return 'drafts';
  if (lower.includes('junk') || lower.includes('spam')) return 'spam';
  if (lower.includes('trash') || lower.includes('deleted')) return 'trash';
  if (lower.includes('archive')) return 'archive';
  if (path === 'INBOX') return 'inbox';
  return 'inbox';
}

function formatAddress(addr) {
  if (!addr) return { name: '', email: '' };
  if (typeof addr === 'string') return { name: addr, email: addr };
  return {
    name: addr.name || addr.address || '',
    email: addr.address || '',
  };
}

function formatAddresses(list) {
  if (!Array.isArray(list) || list.length === 0) return '';
  return list
    .map((a) => {
      const { name, email } = formatAddress(a);
      return name && name !== email ? `${name} <${email}>` : email || name;
    })
    .filter(Boolean)
    .join(', ');
}

function formatTimestamp(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return String(iso);
  }
}

function mapMessage(msg, bodyText = '', bodyHtml = '') {
  const from = formatAddress(msg.from);
  const flags = Array.isArray(msg.flags) ? msg.flags : [];
  const isStarred = flags.some((f) => /flagged/i.test(f));
  const plain = bodyText || '';
  const previewSource = plain.replace(/\s+/g, ' ').trim();
  const path = msg.path || 'INBOX';
  const uid = msg.uid;

  return {
    id: `${path}:${uid}`,
    uid,
    path,
    folder: folderIdFromPath(path),
    from: from.name || from.email || 'Unknown',
    fromEmail: from.email || '',
    to: formatAddresses(msg.to) || formatAddresses(msg.cc) || '',
    subject: msg.subject || '(no subject)',
    body: plain,
    bodyHtml: bodyHtml || '',
    preview: previewSource.slice(0, 140) || msg.subject || '',
    timestamp: formatTimestamp(msg.date),
    date: msg.date,
    isRead: !msg.unseen,
    isStarred,
    hasAttachments: Array.isArray(msg.attachments) && msg.attachments.length > 0,
    attachments: (msg.attachments || []).map((a) => a.filename || a.id || 'attachment'),
    attachmentMeta: (msg.attachments || []).map((a) => ({
      id: a.id,
      filename: a.filename || 'attachment',
      contentType: a.contentType || 'application/octet-stream',
      sizeBytes: Number(a.sizeBytes) || 0,
      inline: Boolean(a.inline),
      contentId: a.contentId || null,
    })),
    priority: 'normal',
    flags,
    messageId: msg.messageId || null,
    size: msg.size || 0,
  };
}

let cachedMailbox = null;
let cacheAt = 0;
const CACHE_MS = 60_000;

export async function getAccount(force = false) {
  try {
    if (!force && cachedMailbox && Date.now() - cacheAt < CACHE_MS) {
      return cachedMailbox;
    }
    const api = new AccountApi(getConfig());
    const res = unwrap(await api.getCurrentAccount());
    const data = res?.data || res;
    const preferred =
      process.env.HOSTINGER_MAIL_ADDRESS?.trim()?.toLowerCase() || null;
    const mailboxes = data?.mailboxes || [];
    const selected =
      (preferred && mailboxes.find((m) => m.address?.toLowerCase() === preferred)) ||
      mailboxes[0] ||
      null;

    if (!selected?.resourceId) {
      const err = new Error('No mailbox available for this Hostinger API token');
      err.status = 404;
      err.code = 'ERR_MAILBOX_NOT_FOUND';
      throw err;
    }

    cachedMailbox = {
      orderResourceId: data.orderResourceId,
      mailboxResourceId: selected.resourceId,
      address: selected.address,
      mailboxes,
    };
    cacheAt = Date.now();
    return cachedMailbox;
  } catch (error) {
    if (error.status || error.code === 'ERR_MAIL_NOT_CONFIGURED') throw error;
    throw formatApiError(error);
  }
}

export async function listFolders() {
  try {
    const account = await getAccount();
    const api = new FoldersApi(getConfig());
    const res = unwrap(await api.listFolders(account.mailboxResourceId));
    const folders = res?.data || [];
    return {
      address: account.address,
      mailboxResourceId: account.mailboxResourceId,
      folders: folders.map((f) => ({
        path: f.path,
        name: f.name,
        id: folderIdFromPath(f.path),
        specialUse: f.specialUse,
        messageCount: f.messageCount ?? 0,
        unreadCount: f.unreadCount ?? 0,
      })),
    };
  } catch (error) {
    if (error.status || error.code === 'ERR_MAIL_NOT_CONFIGURED') throw error;
    throw formatApiError(error);
  }
}

export async function ensureFolder(path) {
  const listed = await listFolders();
  if (listed.folders.some((f) => f.path === path || f.path.toLowerCase() === path.toLowerCase())) {
    return listed;
  }
  try {
    const account = await getAccount();
    const api = new FoldersApi(getConfig());
    const name = path.includes('.') ? path.split('.').pop() : path;
    await api.createFolder(account.mailboxResourceId, { name });
  } catch (error) {
    const again = await listFolders();
    if (again.folders.some((f) => f.path === path || f.name === path.split('.').pop())) {
      return again;
    }
    throw formatApiError(error);
  }
  return listFolders();
}

export async function listMessages(folder = 'inbox', page = 1, perPage = 50, sort = '-date') {
  try {
    const account = await getAccount();
    const path = resolveFolderPath(folder);
    const api = new MessagesApi(getConfig());
    const res = unwrap(
      await api.listMessages(account.mailboxResourceId, path, page, perPage, sort),
    );
    const items = res?.data || [];
    return {
      address: account.address,
      folder: folderIdFromPath(path),
      path,
      messages: items.map((m) => mapMessage(m)),
      pagination: res?.pagination || {
        page,
        perPage,
        total: items.length,
        totalPages: 1,
      },
    };
  } catch (error) {
    if (error.status || error.code === 'ERR_MAIL_NOT_CONFIGURED') throw error;
    // Empty / missing folder
    if (error?.response?.status === 404) {
      return {
        address: (await getAccount()).address,
        folder: folderIdFromPath(resolveFolderPath(folder)),
        path: resolveFolderPath(folder),
        messages: [],
        pagination: { page, perPage, total: 0, totalPages: 0 },
      };
    }
    throw formatApiError(error);
  }
}

export async function listStarredMessages(page = 1, perPage = 50) {
  // Hostinger search may not be wired in SDK usage here; scan primary folders for \Flagged
  const folders = ['inbox', 'sent', 'drafts', 'spam', 'archive'];
  const starred = [];
  for (const folder of folders) {
    try {
      const result = await listMessages(folder, 1, 100);
      for (const msg of result.messages) {
        if (msg.isStarred) starred.push(msg);
      }
    } catch {
      // skip missing folders
    }
  }
  starred.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const start = (page - 1) * perPage;
  const slice = starred.slice(start, start + perPage);
  return {
    address: (await getAccount()).address,
    folder: 'starred',
    path: null,
    messages: slice,
    pagination: {
      page,
      perPage,
      total: starred.length,
      totalPages: Math.max(1, Math.ceil(starred.length / perPage)),
    },
  };
}

export async function getMessage(folder, uid, includeBody = true) {
  try {
    const account = await getAccount();
    const path = resolveFolderPath(folder);
    const api = new MessagesApi(getConfig());
    const metaRes = unwrap(await api.getMessage(account.mailboxResourceId, path, Number(uid)));
    const meta = metaRes?.data || metaRes;
    let text = '';
    let html = '';
    if (includeBody) {
      try {
        const textRes = unwrap(
          await api.getMessageText(account.mailboxResourceId, path, Number(uid)),
        );
        const body = textRes?.data || textRes;
        text = body?.text || '';
        html = body?.html || '';
      } catch {
        // body fetch optional
      }
    }
    return {
      address: account.address,
      message: mapMessage(meta, text, html),
    };
  } catch (error) {
    if (error.status || error.code === 'ERR_MAIL_NOT_CONFIGURED') throw error;
    throw formatApiError(error);
  }
}

function normalizeRecipients(value) {
  const list = Array.isArray(value) ? value : value ? [value] : [];
  return list
    .flatMap((entry) => String(entry).split(/[,;]+/))
    .map((entry) => entry.trim())
    .map((entry) => {
      const match = entry.match(/<([^>]+)>/);
      return (match ? match[1] : entry).trim();
    })
    .filter((email) => email && email.includes('@'));
}

export async function sendEmail({
  to = [],
  cc = [],
  bcc = [],
  subject = '',
  text = '',
  html = '',
  displayName = '',
  attachments = [],
}) {
  try {
    const account = await getAccount();
    const toList = normalizeRecipients(to);
    const ccList = normalizeRecipients(cc);
    const bccList = normalizeRecipients(bcc);

    if (toList.length === 0 && ccList.length === 0 && bccList.length === 0) {
      const err = new Error('At least one valid recipient email is required');
      err.status = 400;
      err.code = 'ERR_MAIL_NO_RECIPIENTS';
      throw err;
    }

    if (!String(subject || '').trim()) {
      const err = new Error('Subject is required');
      err.status = 400;
      err.code = 'ERR_MAIL_NO_SUBJECT';
      throw err;
    }

    const plain =
      String(text || '').trim() ||
      String(html || '')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    if (!plain) {
      const err = new Error('Message body is required');
      err.status = 400;
      err.code = 'ERR_MAIL_NO_BODY';
      throw err;
    }

    const api = new SendApi(getConfig());
    const safeAttachments = (attachments || [])
      .filter((a) => a && typeof a.content === 'string' && a.content.length > 0)
      .map((a) => ({
        filename: String(a.filename || a.name || 'attachment').slice(0, 255),
        content: a.content,
        contentType: a.contentType || a.type || 'application/octet-stream',
        cid: a.cid || '',
        encoding: a.encoding || 'base64',
      }));

    if ((attachments || []).length > 0 && safeAttachments.length === 0) {
      const err = new Error('Attachments were provided but none could be sent (missing file content)');
      err.status = 400;
      err.code = 'ERR_MAIL_ATTACHMENTS';
      throw err;
    }

    const payload = {
      to: toList,
      cc: ccList,
      bcc: bccList,
      displayName: displayName || account.address,
      subject: String(subject).trim(),
      text: plain,
      html: html || `<p>${plain.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>`,
      attachments: safeAttachments,
    };

    await api.sendEmail(account.mailboxResourceId, payload);
    return {
      success: true,
      from: account.address,
      to: toList,
      cc: ccList,
      bcc: bccList,
      subject: payload.subject,
      attachmentCount: safeAttachments.length,
    };
  } catch (error) {
    if (
      error.status ||
      error.code === 'ERR_MAIL_NOT_CONFIGURED' ||
      error.code === 'ERR_MAIL_NO_RECIPIENTS' ||
      error.code === 'ERR_MAIL_NO_SUBJECT' ||
      error.code === 'ERR_MAIL_NO_BODY' ||
      error.code === 'ERR_MAIL_ATTACHMENTS'
    ) {
      throw error;
    }
    throw formatApiError(error);
  }
}

export async function updateFlags(folder, uid, { addFlags = [], removeFlags = [] } = {}) {
  try {
    const account = await getAccount();
    const path = resolveFolderPath(folder);
    const api = new MessagesApi(getConfig());
    const res = unwrap(
      await api.patchMessage(account.mailboxResourceId, path, Number(uid), {
        addFlags,
        removeFlags,
      }),
    );
    return res?.data || res;
  } catch (error) {
    if (error.status || error.code === 'ERR_MAIL_NOT_CONFIGURED') throw error;
    throw formatApiError(error);
  }
}

export async function moveMessage(folder, uid, targetFolder) {
  try {
    const account = await getAccount();
    const fromPath = resolveFolderPath(folder);
    const toPath = resolveFolderPath(targetFolder);
    if (fromPath === toPath) {
      return { success: true, from: fromPath, to: toPath, skipped: true };
    }
    if (toPath === FOLDER_PATHS.archive) {
      await ensureFolder(toPath);
    }
    const api = new MessagesApi(getConfig());
    // Hostinger Mail API expects `targetFolder`, not `path`
    await api.moveMessage(account.mailboxResourceId, fromPath, Number(uid), {
      targetFolder: toPath,
    });
    return { success: true, from: fromPath, to: toPath };
  } catch (error) {
    if (error.status || error.code === 'ERR_MAIL_NOT_CONFIGURED') throw error;
    throw formatApiError(error);
  }
}

export async function deleteMessage(folder, uid, { permanent = false } = {}) {
  try {
    const path = resolveFolderPath(folder);
    const inTrash = path === FOLDER_PATHS.trash || /trash/i.test(path);
    if (!permanent && !inTrash) {
      return moveMessage(folder, uid, 'trash');
    }
    const account = await getAccount();
    const api = new MessagesApi(getConfig());
    await api.deleteMessage(account.mailboxResourceId, path, Number(uid));
    return { success: true, permanent: true };
  } catch (error) {
    if (error.status || error.code === 'ERR_MAIL_NOT_CONFIGURED') throw error;
    throw formatApiError(error);
  }
}

export async function downloadAttachment(folder, uid, attachmentId) {
  try {
    if (!attachmentId) {
      const err = new Error('Attachment id is required');
      err.status = 400;
      err.code = 'ERR_MAIL_ATTACHMENT_ID';
      throw err;
    }
    const account = await getAccount();
    const path = resolveFolderPath(folder);
    const api = new MessagesApi(getConfig());
    const res = await api.getMessageAttachment(
      account.mailboxResourceId,
      path,
      Number(uid),
      String(attachmentId),
      { responseType: 'arraybuffer' },
    );

    const buffer = Buffer.from(res.data || []);
    let contentType =
      res.headers?.['content-type'] ||
      res.headers?.['Content-Type'] ||
      'application/octet-stream';
    contentType = String(contentType).split(';')[0].trim() || 'application/octet-stream';

    const disposition =
      res.headers?.['content-disposition'] ||
      res.headers?.['Content-Disposition'] ||
      '';
    let filename = 'attachment';
    const match = String(disposition).match(/filename\*?=(?:UTF-8''|")?([^\";]+)"?/i);
    if (match?.[1]) {
      try {
        filename = decodeURIComponent(match[1].replace(/"/g, ''));
      } catch {
        filename = match[1].replace(/"/g, '');
      }
    }

    // Prefer metadata filename + mime when Hostinger returns octet-stream
    try {
      const detail = await api.getMessage(account.mailboxResourceId, path, Number(uid));
      const meta = (detail.data?.attachments || []).find(
        (a) => String(a.id || a.attachmentId || '') === String(attachmentId),
      );
      if (meta?.filename) filename = meta.filename;
      if (meta?.contentType && contentType === 'application/octet-stream') {
        contentType = String(meta.contentType).split(';')[0].trim();
      }
    } catch {
      // non-fatal
    }

    if (contentType === 'application/octet-stream') {
      const ext = String(filename).split('.').pop()?.toLowerCase();
      const byExt = {
        png: 'image/png',
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        gif: 'image/gif',
        webp: 'image/webp',
        bmp: 'image/bmp',
        svg: 'image/svg+xml',
        pdf: 'application/pdf',
        txt: 'text/plain',
        html: 'text/html',
        htm: 'text/html',
      };
      if (ext && byExt[ext]) contentType = byExt[ext];
    }

    return {
      buffer,
      contentType,
      filename,
      size: buffer.length,
    };
  } catch (error) {
    if (error.status || error.code === 'ERR_MAIL_NOT_CONFIGURED' || error.code === 'ERR_MAIL_ATTACHMENT_ID') {
      throw error;
    }
    throw formatApiError(error);
  }
}

export async function markRead(folder, uid, isRead = true) {
  if (isRead) {
    return updateFlags(folder, uid, { addFlags: ['\\Seen'], removeFlags: [] });
  }
  return updateFlags(folder, uid, { addFlags: [], removeFlags: ['\\Seen'] });
}

export async function markStarred(folder, uid, isStarred = true) {
  if (isStarred) {
    return updateFlags(folder, uid, { addFlags: ['\\Flagged'], removeFlags: [] });
  }
  return updateFlags(folder, uid, { addFlags: [], removeFlags: ['\\Flagged'] });
}

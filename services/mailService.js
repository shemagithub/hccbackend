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
    error?.message ||
    'Hostinger Mail API request failed';
  const code = data?.code || error?.code || 'ERR_MAIL_API';
  const err = new Error(message);
  err.status = status;
  err.code = code;
  err.params = data?.params;
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
  const plain =
    bodyText ||
    '';
  const previewSource = plain.replace(/\s+/g, ' ').trim();

  return {
    id: String(msg.uid),
    uid: msg.uid,
    path: msg.path,
    folder: folderIdFromPath(msg.path),
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
    attachmentMeta: msg.attachments || [],
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
  if (listed.folders.some((f) => f.path === path)) return listed;
  try {
    const account = await getAccount();
    const api = new FoldersApi(getConfig());
    const name = path.includes('.') ? path.split('.').pop() : path;
    await api.createFolder(account.mailboxResourceId, { path: name === path ? name : path });
  } catch (error) {
    // Folder may already exist or path format may need parent prefix — ignore if list already has it
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
    const toList = Array.isArray(to) ? to.filter(Boolean) : [to].filter(Boolean);
    const ccList = Array.isArray(cc) ? cc.filter(Boolean) : [];
    const bccList = Array.isArray(bcc) ? bcc.filter(Boolean) : [];

    if (toList.length === 0 && ccList.length === 0 && bccList.length === 0) {
      const err = new Error('At least one recipient is required');
      err.status = 400;
      err.code = 'ERR_MAIL_NO_RECIPIENTS';
      throw err;
    }

    const api = new SendApi(getConfig());
    const payload = {
      to: toList,
      cc: ccList,
      bcc: bccList,
      displayName: displayName || account.address,
      subject: subject || '',
      text: text || (html ? html.replace(/<[^>]+>/g, ' ') : ''),
      html: html || `<pre>${(text || '').replace(/</g, '&lt;')}</pre>`,
      attachments: (attachments || []).map((a) => ({
        filename: a.filename || a.name || 'attachment',
        content: a.content || '',
        contentType: a.contentType || a.type || 'application/octet-stream',
        cid: a.cid || '',
        encoding: a.encoding || 'base64',
      })),
    };

    await api.sendEmail(account.mailboxResourceId, payload);
    return {
      success: true,
      from: account.address,
      to: toList,
      subject: payload.subject,
    };
  } catch (error) {
    if (error.status || error.code === 'ERR_MAIL_NOT_CONFIGURED' || error.code === 'ERR_MAIL_NO_RECIPIENTS') {
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
    if (toPath === FOLDER_PATHS.archive) {
      await ensureFolder(toPath);
    }
    const api = new MessagesApi(getConfig());
    await api.moveMessage(account.mailboxResourceId, fromPath, Number(uid), {
      path: toPath,
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
    if (!permanent && path !== FOLDER_PATHS.trash) {
      return moveMessage(folder, uid, 'trash');
    }
    const account = await getAccount();
    const api = new MessagesApi(getConfig());
    await api.deleteMessage(account.mailboxResourceId, path, Number(uid));
    return { success: true };
  } catch (error) {
    if (error.status || error.code === 'ERR_MAIL_NOT_CONFIGURED') throw error;
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

import * as mailService from '../services/mailService.js';

function handleError(res, error, fallback = 'Mail operation failed') {
  const status = error?.status || 500;
  console.error('Mail API error:', error?.code || '', error?.message || error);
  return res.status(status).json({
    success: false,
    message: error?.message || fallback,
    code: error?.code,
    params: error?.params,
  });
}

export class MailController {
  static async getAccount(req, res) {
    try {
      const account = await mailService.getAccount(true);
      return res.json({ success: true, data: account });
    } catch (error) {
      return handleError(res, error, 'Failed to load mail account');
    }
  }

  static async listFolders(req, res) {
    try {
      const data = await mailService.listFolders();
      return res.json({ success: true, data });
    } catch (error) {
      return handleError(res, error, 'Failed to list folders');
    }
  }

  static async listMessages(req, res) {
    try {
      const folder = String(req.query.folder || 'inbox');
      const page = Math.max(1, Number(req.query.page) || 1);
      const perPage = Math.min(100, Math.max(1, Number(req.query.perPage) || 50));
      const sort = req.query.sort || '-date';

      const data =
        folder === 'starred'
          ? await mailService.listStarredMessages(page, perPage)
          : await mailService.listMessages(folder, page, perPage, sort);

      return res.json({ success: true, data });
    } catch (error) {
      return handleError(res, error, 'Failed to list messages');
    }
  }

  static async getMessage(req, res) {
    try {
      const uid = Number(req.params.uid);
      const folder = String(req.query.folder || 'inbox');
      if (!uid) {
        return res.status(400).json({ success: false, message: 'Invalid message uid' });
      }
      const data = await mailService.getMessage(folder, uid, true);
      return res.json({ success: true, data });
    } catch (error) {
      return handleError(res, error, 'Failed to load message');
    }
  }

  static async send(req, res) {
    try {
      const {
        to,
        cc,
        bcc,
        subject,
        text,
        html,
        displayName,
        attachments,
      } = req.body || {};

      const result = await mailService.sendEmail({
        to,
        cc,
        bcc,
        subject,
        text,
        html,
        displayName,
        attachments,
      });

      return res.json({ success: true, data: result, message: 'Email sent' });
    } catch (error) {
      return handleError(res, error, 'Failed to send email');
    }
  }

  static async updateFlags(req, res) {
    try {
      const uid = Number(req.params.uid);
      const folder = String(req.body?.folder || req.query.folder || 'inbox');
      const { isRead, isStarred, addFlags, removeFlags } = req.body || {};

      if (!uid) {
        return res.status(400).json({ success: false, message: 'Invalid message uid' });
      }

      if (typeof isRead === 'boolean') {
        await mailService.markRead(folder, uid, isRead);
      }
      if (typeof isStarred === 'boolean') {
        await mailService.markStarred(folder, uid, isStarred);
      }
      if (addFlags || removeFlags) {
        await mailService.updateFlags(folder, uid, {
          addFlags: addFlags || [],
          removeFlags: removeFlags || [],
        });
      }

      const data = await mailService.getMessage(folder, uid, false);
      return res.json({ success: true, data });
    } catch (error) {
      return handleError(res, error, 'Failed to update message flags');
    }
  }

  static async move(req, res) {
    try {
      const uid = Number(req.params.uid);
      const folder = String(req.body?.folder || req.query.folder || 'inbox');
      const target = String(req.body?.target || req.body?.targetFolder || 'trash');

      if (!uid) {
        return res.status(400).json({ success: false, message: 'Invalid message uid' });
      }

      const result = await mailService.moveMessage(folder, uid, target);
      return res.json({ success: true, data: result });
    } catch (error) {
      return handleError(res, error, 'Failed to move message');
    }
  }

  static async remove(req, res) {
    try {
      const uid = Number(req.params.uid);
      const folder = String(req.query.folder || req.body?.folder || 'inbox');
      const permanent =
        String(req.query.permanent || '') === 'true' ||
        req.body?.permanent === true;

      if (!uid) {
        return res.status(400).json({ success: false, message: 'Invalid message uid' });
      }

      const result = await mailService.deleteMessage(folder, uid, { permanent });
      return res.json({
        success: true,
        data: result,
        message: result.permanent ? 'Message permanently deleted' : 'Message moved to trash',
      });
    } catch (error) {
      return handleError(res, error, 'Failed to delete message');
    }
  }
}

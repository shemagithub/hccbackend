import Discussion from '../models/Discussion.js';

export class DiscussionController {
  // Create a new discussion
  static async createDiscussion(req, res) {
    try {
      await Discussion.ensureSchemaColumns();
      console.log('📥 Received discussion creation request');
      console.log('📦 Request body keys:', Object.keys(req.body || {}));
      console.log('📦 Request body:', {
        opportunityId: req.body?.opportunityId,
        messageType: req.body?.messageType,
        hasContent: !!req.body?.content,
        contentLength: req.body?.content?.length,
        hasFileData: !!req.body?.fileData,
        authorId: req.body?.authorId,
        authorName: req.body?.authorName
      });

      const {
        discussionId,
        opportunityId,
        content,
        messageType = 'text',
        fileData,
        fileName,
        fileSize,
        fileType,
        voiceDuration,
        authorId,
        authorName,
        authorProfileImage,
        replyToId
      } = req.body;

      // Validation
      if (!opportunityId) {
        console.error('❌ Missing opportunityId');
        return res.status(400).json({
          success: false,
          message: 'Missing required field: opportunityId is required'
        });
      }

      if (!authorId) {
        console.error('❌ Missing authorId');
        return res.status(400).json({
          success: false,
          message: 'Missing required field: authorId is required'
        });
      }

      if (!authorName) {
        console.error('❌ Missing authorName');
        return res.status(400).json({
          success: false,
          message: 'Missing required field: authorName is required'
        });
      }

      // Validate content based on message type
      if (messageType === 'text') {
        // For text messages, content can be empty if it's just whitespace, but we'll allow it
        const hasContent = content && content.trim().length > 0;
        const hasFile = fileData && fileData.trim().length > 0;
        
        if (!hasContent && !hasFile) {
          console.error('❌ Text message requires content or file');
          return res.status(400).json({
            success: false,
            message: 'Discussion content is required for text messages'
          });
        }
      }

      // Validate file data for non-text messages
      if (messageType !== 'text' && !fileData) {
        console.error(`❌ Missing file data for ${messageType} message`);
        return res.status(400).json({
          success: false,
          message: `File data is required for ${messageType} messages`
        });
      }

      // Validate file size (max 200MB for files, 50MB for images, 10MB for voice)
      const maxSizes = {
        file: 200 * 1024 * 1024, // 200MB
        image: 50 * 1024 * 1024,  // 50MB
        voice: 10 * 1024 * 1024   // 10MB
      };

      if (fileSize && maxSizes[messageType] && fileSize > maxSizes[messageType]) {
        return res.status(400).json({
          success: false,
          message: `File size exceeds maximum allowed size for ${messageType} messages`
        });
      }

      console.log('✅ Validation passed, creating discussion...');
      
      const discussion = await Discussion.create({
        discussionId,
        opportunityId,
        content: content || (messageType === 'image' ? 'Image' : messageType === 'file' ? fileName || 'File' : messageType === 'voice' ? 'Voice note' : ''),
        messageType,
        fileData,
        fileName,
        fileSize,
        fileType,
        voiceDuration,
        authorId,
        authorName,
        authorProfileImage,
        replyToId
      });

      console.log('✅ Discussion created successfully:', discussion.id);

      res.status(201).json({
        success: true,
        message: 'Discussion created successfully',
        data: discussion
      });
    } catch (error) {
      console.error('Create discussion error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create discussion',
        error: error.message
      });
    }
  }

  // Get all discussions
  static async getDiscussions(req, res) {
    try {
      console.log('📥 GET /api/discussions - Query params:', req.query);
      
      const {
        opportunityId,
        authorId,
        page = 1,
        limit = 50
      } = req.query;

      const filters = {
        opportunityId: opportunityId ? parseInt(opportunityId) : undefined,
        authorId: authorId ? parseInt(authorId) : undefined,
        limit: parseInt(limit),
        offset: (parseInt(page) - 1) * parseInt(limit)
      };

      console.log('📥 Filters:', filters);

      const discussions = await Discussion.findAll(filters);

      console.log('✅ Found discussions:', discussions.length);
      if (discussions.length > 0) {
        console.log('📋 First discussion:', {
          id: discussions[0].id,
          dbId: discussions[0].dbId,
          opportunityId: discussions[0].opportunityId,
          content: discussions[0].content?.substring(0, 50),
          messageType: discussions[0].messageType,
          authorName: discussions[0].authorName
        });
      }

      res.json({
        success: true,
        data: discussions,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: discussions.length
        }
      });
    } catch (error) {
      console.error('❌ Get discussions error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch discussions',
        error: error.message
      });
    }
  }

  // Get discussion by ID
  static async getDiscussionById(req, res) {
    try {
      const { id } = req.params;
      
      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Discussion ID is required'
        });
      }

      const discussion = await Discussion.findById(parseInt(id));
      
      if (!discussion) {
        return res.status(404).json({
          success: false,
          message: 'Discussion not found'
        });
      }

      res.json({
        success: true,
        data: discussion
      });
    } catch (error) {
      console.error('Get discussion by ID error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch discussion',
        error: error.message
      });
    }
  }

  // Update discussion
  static async updateDiscussion(req, res) {
    try {
      const { id } = req.params;
      const updateData = req.body;
      
      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Discussion ID is required'
        });
      }

      const discussion = await Discussion.findById(parseInt(id));

      if (!discussion) {
        return res.status(404).json({
          success: false,
          message: 'Discussion not found'
        });
      }

      const success = await Discussion.update(parseInt(id), updateData);

      if (success) {
        const updatedDiscussion = await Discussion.findById(parseInt(id));
        res.json({
          success: true,
          message: 'Discussion updated successfully',
          data: updatedDiscussion
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Failed to update discussion'
        });
      }
    } catch (error) {
      console.error('Update discussion error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update discussion',
        error: error.message
      });
    }
  }

  // Edit discussion content
  static async editDiscussion(req, res) {
    try {
      const { id } = req.params;
      const { content } = req.body;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Discussion ID is required'
        });
      }

      if (!content || !content.trim()) {
        return res.status(400).json({
          success: false,
          message: 'Content is required'
        });
      }

      const discussion = await Discussion.findById(parseInt(id));
      
      if (!discussion) {
        return res.status(404).json({
          success: false,
          message: 'Discussion not found'
        });
      }

      // Check if user is the author
      if (discussion.authorId !== req.staffId) {
        return res.status(403).json({
          success: false,
          message: 'You can only edit your own messages'
        });
      }

      const updated = await Discussion.update(parseInt(id), {
        content: content.trim()
      });

      if (updated) {
        res.json({
          success: true,
          message: 'Message updated successfully',
          data: updated
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Failed to update message'
        });
      }
    } catch (error) {
      console.error('Edit discussion error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to edit discussion',
        error: error.message
      });
    }
  }

  // Pin/Unpin discussion
  static async pinDiscussion(req, res) {
    try {
      const { id } = req.params;
      const { isPinned, pinnedBy } = req.body;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Discussion ID is required'
        });
      }

      const discussion = await Discussion.findById(parseInt(id));
      
      if (!discussion) {
        return res.status(404).json({
          success: false,
          message: 'Discussion not found'
        });
      }

      const updated = await Discussion.update(parseInt(id), {
        isPinned: isPinned !== undefined ? isPinned : !discussion.isPinned,
        pinnedBy: pinnedBy || req.staffId
      });

      if (updated) {
        res.json({
          success: true,
          message: updated.isPinned ? 'Message pinned successfully' : 'Message unpinned successfully',
          data: updated
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Failed to pin/unpin message'
        });
      }
    } catch (error) {
      console.error('Pin discussion error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to pin/unpin discussion',
        error: error.message
      });
    }
  }

  // Delete discussion (soft delete)
  static async deleteDiscussion(req, res) {
    try {
      const { id } = req.params;
      const { deletedBy } = req.body;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Discussion ID is required'
        });
      }

      const discussion = await Discussion.findById(parseInt(id));
      
      if (!discussion) {
        return res.status(404).json({
          success: false,
          message: 'Discussion not found'
        });
      }

      // Check if user is the author
      if (discussion.authorId !== req.staffId) {
        return res.status(403).json({
          success: false,
          message: 'You can only delete your own messages'
        });
      }

      const updated = await Discussion.update(parseInt(id), {
        isDeleted: true,
        deletedBy: deletedBy || req.staffId
      });

      if (updated) {
        res.json({
          success: true,
          message: 'Message deleted successfully',
          data: updated
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Failed to delete discussion'
        });
      }
    } catch (error) {
      console.error('Delete discussion error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete discussion',
        error: error.message
      });
    }
  }
}


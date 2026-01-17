import Document from '../models/Document.js';

// Ensure Document model is properly imported
if (!Document) {
  console.error('❌ Document model not imported correctly');
}

export class DocumentController {
  // Create a new document
  static async createDocument(req, res) {
    try {
      console.log('📋 Creating document - Request body keys:', Object.keys(req.body || {}));
      console.log('📋 Creating document - staffId:', req.staffId);
      
      const {
        documentId,
        projectId,
        name,
        description,
        fileType,
        fileSize,
        fileData,
        permissions = 'view_only',
        status = 'active',
        uploadedByName,
        uploadDate
      } = req.body;

      const uploadedBy = req.staffId || null;

      // Validation
      if (!name) {
        return res.status(400).json({
          success: false,
          message: 'Missing required field: name is required'
        });
      }
      
      console.log('📋 Document data - name:', name, 'fileType:', fileType, 'fileSize:', fileSize);

      // Validate file sizes if base64 data is provided (max 200MB per file)
      // Base64 encoding increases size by ~33%, so we check the base64 string length
      const maxFileSize = 200 * 1024 * 1024; // 200MB original file size
      
      if (fileData) {
        // Check if it's a base64 string (with or without data URL prefix)
        const base64Data = fileData.startsWith('data:') 
          ? fileData.split(',')[1] || ''
          : fileData;
        
        // Base64 string length is approximately 4/3 of original file size
        // So we check if base64 length * 3/4 exceeds maxFileSize
        const estimatedFileSize = (base64Data.length * 3) / 4;
        if (estimatedFileSize > maxFileSize) {
          return res.status(400).json({
            success: false,
            message: `File exceeds 200MB limit. Estimated size: ${(estimatedFileSize / 1024 / 1024).toFixed(2)}MB. Please upload a smaller file.`
          });
        }
        
        // Also check the actual base64 string size (should not exceed ~267MB for 200MB file)
        // MySQL max_allowed_packet is 300MB, so we need to ensure base64 doesn't exceed that
        const maxBase64Size = 300 * 1024 * 1024;
        if (base64Data.length > maxBase64Size) {
          return res.status(400).json({
            success: false,
            message: `File is too large after encoding (${(base64Data.length / 1024 / 1024).toFixed(2)}MB). MySQL packet size limit exceeded. Please upload a smaller file.`
          });
        }
      }

      // Validate status
      if (!['active', 'archived', 'pending'].includes(status)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid status value'
        });
      }

      // Validate permissions
      if (!['view_only', 'view_edit', 'full_access'].includes(permissions)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid permissions value'
        });
      }

      console.log('📋 Calling Document.create with:', {
        documentId,
        projectId: projectId || null,
        name,
        fileType,
        fileSize,
        hasFileData: !!fileData,
        fileDataLength: fileData ? fileData.length : 0,
        permissions,
        status,
        uploadedBy,
        uploadedByName
      });

      const document = await Document.create({
        documentId,
        projectId: projectId || null,
        name,
        description,
        fileType,
        fileSize,
        fileData,
        permissions,
        status,
        uploadedBy,
        uploadedByName,
        uploadDate
      });

      console.log('✅ Document created successfully:', document?.id || document?.document_id);

      res.status(201).json({
        success: true,
        message: 'Document uploaded successfully',
        data: document
      });
    } catch (error) {
      console.error('❌ Create document error:', error);
      console.error('❌ Error stack:', error.stack);
      console.error('❌ Error code:', error.code);
      console.error('❌ Error sqlMessage:', error.sqlMessage);
      res.status(500).json({
        success: false,
        message: 'Failed to upload document',
        error: error.message || 'Unknown error',
        details: process.env.NODE_ENV === 'development' ? {
          code: error.code,
          sqlMessage: error.sqlMessage,
          stack: error.stack
        } : undefined
      });
    }
  }

  // Get all documents
  static async getDocuments(req, res) {
    try {
      const {
        search,
        projectId,
        status,
        fileType,
        page = 1,
        limit = 50
      } = req.query;

      const filters = {
        search,
        projectId: projectId ? parseInt(projectId) : null,
        status,
        fileType,
        limit: parseInt(limit),
        offset: (parseInt(page) - 1) * parseInt(limit)
      };

      console.log('📋 Fetching documents with filters:', filters);

      const documents = await Document.findAll(filters);
      
      // Ensure stats call handles null projectId correctly
      const statsFilters = filters.projectId ? { projectId: filters.projectId } : {};
      let stats;
      try {
        stats = await Document.getStats(statsFilters);
      } catch (statsError) {
        console.error('Error fetching document stats:', statsError);
        // Use default stats if stats query fails
        stats = { total: String(documents.length), active: '0', archived: '0', pending: '0', pdf_count: '0', shared_count: '0' };
      }

      res.json({
        success: true,
        data: documents || [],
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: parseInt(stats?.total || documents.length)
        },
        stats: stats || { total: '0', active: '0', archived: '0', pending: '0', pdf_count: '0', shared_count: '0' }
      });
    } catch (error) {
      console.error('Get documents error:', error);
      console.error('Error stack:', error.stack);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch documents',
        error: error.message
      });
    }
  }

  // Get document by ID
  static async getDocumentById(req, res) {
    try {
      const { id } = req.params;
      
      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Document ID is required'
        });
      }

      let document = await Document.findById(parseInt(id));
      if (!document) {
        document = await Document.findByDocumentId(id);
      }
      
      if (!document) {
        return res.status(404).json({
          success: false,
          message: 'Document not found'
        });
      }

      res.json({
        success: true,
        data: document
      });
    } catch (error) {
      console.error('Get document by ID error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch document',
        error: error.message
      });
    }
  }

  // Update document
  static async updateDocument(req, res) {
    try {
      const { id } = req.params;
      const updateData = req.body;
      
      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Document ID is required'
        });
      }

      const docId = parseInt(id);
      let document = await Document.findById(docId);
      if (!document) {
        document = await Document.findByDocumentId(id);
        if (!document) {
          return res.status(404).json({
            success: false,
            message: 'Document not found'
          });
        }
      }

      const updated = await Document.update(document.dbId || docId, updateData);
      
      if (!updated) {
        return res.status(400).json({
          success: false,
          message: 'No valid fields to update'
        });
      }

      const updatedDocument = await Document.findById(document.dbId || docId);

      res.json({
        success: true,
        message: 'Document updated successfully',
        data: updatedDocument
      });
    } catch (error) {
      console.error('Update document error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update document',
        error: error.message
      });
    }
  }

  // Delete document
  static async deleteDocument(req, res) {
    try {
      const { id } = req.params;
      
      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Document ID is required'
        });
      }

      const docId = parseInt(id);
      let document = await Document.findById(docId);
      if (!document) {
        document = await Document.findByDocumentId(id);
        if (!document) {
          return res.status(404).json({
            success: false,
            message: 'Document not found'
          });
        }
      }

      await Document.delete(document.dbId || docId);

      res.json({
        success: true,
        message: 'Document deleted successfully'
      });
    } catch (error) {
      console.error('Delete document error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete document',
        error: error.message
      });
    }
  }

  // Get document statistics
  static async getDocumentStats(req, res) {
    try {
      const { projectId } = req.query;
      
      const stats = await Document.getStats(projectId ? parseInt(projectId) : null);

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      console.error('Get document stats error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch document statistics',
        error: error.message
      });
    }
  }
}


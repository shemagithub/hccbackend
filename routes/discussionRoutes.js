import express from 'express';
import { DiscussionController } from '../controllers/discussionController.js';

const router = express.Router();

// Test route to verify router is working
router.get('/test', (req, res) => {
  res.json({ success: true, message: 'Discussion routes are working!' });
});

// Get all discussions (must come before /:id route)
router.get('/', async (req, res) => {
  console.log('GET /api/discussions - Query params:', req.query);
  try {
    await DiscussionController.getDiscussions(req, res);
  } catch (error) {
    console.error('Error in getDiscussions route:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// Create a new discussion
router.post('/', async (req, res) => {
  console.log('POST /api/discussions - Body keys:', Object.keys(req.body || {}));
  try {
    await DiscussionController.createDiscussion(req, res);
  } catch (error) {
    console.error('Error in createDiscussion route:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// Get discussion by ID
router.get('/:id', async (req, res) => {
  console.log('GET /api/discussions/:id - ID:', req.params.id);
  try {
    await DiscussionController.getDiscussionById(req, res);
  } catch (error) {
    console.error('Error in getDiscussionById route:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// Update discussion
router.put('/:id', DiscussionController.updateDiscussion);

// Edit discussion (content only)
router.patch('/:id/edit', DiscussionController.editDiscussion);

// Pin/Unpin discussion
router.patch('/:id/pin', DiscussionController.pinDiscussion);

// Delete discussion
router.delete('/:id', DiscussionController.deleteDiscussion);

export default router;


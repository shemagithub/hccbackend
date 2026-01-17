import express from 'express';
import { ReviewController } from '../controllers/reviewController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Create a new review
router.post('/', ReviewController.createReview);

// Get review statistics
router.get('/stats', ReviewController.getReviewStats);

// Get all reviews
router.get('/', ReviewController.getReviews);

// Get reviews by item type and ID
router.get('/item/:itemType/:itemId', ReviewController.getReviewsByItem);

// Get review by ID
router.get('/:id', ReviewController.getReviewById);

// Update review
router.put('/:id', ReviewController.updateReview);

// Delete review
router.delete('/:id', ReviewController.deleteReview);

export default router;

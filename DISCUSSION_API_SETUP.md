# Discussion API Setup Guide

## Routes Registered
The discussion routes are registered in `backend/index.js`:
- Route: `/api/discussions`
- File: `backend/routes/discussionRoutes.js`

## Available Endpoints

### Test Route
- `GET /api/discussions/test` - Test route to verify router is working

### Main Routes
- `GET /api/discussions` - Get all discussions (supports `opportunityId` query param)
- `POST /api/discussions` - Create a new discussion
- `GET /api/discussions/:id` - Get discussion by ID
- `PUT /api/discussions/:id` - Update discussion
- `DELETE /api/discussions/:id` - Delete discussion

## Database Schema

The `discussions` table includes:
- `message_type` ENUM('text', 'image', 'voice', 'file')
- `file_data` LONGTEXT (for Base64 file storage)
- `file_name`, `file_size`, `file_type`
- `voice_duration` (for voice notes)

## Troubleshooting 404 Errors

If you're getting 404 errors:

1. **Restart the backend server:**
   ```bash
   cd backend
   npm run dev
   # or
   npm start
   ```

2. **Verify routes are loaded:**
   - Check console logs when server starts
   - Look for: `💭 Discussions API: http://localhost:5000/api/discussions`

3. **Test the route:**
   ```bash
   curl http://localhost:5000/api/discussions/test
   ```
   Should return: `{"success":true,"message":"Discussion routes are working!"}`

4. **Check database table:**
   - Run migration: `npm run add-message-types-to-discussions`
   - Or run: `npm run init-all-tables` (includes migration)

5. **Verify route registration:**
   - Check `backend/index.js` line 54: `app.use('/api/discussions', discussionRoutes);`
   - Check `backend/routes/discussionRoutes.js` exports correctly

## Example API Calls

### Get discussions for an opportunity:
```bash
GET http://localhost:5000/api/discussions?opportunityId=8
```

### Create a text discussion:
```json
POST http://localhost:5000/api/discussions
{
  "opportunityId": 8,
  "content": "Hello team!",
  "messageType": "text",
  "authorId": 1,
  "authorName": "John Doe"
}
```

### Create an image discussion:
```json
POST http://localhost:5000/api/discussions
{
  "opportunityId": 8,
  "content": "Check this out",
  "messageType": "image",
  "fileData": "data:image/png;base64,iVBORw0KG...",
  "fileName": "screenshot.png",
  "fileSize": 123456,
  "fileType": "image/png",
  "authorId": 1,
  "authorName": "John Doe"
}
```

### Create a voice note:
```json
POST http://localhost:5000/api/discussions
{
  "opportunityId": 8,
  "content": "Voice note",
  "messageType": "voice",
  "fileData": "data:audio/webm;base64,...",
  "fileName": "voice_note.webm",
  "fileSize": 45678,
  "fileType": "audio/webm",
  "voiceDuration": 30,
  "authorId": 1,
  "authorName": "John Doe"
}
```


# Staff API Documentation

This document describes the Staff API endpoints for managing staff members in the HCC system.

## Base URL
```
http://localhost:3001/api/staff
```

## Authentication
Some endpoints may require authentication. Include appropriate headers if needed.

## Endpoints

### 1. Create Staff Member
**POST** `/`

Creates a new staff member.

#### Request Body
```json
{
  "firstName": "John",
  "lastName": "Doe",
  "email": "john.doe@company.com",
  "phone": "+1-555-0101",
  "password": "Password123!",
  "departmentId": 1,
  "position": "Senior Software Engineer",
  "role": "employee",
  "status": "active",
  "profileImage": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQ...",
  "notes": "Lead developer for the main product"
}
```

#### Required Fields
- `firstName` (string): Staff member's first name
- `lastName` (string): Staff member's last name
- `email` (string): Valid email address (must be unique)
- `password` (string): Password (min 8 chars, must contain uppercase, lowercase, and number)
- `position` (string): Job position/title

#### Optional Fields
- `phone` (string): Phone number
- `departmentId` (number): Department ID (must exist in departments table)
- `role` (string): Staff role - one of: admin, manager, employee, viewer, project_manager, team_lead
- `status` (string): Account status - one of: active, inactive, pending
- `profileImage` (string): Base64 encoded image data
- `notes` (string): Additional notes

#### Response
```json
{
  "success": true,
  "message": "Staff member created successfully",
  "data": {
    "id": 1,
    "firstName": "John",
    "lastName": "Doe",
    "email": "john.doe@company.com",
    "phone": "+1-555-0101",
    "department": "Engineering",
    "departmentId": 1,
    "departmentName": "Engineering",
    "departmentCode": "ENG-001",
    "position": "Senior Software Engineer",
    "role": "employee",
    "status": "active",
    "profileImage": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQ...",
    "avatar": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQ...",
    "notes": "Lead developer for the main product",
    "lastLogin": null,
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-15T10:30:00.000Z"
  }
}
```

### 2. Get All Staff Members
**GET** `/`

Retrieves a list of staff members with optional filtering and pagination.

#### Query Parameters
- `search` (string): Search in first name, last name, email, or position
- `role` (string): Filter by role
- `status` (string): Filter by status
- `departmentId` (number): Filter by department ID
- `page` (number): Page number (default: 1)
- `limit` (number): Items per page (default: 10)

#### Example Request
```
GET /api/staff?search=john&role=employee&status=active&page=1&limit=10
```

#### Response
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "firstName": "John",
      "lastName": "Doe",
      "email": "john.doe@company.com",
      "phone": "+1-555-0101",
      "department": "Engineering",
      "departmentId": 1,
      "departmentName": "Engineering",
      "departmentCode": "ENG-001",
      "position": "Senior Software Engineer",
      "role": "employee",
      "status": "active",
      "profileImage": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQ...",
      "avatar": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQ...",
      "notes": "Lead developer for the main product",
      "lastLogin": "2024-01-15T09:00:00.000Z",
      "createdAt": "2024-01-15T10:30:00.000Z",
      "updatedAt": "2024-01-15T10:30:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 25
  },
  "stats": {
    "total": 25,
    "active": 20,
    "pending": 3,
    "inactive": 2
  }
}
```

### 3. Get Staff Member by ID
**GET** `/:id`

Retrieves a specific staff member by their ID.

#### Path Parameters
- `id` (number): Staff member ID

#### Response
```json
{
  "success": true,
  "data": {
    "id": 1,
    "firstName": "John",
    "lastName": "Doe",
    "email": "john.doe@company.com",
    "phone": "+1-555-0101",
    "department": "Engineering",
    "departmentId": 1,
    "departmentName": "Engineering",
    "departmentCode": "ENG-001",
    "position": "Senior Software Engineer",
    "role": "employee",
    "status": "active",
    "profileImage": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQ...",
    "avatar": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQ...",
    "notes": "Lead developer for the main product",
    "lastLogin": "2024-01-15T09:00:00.000Z",
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-15T10:30:00.000Z"
  }
}
```

### 4. Update Staff Member
**PUT** `/:id`

Updates an existing staff member.

#### Path Parameters
- `id` (number): Staff member ID

#### Request Body
```json
{
  "firstName": "John",
  "lastName": "Smith",
  "email": "john.smith@company.com",
  "phone": "+1-555-0102",
  "departmentId": 2,
  "position": "Lead Software Engineer",
  "role": "manager",
  "status": "active",
  "profileImage": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQ...",
  "notes": "Promoted to lead developer"
}
```

#### Response
```json
{
  "success": true,
  "message": "Staff member updated successfully",
  "data": {
    "id": 1,
    "firstName": "John",
    "lastName": "Smith",
    "email": "john.smith@company.com",
    "phone": "+1-555-0102",
    "department": "Marketing",
    "departmentId": 2,
    "departmentName": "Marketing",
    "departmentCode": "MKT-001",
    "position": "Lead Software Engineer",
    "role": "manager",
    "status": "active",
    "profileImage": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQ...",
    "avatar": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQ...",
    "notes": "Promoted to lead developer",
    "lastLogin": "2024-01-15T09:00:00.000Z",
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-15T11:00:00.000Z"
  }
}
```

### 5. Delete Staff Member
**DELETE** `/:id`

Deletes a staff member.

#### Path Parameters
- `id` (number): Staff member ID

#### Response
```json
{
  "success": true,
  "message": "Staff member deleted successfully"
}
```

### 6. Get Staff Statistics
**GET** `/stats`

Retrieves staff statistics including counts by role and department.

#### Response
```json
{
  "success": true,
  "data": {
    "total": 25,
    "active": 20,
    "pending": 3,
    "inactive": 2,
    "uniqueRoles": 6,
    "uniqueDepartments": 8,
    "byRole": {
      "admin": 1,
      "manager": 5,
      "employee": 15,
      "viewer": 2,
      "project_manager": 1,
      "team_lead": 1
    },
    "byDepartment": {
      "Engineering": 8,
      "Marketing": 4,
      "Sales": 3,
      "HR": 2,
      "Finance": 2,
      "Operations": 3,
      "Customer Service": 2,
      "IT": 1
    }
  }
}
```

### 7. Check Email Availability
**GET** `/check-email/:email`

Checks if an email address is available for use.

#### Path Parameters
- `email` (string): Email address to check

#### Query Parameters
- `excludeId` (number, optional): Staff member ID to exclude from check (for updates)

#### Response
```json
{
  "success": true,
  "exists": false,
  "message": "Email is available"
}
```

### 8. Authenticate Staff Member
**POST** `/authenticate`

Authenticates a staff member with email and password.

#### Request Body
```json
{
  "email": "john.doe@company.com",
  "password": "Password123!"
}
```

#### Response
```json
{
  "success": true,
  "message": "Authentication successful",
  "data": {
    "id": 1,
    "firstName": "John",
    "lastName": "Doe",
    "email": "john.doe@company.com",
    "phone": "+1-555-0101",
    "department": "Engineering",
    "departmentId": 1,
    "departmentName": "Engineering",
    "departmentCode": "ENG-001",
    "position": "Senior Software Engineer",
    "role": "employee",
    "status": "active",
    "profileImage": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQ...",
    "avatar": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQ...",
    "notes": "Lead developer for the main product",
    "lastLogin": "2024-01-15T09:00:00.000Z",
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-15T10:30:00.000Z"
  }
}
```

## Error Responses

### 400 Bad Request
```json
{
  "success": false,
  "message": "Missing required fields: firstName, lastName, email, password, and position are required"
}
```

### 404 Not Found
```json
{
  "success": false,
  "message": "Staff member not found"
}
```

### 409 Conflict
```json
{
  "success": false,
  "message": "Email already exists"
}
```

### 500 Internal Server Error
```json
{
  "success": false,
  "message": "Failed to create staff member",
  "error": "Database connection failed"
}
```

## Data Validation

### Password Requirements
- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number

### Email Validation
- Must be a valid email format
- Must be unique across all staff members

### Role Values
- `admin`: Full system access
- `manager`: Department management
- `employee`: Standard employee access
- `viewer`: Read-only access
- `project_manager`: Project management
- `team_lead`: Team leadership

### Status Values
- `active`: Can login and use system
- `inactive`: Disabled account
- `pending`: Awaiting approval

## Database Schema

The staff table includes the following fields:
- `id`: Primary key
- `first_name`: Staff member's first name
- `last_name`: Staff member's last name
- `email`: Unique email address
- `phone`: Phone number (optional)
- `password_hash`: Hashed password
- `department_id`: Foreign key to departments table
- `position`: Job position/title
- `role`: Staff role enum
- `status`: Account status enum
- `profile_image`: Base64 encoded image data
- `notes`: Additional notes
- `last_login`: Last login timestamp
- `created_at`: Creation timestamp
- `updated_at`: Last update timestamp

## Security Notes

- Passwords are hashed using bcrypt with salt rounds of 12
- Email addresses are validated for format and uniqueness
- Profile images are stored as base64 strings (consider file storage for production)
- All database queries use parameterized statements to prevent SQL injection
- Input validation is performed on all endpoints

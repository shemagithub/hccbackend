# Department Management API

## Overview
This API provides comprehensive department management functionality including CRUD operations, search, filtering, and statistics.

## Base URL
```
http://localhost:3001/api/departments
```

## Endpoints

### 1. Create Department
**POST** `/api/departments`

Creates a new department with the provided information.

#### Request Body
```json
{
  "name": "Engineering",
  "description": "Software development and technical operations",
  "departmentCode": "ENG-001",
  "location": "Headquarters - Floor 2",
  "budget": 500000.00,
  "phone": "+1-555-0101",
  "email": "engineering@company.com",
  "website": "https://engineering.company.com",
  "status": "active",
  "notes": "Focus on agile development practices"
}
```

#### Required Fields
- `name` (string): Department name
- `description` (string): Department description
- `departmentCode` (string): Unique department code (uppercase letters, numbers, hyphens only)
- `location` (string): Department location

#### Optional Fields
- `budget` (number): Annual budget
- `phone` (string): Contact phone number
- `email` (string): Contact email address
- `website` (string): Department website URL
- `status` (string): "active" or "inactive" (default: "active")
- `notes` (string): Additional notes

#### Response
```json
{
  "success": true,
  "message": "Department created successfully",
  "data": {
    "id": 1,
    "name": "Engineering",
    "description": "Software development and technical operations",
    "departmentCode": "ENG-001",
    "location": "Headquarters - Floor 2",
    "budget": 500000.00,
    "phone": "+1-555-0101",
    "email": "engineering@company.com",
    "website": "https://engineering.company.com",
    "status": "active",
    "notes": "Focus on agile development practices",
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-15T10:30:00.000Z"
  }
}
```

### 2. Get All Departments
**GET** `/api/departments`

Retrieves all departments with optional filtering and pagination.

#### Query Parameters
- `search` (string): Search in name, description, or department code
- `status` (string): Filter by status ("active" or "inactive")
- `location` (string): Filter by location
- `page` (number): Page number (default: 1)
- `limit` (number): Items per page (default: 10)

#### Example Request
```
GET /api/departments?search=engineering&status=active&page=1&limit=5
```

#### Response
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "Engineering",
      "description": "Software development and technical operations",
      "departmentCode": "ENG-001",
      "location": "Headquarters - Floor 2",
      "budget": 500000.00,
      "phone": "+1-555-0101",
      "email": "engineering@company.com",
      "website": "https://engineering.company.com",
      "status": "active",
      "notes": "Focus on agile development practices",
      "createdAt": "2024-01-15T10:30:00.000Z",
      "updatedAt": "2024-01-15T10:30:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 5,
    "total": 8
  },
  "stats": {
    "total": 8,
    "active": 7,
    "inactive": 1,
    "totalBudget": 2230000.00
  }
}
```

### 3. Get Department by ID
**GET** `/api/departments/:id`

Retrieves a specific department by its ID.

#### Path Parameters
- `id` (number): Department ID

#### Response
```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "Engineering",
    "description": "Software development and technical operations",
    "departmentCode": "ENG-001",
    "location": "Headquarters - Floor 2",
    "budget": 500000.00,
    "phone": "+1-555-0101",
    "email": "engineering@company.com",
    "website": "https://engineering.company.com",
    "status": "active",
    "notes": "Focus on agile development practices",
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-15T10:30:00.000Z"
  }
}
```

### 4. Update Department
**PUT** `/api/departments/:id`

Updates an existing department.

#### Path Parameters
- `id` (number): Department ID

#### Request Body
```json
{
  "name": "Software Engineering",
  "description": "Updated description",
  "budget": 600000.00,
  "status": "active"
}
```

#### Response
```json
{
  "success": true,
  "message": "Department updated successfully",
  "data": {
    "id": 1,
    "name": "Software Engineering",
    "description": "Updated description",
    "departmentCode": "ENG-001",
    "location": "Headquarters - Floor 2",
    "budget": 600000.00,
    "phone": "+1-555-0101",
    "email": "engineering@company.com",
    "website": "https://engineering.company.com",
    "status": "active",
    "notes": "Focus on agile development practices",
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-15T11:45:00.000Z"
  }
}
```

### 5. Delete Department
**DELETE** `/api/departments/:id`

Deletes a department.

#### Path Parameters
- `id` (number): Department ID

#### Response
```json
{
  "success": true,
  "message": "Department deleted successfully"
}
```

### 6. Get Department Statistics
**GET** `/api/departments/stats`

Retrieves department statistics.

#### Response
```json
{
  "success": true,
  "data": {
    "total": 8,
    "active": 7,
    "inactive": 1,
    "totalBudget": 2230000.00
  }
}
```

### 7. Check Department Code Availability
**GET** `/api/departments/check-code/:code`

Checks if a department code is available.

#### Path Parameters
- `code` (string): Department code to check

#### Query Parameters
- `excludeId` (number): Exclude this ID from the check (useful for updates)

#### Response
```json
{
  "success": true,
  "exists": false,
  "message": "Department code is available"
}
```

## Error Responses

### Validation Error (400)
```json
{
  "success": false,
  "message": "Missing required fields: name, description, departmentCode, and location are required"
}
```

### Conflict Error (409)
```json
{
  "success": false,
  "message": "Department code already exists"
}
```

### Not Found Error (404)
```json
{
  "success": false,
  "message": "Department not found"
}
```

### Server Error (500)
```json
{
  "success": false,
  "message": "Failed to create department",
  "error": "Detailed error message"
}
```

## Validation Rules

### Department Code
- Must contain only uppercase letters, numbers, and hyphens
- Must be unique across all departments
- Examples: "ENG-001", "HR-002", "MKT-001"

### Email
- Must be a valid email format
- Optional field

### Website
- Must start with "http://" or "https://"
- Optional field

### Budget
- Must be a valid number
- Optional field

### Status
- Must be either "active" or "inactive"
- Defaults to "active"

## Database Schema

```sql
CREATE TABLE departments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  department_code VARCHAR(50) NOT NULL UNIQUE,
  location VARCHAR(255) NOT NULL,
  budget DECIMAL(15,2) NULL,
  phone VARCHAR(20) NULL,
  email VARCHAR(255) NULL,
  website VARCHAR(500) NULL,
  status ENUM('active', 'inactive') DEFAULT 'active',
  notes TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

## Sample Data

The API comes with sample department data including:
- Engineering (ENG-001)
- Marketing (MKT-001)
- Sales (SAL-001)
- Human Resources (HR-001)
- Finance (FIN-001)
- Operations (OPS-001)
- Customer Service (CS-001)
- Information Technology (IT-001)

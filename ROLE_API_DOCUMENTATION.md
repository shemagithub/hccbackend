# Role Management API

## Overview
This API provides comprehensive role management functionality including CRUD operations, search, filtering, and statistics.

## Base URL
```
http://localhost:5000/api/roles
```

## Endpoints

### 1. Create Role
**POST** `/api/roles`

Creates a new role with the provided information.

#### Request Body
```json
{
  "name": "Project Manager",
  "description": "Manage projects and coordinate team activities",
  "permissions": ["project_management", "team_management", "task_assignment"],
  "departmentId": 1,
  "status": "active",
  "notes": "Responsible for project planning and execution"
}
```

#### Required Fields
- `name` (string): Role name (must be unique)
- `description` (string): Role description

#### Optional Fields
- `permissions` (array): Array of permission strings
- `departmentId` (number): ID of the department this role belongs to
- `status` (string): "active" or "inactive" (default: "active")
- `notes` (string): Additional notes

#### Response
```json
{
  "success": true,
  "message": "Role created successfully",
  "data": {
    "id": 1,
    "name": "Project Manager",
    "description": "Manage projects and coordinate team activities",
    "permissions": ["project_management", "team_management", "task_assignment"],
    "departmentId": 1,
    "departmentName": "Engineering",
    "departmentCode": "ENG-001",
    "status": "active",
    "notes": "Responsible for project planning and execution",
    "userCount": 0,
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-15T10:30:00.000Z"
  }
}
```

### 2. Get All Roles
**GET** `/api/roles`

Retrieves all roles with optional filtering and pagination.

#### Query Parameters
- `search` (string): Search in name or description
- `status` (string): Filter by status ("active" or "inactive")
- `departmentId` (number): Filter by department ID
- `page` (number): Page number (default: 1)
- `limit` (number): Items per page (default: 10)

#### Example Request
```
GET /api/roles?search=manager&status=active&page=1&limit=5
```

#### Response
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "Project Manager",
      "description": "Manage projects and coordinate team activities",
      "permissions": ["project_management", "team_management"],
      "departmentId": 1,
      "departmentName": "Engineering",
      "departmentCode": "ENG-001",
      "status": "active",
      "notes": "Responsible for project planning",
      "userCount": 5,
      "createdAt": "2024-01-15T10:30:00.000Z",
      "updatedAt": "2024-01-15T10:30:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 5,
    "total": 10
  },
  "stats": {
    "total": 10,
    "active": 8,
    "inactive": 2
  }
}
```

### 3. Get Role by ID
**GET** `/api/roles/:id`

Retrieves a specific role by its ID.

#### Path Parameters
- `id` (number): Role ID

#### Response
```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "Project Manager",
    "description": "Manage projects and coordinate team activities",
    "permissions": ["project_management", "team_management"],
    "departmentId": 1,
    "departmentName": "Engineering",
    "departmentCode": "ENG-001",
    "status": "active",
    "notes": "Responsible for project planning",
    "userCount": 5,
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-15T10:30:00.000Z"
  }
}
```

### 4. Update Role
**PUT** `/api/roles/:id`

Updates an existing role.

#### Path Parameters
- `id` (number): Role ID

#### Request Body
```json
{
  "name": "Senior Project Manager",
  "description": "Updated description",
  "status": "active"
}
```

#### Response
```json
{
  "success": true,
  "message": "Role updated successfully",
  "data": {
    "id": 1,
    "name": "Senior Project Manager",
    "description": "Updated description",
    "permissions": ["project_management", "team_management"],
    "departmentId": 1,
    "departmentName": "Engineering",
    "departmentCode": "ENG-001",
    "status": "active",
    "notes": "Responsible for project planning",
    "userCount": 5,
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-15T11:45:00.000Z"
  }
}
```

### 5. Delete Role
**DELETE** `/api/roles/:id`

Deletes a role.

#### Path Parameters
- `id` (number): Role ID

#### Response
```json
{
  "success": true,
  "message": "Role deleted successfully"
}
```

### 6. Get Role Statistics
**GET** `/api/roles/stats`

Retrieves role statistics.

#### Response
```json
{
  "success": true,
  "data": {
    "total": 10,
    "active": 8,
    "inactive": 2
  }
}
```

### 7. Check Role Name Availability
**GET** `/api/roles/check-name/:name`

Checks if a role name is available.

#### Path Parameters
- `name` (string): Role name to check

#### Query Parameters
- `excludeId` (number): Exclude this ID from the check (useful for updates)

#### Response
```json
{
  "success": true,
  "exists": false,
  "message": "Role name is available"
}
```

## Error Responses

### Validation Error (400)
```json
{
  "success": false,
  "message": "Name and description are required"
}
```

### Conflict Error (409)
```json
{
  "success": false,
  "message": "Role name already exists"
}
```

### Not Found Error (404)
```json
{
  "success": false,
  "message": "Role not found"
}
```

### Server Error (500)
```json
{
  "success": false,
  "message": "Failed to create role",
  "error": "Detailed error message"
}
```

## Database Schema

```sql
CREATE TABLE roles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  description TEXT NOT NULL,
  permissions JSON DEFAULT NULL,
  department_id INT NULL,
  status ENUM('active', 'inactive') DEFAULT 'active',
  notes TEXT NULL,
  user_count INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL
);
```

## Sample Data

The API comes with sample role data including:
- Administrator (Engineering)
- Project Manager (Engineering)
- Team Lead (Engineering)
- Marketing Manager (Marketing)
- Sales Representative (Sales)
- HR Manager (Human Resources)
- Finance Analyst (Finance)
- Operations Manager (Operations)
- Customer Service Rep (Customer Service)
- IT Support (Information Technology)

## Permission System

Roles can have various permissions including:
- `user_management`: Create, edit, and delete users
- `system_settings`: Configure system-wide settings
- `data_export`: Export data from the system
- `audit_logs`: View system audit logs
- `role_management`: Create and manage user roles
- `project_management`: Create and manage projects
- `financial_access`: Access financial data and reports
- `report_generation`: Generate and create reports
- `team_management`: Manage team members and assignments
- `task_assignment`: Assign tasks to team members
- `client_communication`: Communicate with clients
- `project_view`: View project information
- `report_view`: View reports and analytics
- `task_view`: View assigned tasks
- `profile_edit`: Edit personal profile information
- `time_tracking`: Track time on projects and tasks
- `profile_view`: View profile information

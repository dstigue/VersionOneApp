# VersionOne Story & Task Copier

A utility tool for copying VersionOne stories and their associated tasks between timeboxes while preserving key attributes and relationships.

## Purpose

This application solves the common need to duplicate stories and tasks across different timeboxes (sprints/iterations) in VersionOne. It maintains important story attributes like:

- Story descriptions
- Estimates
- Owners
- Parent relationships
- Associated tasks with their descriptions, categories, and owners

## Features

- User-friendly web interface
- Filter timeboxes by Owner and Schedule
- Select source stories with checkbox selection
- Copy multiple stories at once
- Maintain relationships with parent items
- Preserve task relationships and attributes
- Support for different authentication methods (NTLM, Basic Auth, Token)

## Setup & Installation

### Prerequisites

- Node.js (v12+)
- PowerShell (for Windows users)

### Installation

1. Clone this repository
2. Run the setup script:

```powershell
.\setup_and_run.ps1
```

The script will:
- Check for and install Node.js if needed
- Set up any required proxy configurations
- Install dependencies
- Start the application server

## Usage

1. **Configure Settings**:
   - Base URL: Enter your VersionOne instance URL
   - Authentication Method: Choose between NTLM, Basic Auth, or Token
   - If using Basic Auth, enter your username and password

   > **Test Server**: You can use the VersionOne test server at https://www16.v1host.com/api-examples/
   >
   > **Credentials**:
   > - Username: `admin`
   > - Password: `admin` 
   > - Authentication: Basic Auth

2. **Select Source Timebox**:
   - Use the filters to narrow down the list of timeboxes
   - Choose the source timebox containing stories you want to copy

3. **Load & Select Stories**:
   - Click "Load Stories" to view stories in the source timebox
   - Select stories to copy by checking the boxes

4. **Select Target Timebox**:
   - Choose the timebox where stories should be copied to

5. **Select Target Parent (Optional)**:
   - Optionally select a parent for the copied stories
   - If not selected, the original parent relationship will be maintained if possible

6. **Copy Stories**:
   - Click "Copy Selected Stories" to start the copy process
   - Progress will be displayed in the status area

## Configuration

The application stores your settings in your browser's local storage. The settings include:
- VersionOne instance URL
- Authentication method
- Credentials (token or username/password)
- Target parent asset type

## Authentication Methods

1. **NTLM Authentication**:
   - Used for on-premise instances with Windows authentication
   - Uses your current Windows credentials

2. **Basic Authentication**:
   - Username/password authentication
   - Works with the VersionOne test server (admin/admin)

3. **Token Authentication**:
   - Uses access tokens for API access
   - Most secure option for production instances

## Troubleshooting

If you encounter issues:

1. Check browser console for detailed error messages
2. Verify your authentication credentials
3. Ensure the target timebox is compatible with source stories (same project/scope)
4. Check if your VersionOne instance requires a proxy for external connections

## Security Notes

- Credentials are stored in your browser's local storage
- Use with caution when storing passwords (Basic Auth)
- Consider using Token authentication for improved security
- HTTPS_PROXY settings may be configured in the powershell script if needed

## License

This project is for internal use only. All rights reserved. 
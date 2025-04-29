# PowerShell Script to Setup and Run the VersionOne Story Copier Server
Write-Host "Script execution started."

param(
    # Internal flag to indicate the script was relaunched for elevation
    [switch]$Relaunched
)

# --- Elevation Check ---
$IsElevated = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]"Administrator")

if (-NOT $IsElevated) {
    # Check if the -Relaunched switch was explicitly passed
    if ($PSBoundParameters.ContainsKey('Relaunched')) {
        # If we were relaunched but are still not elevated, elevation failed.
        Write-Error "Failed to elevate privileges after relaunch. Please run the script manually using 'Run as administrator'."
        Exit 1
    } else {
        # Not elevated and not relaunched yet, attempt to relaunch.
        Write-Warning "This script requires elevated privileges. Attempting to relaunch with elevation..."
        try {
            # Relaunch PowerShell as admin, passing the current script file path and the -Relaunched switch
            $scriptPath = $MyInvocation.MyCommand.Path
            $arguments = "-NoProfile -ExecutionPolicy Bypass -File ""$scriptPath"" -Relaunched"
            Start-Process powershell.exe -Verb RunAs -ArgumentList $arguments
            Write-Host "Exiting original non-elevated process."
            Exit # Exit the current non-elevated instance
        } catch {
            Write-Error "Failed to start relaunch process with elevated privileges. Please run the script manually using 'Run as administrator'. Error: $($_.Exception.Message)"
            Exit 1
        }
    }
}

# Script continues here if running with elevated privileges
Write-Host "Running with elevated privileges." -ForegroundColor Green

# Exit script immediately if any command fails
# $ErrorActionPreference = 'Stop' # Uncomment this for stricter error handling if desired

Write-Host "Starting setup..." -ForegroundColor Cyan

# --- Check for HTTPS_PROXY Environment Variable ---
$httpsProxy = [System.Environment]::GetEnvironmentVariable("HTTPS_PROXY", "Process")

if (-not $httpsProxy) {
    $setupProxy = Read-Host "Do you want to set up HTTPS_PROXY for NTLM authentication? (y/n)"
    
    if ($setupProxy -eq 'y' -or $setupProxy -eq 'Y') {
        # Get proxy server details
        $proxyServer = Read-Host "Enter proxy server address (e.g., proxy.example.com:8080)"
        
        # Get credentials
        $username = Read-Host "Enter your username"
        
        # Get password with confirmation
        $passwordsMatch = $false
        while (-not $passwordsMatch) {
            $securePassword = Read-Host "Enter your password" -AsSecureString
            $securePasswordConfirm = Read-Host "Confirm your password" -AsSecureString
            
            # Convert secure strings for comparison
            $bstr1 = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
            $bstr2 = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePasswordConfirm)
            $password = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr1)
            $passwordConfirm = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr2)
            
            if ($password -eq $passwordConfirm) {
                $passwordsMatch = $true
                # Clear confirmation password from memory
                [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr2)
            } else {
                Write-Host "Passwords do not match. Please try again." -ForegroundColor Red
                # Clear both passwords from memory
                [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr1)
                [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr2)
            }
        }
        
        # Clear main password from memory after we're done with both
        [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr1)
        
        # Use fixed domain "USA"
        $domain = "USA"
        
        # Format the HTTPS_PROXY value
        $proxyValue = "http://${domain}%5C${username}:${password}@${proxyServer}"
        
        # Set the environment variable for the current process
        [System.Environment]::SetEnvironmentVariable("HTTPS_PROXY", $proxyValue, "Process")
        
        # Optionally, ask if they want to set it permanently
        $setPermanent = Read-Host "Do you want to set this permanently for your user account? (y/n)"
        if ($setPermanent -eq 'y' -or $setPermanent -eq 'Y') {
            try {
                [System.Environment]::SetEnvironmentVariable("HTTPS_PROXY", $proxyValue, "User")
            } catch {
                Write-Host "Failed to set permanent environment variable: $_" -ForegroundColor Red
            }
        }
    }
}

# --- Check for Node.js --- 
$nodeExists = $false
try {
    # Try executing node -v. Redirect output to null, check exit code.
    node --version *> $null 
    if ($LASTEXITCODE -eq 0) {
        $nodeExists = $true
    }
} catch {
    # Node.js not installed or not in PATH
}

# --- Install Node.js via winget if needed --- 
if (-not $nodeExists) {
    Write-Host "Node.js not found. Attempting installation via winget..." -ForegroundColor Yellow
    try {
        winget --version *> $null
        if ($LASTEXITCODE -ne 0) {
            Write-Error "Winget command not found. Please install Node.js manually from https://nodejs.org/"
            Exit 1
        }

        # Attempt to install Node.js silently
        winget install OpenJS.NodeJS --accept-package-agreements --accept-source-agreements
        
        if ($LASTEXITCODE -ne 0) {
            Write-Error "Winget failed to install Node.js. Please install Node.js manually from https://nodejs.org/"
            Exit 1
        }

        Write-Host "Node.js installation completed. Please CLOSE this terminal and RE-RUN the script in a NEW terminal window." -ForegroundColor Yellow
        Exit 0 # Exit cleanly, requiring user to restart script in new terminal

    } catch {
        Write-Error "Error installing Node.js. Please install manually from https://nodejs.org/"
        Exit 1
    }
}

# --- Navigate to Script Directory --- 
if ($PSScriptRoot) {
    Set-Location $PSScriptRoot
}

# --- Check for package.json --- 
if (-not (Test-Path -Path .\package.json -PathType Leaf)) {
    Write-Error "package.json not found in the current directory. Cannot proceed."
    Exit 1
}

# --- Run npm start --- 
Write-Host "Starting the server..." -ForegroundColor Cyan
Write-Host "The application will be available at http://localhost:3000" -ForegroundColor Cyan

# Start the server in a job so we can open the browser
$serverJob = Start-Job -ScriptBlock { 
    param($workingDir)
    Set-Location $workingDir
    npm start 
} -ArgumentList $PWD

# Wait a moment for the server to initialize
Start-Sleep -Seconds 3

# Open the browser
Start-Process "http://localhost:3000"

# Display message about how to exit
Write-Host "Server is running. Press Ctrl+C to stop the server when finished." -ForegroundColor Cyan

# Wait for the job to complete (when user presses Ctrl+C)
try {
    Receive-Job -Job $serverJob -Wait
    Stop-Job -Job $serverJob
    Remove-Job -Job $serverJob
} catch {
    Write-Host "Server stopped." -ForegroundColor Yellow
}

# Execution will continue here when server is stopped.
Write-Host "Script finished."
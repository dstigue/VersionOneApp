# PowerShell Script to Setup and Run the VersionOne Story Copier Server

# Exit script immediately if any command fails
# $ErrorActionPreference = 'Stop' # Uncomment this for stricter error handling if desired

Write-Host "Starting setup and run script..." -ForegroundColor Cyan

# --- Check for HTTPS_PROXY Environment Variable ---
Write-Host "Checking for HTTPS_PROXY environment variable..." -ForegroundColor Cyan
$httpsProxy = [System.Environment]::GetEnvironmentVariable("HTTPS_PROXY", "Process")

if (-not $httpsProxy) {
    Write-Host "HTTPS_PROXY environment variable not found." -ForegroundColor Yellow
    $setupProxy = Read-Host "Do you want to set up HTTPS_PROXY for NTLM authentication? (y/n)"
    
    if ($setupProxy -eq 'y' -or $setupProxy -eq 'Y') {
        # Get proxy server details
        $proxyServer = Read-Host "Enter proxy server address (e.g., proxy.example.com:8080)"
        
        # Get credentials
        $username = Read-Host "Enter your username"
        $securePassword = Read-Host "Enter your password" -AsSecureString
        $bstr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
        $password = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr)
        [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) # Clear the password from memory
        
        # Use fixed domain "USA"
        $domain = "USA"
        
        # Format the HTTPS_PROXY value
        $proxyValue = "http://${domain}%5C${username}:${password}@${proxyServer}"
        
        # Set the environment variable for the current process
        [System.Environment]::SetEnvironmentVariable("HTTPS_PROXY", $proxyValue, "Process")
        
        Write-Host "HTTPS_PROXY environment variable set successfully for this session." -ForegroundColor Green
        Write-Host "NOTE: This setting will only persist for the current PowerShell session." -ForegroundColor Yellow
        
        # Optionally, ask if they want to set it permanently
        $setPermanent = Read-Host "Do you want to set this permanently for your user account? (y/n)"
        if ($setPermanent -eq 'y' -or $setPermanent -eq 'Y') {
            try {
                [System.Environment]::SetEnvironmentVariable("HTTPS_PROXY", $proxyValue, "User")
                Write-Host "HTTPS_PROXY environment variable set permanently for your user account." -ForegroundColor Green
            } catch {
                Write-Host "Failed to set permanent environment variable: $_" -ForegroundColor Red
            }
        }
    } else {
        Write-Host "Continuing without setting HTTPS_PROXY." -ForegroundColor Yellow
    }
} else {
    Write-Host "HTTPS_PROXY environment variable is already set: $httpsProxy" -ForegroundColor Green
}

# --- Check for Node.js --- 
Write-Host "Checking for Node.js installation..."
$nodeExists = $false
Try {
    # Try executing node -v. Redirect output to null, check exit code.
    node --version *> $null 
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Node.js is already installed." -ForegroundColor Green
        $nodeExists = $true
    }
} Catch {
    # Catch block might trigger if 'node' command isn't recognized at all
    Write-Host "Node.js command not found initially."
}

# --- Install Node.js via winget if needed --- 
if (-not $nodeExists) {
    Write-Host "Node.js not found. Attempting installation via winget..."
    # Check if winget exists
    Try {
        winget --version *> $null
        if ($LASTEXITCODE -ne 0) {
            Write-Error "Winget command not found or failed. Cannot automatically install Node.js."
            Write-Error "Please install Node.js manually from https://nodejs.org/ and then run this script again."
            Exit 1
        }

        Write-Host "Attempting to install Node.js using winget..." -ForegroundColor Yellow
        Write-Host "NOTE: This might require Administrator privileges or user interaction."
        # Attempt to install Node.js silently
        winget install OpenJS.NodeJS --accept-package-agreements --accept-source-agreements
        
        if ($LASTEXITCODE -ne 0) {
            Write-Error "Winget failed to install Node.js (Exit Code: $LASTEXITCODE)."
            Write-Error "Try running this script as Administrator. If that fails, please install Node.js manually from https://nodejs.org/"
            Exit 1
        }

        Write-Host "Node.js installation via winget potentially successful." -ForegroundColor Green
        Write-Host "IMPORTANT: Please CLOSE this terminal and RE-RUN the script in a NEW terminal window to ensure Node.js is available in the system PATH." -ForegroundColor Yellow
        Exit 0 # Exit cleanly, requiring user to restart script in new terminal

    } Catch {
        Write-Error "Error checking/running winget. Cannot automatically install Node.js."
        Write-Error "Please install Node.js manually from https://nodejs.org/ and then run this script again."
        Exit 1
    }
}

# --- Navigate to Script Directory --- 
# $PSScriptRoot is the directory where the script itself resides
if ($PSScriptRoot) {
    Write-Host "Changing directory to script location: $PSScriptRoot"
    Set-Location $PSScriptRoot
} else {
    Write-Warning "Could not determine script directory. Assuming current directory is correct."
}

# --- Check for package.json --- 
if (-not (Test-Path -Path .\package.json -PathType Leaf)) {
    Write-Error "package.json not found in the current directory ($PWD). Cannot proceed."
    Exit 1
}

<# # --- Run npm install --- 
Write-Host "Running 'npm install' to install dependencies..."
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Error "'npm install' failed. Please check the errors above."
    Exit 1
}
Write-Host "'npm install' completed successfully." -ForegroundColor Green #>

# --- Run npm start --- 
Write-Host "Starting the server via 'npm start'... (Press Ctrl+C to stop the server)" -ForegroundColor Cyan
npm start

# Execution will likely pause here while the server runs.
# The script will continue here if npm start fails immediately or the server is stopped.
if ($LASTEXITCODE -ne 0) {
    Write-Error "'npm start' failed or the server stopped with an error."
} else {
    Write-Host "Server stopped."
}

Write-Host "Script finished."
document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const v1UrlInput = document.getElementById('v1-url');
    const v1TokenInput = document.getElementById('v1-token');
    const saveSettingsButton = document.getElementById('save-settings');
    const settingsStatus = document.getElementById('settings-status');
    const sourceTimeboxSelect = document.getElementById('source-timebox');
    const targetTimeboxSelect = document.getElementById('target-timebox');
    const targetParentSelect = document.getElementById('target-parent');
    const loadStoriesButton = document.getElementById('load-stories');
    const storiesListDiv = document.getElementById('stories-list');
    const copyButton = document.getElementById('copy-button');
    const statusMessage = document.getElementById('status-message');
    const loadingIndicator = document.getElementById('loading-indicator');
    // Auth method selection elements
    const authNtlmRadio = document.getElementById('auth-ntlm'); // New NTLM option
    const authTokenRadio = document.getElementById('auth-token');
    const authBasicRadio = document.getElementById('auth-basic');
    const ntlmInputSection = document.getElementById('ntlm-input-section'); // New NTLM section
    const tokenInputSection = document.getElementById('token-input-section');
    const basicAuthInputSection = document.getElementById('basic-auth-input-section');
    const v1UsernameInput = document.getElementById('v1-username');
    const v1PasswordInput = document.getElementById('v1-password');
    // Story Team Filter element
    const storyTeamFilterSelect = document.getElementById('story-team-filter');

    // Create filter elements
    const sourceOwnerFilterSelect = document.createElement('select');
    sourceOwnerFilterSelect.id = 'source-owner-filter';
    sourceOwnerFilterSelect.className = 'filter-select';
    
    const sourceScheduleFilterSelect = document.createElement('select');
    sourceScheduleFilterSelect.id = 'source-schedule-filter';
    sourceScheduleFilterSelect.className = 'filter-select';
    
    const targetOwnerFilterSelect = document.createElement('select');
    targetOwnerFilterSelect.id = 'target-owner-filter';
    targetOwnerFilterSelect.className = 'filter-select';
    
    const targetScheduleFilterSelect = document.createElement('select');
    targetScheduleFilterSelect.id = 'target-schedule-filter';
    targetScheduleFilterSelect.className = 'filter-select';

    // Add filter elements to the DOM
    const sourceTimeboxContainer = sourceTimeboxSelect.parentElement;
    const sourceFiltersDiv = document.createElement('div');
    sourceFiltersDiv.className = 'filters-container';
    
    // Create filter groups with proper labeling
    const sourceOwnerGroup = document.createElement('div');
    sourceOwnerGroup.className = 'filter-group';
    sourceOwnerGroup.innerHTML = '<label for="source-owner-filter">Owner:</label>';
    sourceOwnerGroup.appendChild(sourceOwnerFilterSelect);
    
    const sourceScheduleGroup = document.createElement('div');
    sourceScheduleGroup.className = 'filter-group';
    sourceScheduleGroup.innerHTML = '<label for="source-schedule-filter">Schedule:</label>';
    sourceScheduleGroup.appendChild(sourceScheduleFilterSelect);
    
    sourceFiltersDiv.appendChild(document.createElement('div')).innerHTML = '<div class="filter-label">Filter by:</div>';
    sourceFiltersDiv.appendChild(sourceOwnerGroup);
    sourceFiltersDiv.appendChild(sourceScheduleGroup);
    // Insert into the new placeholder div
    const sourceFiltersContainer = document.getElementById('source-filters-container');
    sourceFiltersContainer.appendChild(sourceFiltersDiv);
    // sourceTimeboxContainer.insertBefore(sourceFiltersDiv, sourceTimeboxSelect.nextSibling); // Old insertion point

    const targetTimeboxContainer = targetTimeboxSelect.parentElement;
    const targetFiltersDiv = document.createElement('div');
    targetFiltersDiv.className = 'filters-container';
    
    // Create filter groups with proper labeling
    const targetOwnerGroup = document.createElement('div');
    targetOwnerGroup.className = 'filter-group';
    targetOwnerGroup.innerHTML = '<label for="target-owner-filter">Owner:</label>';
    targetOwnerGroup.appendChild(targetOwnerFilterSelect);
    
    const targetScheduleGroup = document.createElement('div');
    targetScheduleGroup.className = 'filter-group';
    targetScheduleGroup.innerHTML = '<label for="target-schedule-filter">Schedule:</label>';
    targetScheduleGroup.appendChild(targetScheduleFilterSelect);
    
    targetFiltersDiv.appendChild(document.createElement('div')).innerHTML = '<div class="filter-label">Filter by:</div>';
    targetFiltersDiv.appendChild(targetOwnerGroup);
    targetFiltersDiv.appendChild(targetScheduleGroup);
    // Insert into the new placeholder div
    const targetFiltersContainer = document.getElementById('target-filters-container');
    targetFiltersContainer.appendChild(targetFiltersDiv);
    // targetTimeboxContainer.insertBefore(targetFiltersDiv, targetTimeboxSelect.nextSibling); // Old insertion point

    // Create a style element for the filters
    const styleElement = document.createElement('style');
    styleElement.textContent = `
    .filters-container {
        display: flex;
        align-items: center;
        margin-top: 10px;
        margin-bottom: 10px;
        gap: 15px;
    }
    .filter-label {
        font-weight: bold;
        white-space: nowrap;
    }
    .filter-group {
        display: flex;
        align-items: center;
        gap: 5px;
    }
    .filter-group label {
        min-width: 70px;
        white-space: nowrap;
    }
    .filter-select {
        min-width: 180px;
        padding: 4px 8px;
        border-radius: 4px;
        border: 1px solid #ccc;
    }
    `;
    document.head.appendChild(styleElement);

    // Store all timeboxes for filtering
    let allTimeboxes = [];
    // Store currently fetched stories for team filtering
    let currentStories = [];

    let settings = {
        baseUrl: '',
        authMethod: 'ntlm', // Default to NTLM
        accessToken: '',
        username: '',
        password: '',
        targetParentAssetType: 'Epic'
    };

    // --- Settings Handling ---
    function toggleAuthInputs() {
        // Hide all auth input sections first
        ntlmInputSection.style.display = 'none';
        tokenInputSection.style.display = 'none';
        basicAuthInputSection.style.display = 'none';
        
        // Show the selected one
        if (authNtlmRadio.checked) {
            ntlmInputSection.style.display = 'block';
        } else if (authTokenRadio.checked) {
            tokenInputSection.style.display = 'block';
        } else if (authBasicRadio.checked) {
            basicAuthInputSection.style.display = 'block';
        }
    }

    function loadSettings() {
        const savedSettings = localStorage.getItem('v1CopierSettings');
        const defaultSettings = { // Define defaults clearly
            baseUrl: '',
            authMethod: 'ntlm', // Updated default to NTLM
            accessToken: '',
            username: '',
            password: '',
            targetParentAssetType: 'Epic' 
        };

        if (savedSettings) {
            try {
                const loaded = JSON.parse(savedSettings);
                // Merge loaded settings onto defaults
                settings = { ...defaultSettings, ...loaded }; 
            } catch (e) {
                console.error("Failed to parse saved settings, using defaults:", e);
                settings = { ...defaultSettings }; // Use defaults if parsing fails
            }
            
            v1UrlInput.value = settings.baseUrl || '';
            v1TokenInput.value = settings.accessToken || '';
            v1UsernameInput.value = settings.username || '';
            v1PasswordInput.value = settings.password || ''; // Note: Storing password in localStorage is insecure

            // Set the correct radio button
            if (settings.authMethod === 'basic') {
                authBasicRadio.checked = true;
            } else if (settings.authMethod === 'token') {
                authTokenRadio.checked = true;
            } else {
                // Default to NTLM or explicitly set NTLM
                authNtlmRadio.checked = true;
                settings.authMethod = 'ntlm'; // Ensure setting is consistent
            }
            toggleAuthInputs(); // Show/hide correct fields

            settingsStatus.textContent = 'Settings loaded.';
            settingsStatus.className = 'success';
            if (settings.baseUrl) {
                // Start both data fetches in parallel with a timeout
                loadInitialData();
            }
        } else {
            settingsStatus.textContent = 'No settings found. Please configure.';
            settingsStatus.className = 'error';
            toggleAuthInputs(); // Ensure correct fields are shown initially
        }
    }

    async function saveSettings() {
        const newBaseUrl = v1UrlInput.value.trim();
        const selectedAuthMethod = authNtlmRadio.checked ? 'ntlm' : 
                                  (authBasicRadio.checked ? 'basic' : 'token');
        const newAccessToken = v1TokenInput.value.trim();
        const newUsername = v1UsernameInput.value.trim();
        const newPassword = v1PasswordInput.value.trim(); // Avoid trimming passwords

        let isValid = true;
        let errorMsg = '';

        if (!newBaseUrl) {
            isValid = false;
            errorMsg = 'Base URL cannot be empty. ';
        }

        // Validate based on selected auth method
        if (selectedAuthMethod === 'token' && !newAccessToken) {
            isValid = false;
            errorMsg += 'Access Token cannot be empty for Token Auth. ';
        }

        if (selectedAuthMethod === 'basic' && (!newUsername || !newPassword)) {
            isValid = false;
            errorMsg += 'Username and Password cannot be empty for Basic Auth. ';
        }

        // NTLM doesn't require validation here since it's handled by the proxy server

        // Basic URL validation
        if (newBaseUrl) {
            try {
                new URL(newBaseUrl);
            } catch (_) {
                isValid = false;
                errorMsg += 'Invalid Base URL format.';
            }
        }

        if (!isValid) {
            settingsStatus.textContent = errorMsg.trim();
            settingsStatus.className = 'error';
            return;
        }

        settings.baseUrl = newBaseUrl;
        settings.authMethod = selectedAuthMethod;
        settings.accessToken = newAccessToken;
        settings.username = newUsername;
        // WARNING: Storing plaintext passwords in localStorage is insecure!
        // Consider more secure alternatives for a real application.
        settings.password = newPassword;

        localStorage.setItem('v1CopierSettings', JSON.stringify(settings));
        settingsStatus.textContent = 'Settings saved. Testing connection...'; // Update status before test
        settingsStatus.className = 'success';
        await testConnection(); // Call the connection test
    }

    saveSettingsButton.addEventListener('click', saveSettings);
    // Add event listeners for radio buttons
    authTokenRadio.addEventListener('change', toggleAuthInputs);
    authBasicRadio.addEventListener('change', toggleAuthInputs);
    authNtlmRadio.addEventListener('change', toggleAuthInputs);

    // --- API Call Helper ---
    async function v1ApiCall(endpoint, method = 'GET', body = null, suppressStatusUpdate = false) {
        if (!settings.baseUrl) {
            if (!suppressStatusUpdate) showStatus('Error: VersionOne Base URL not set in Settings.', true);
            return null;
        }

        let authHeaderValue = '';
        if (settings.authMethod === 'token') {
            if (!settings.accessToken) {
                if (!suppressStatusUpdate) showStatus('Error: Access Token not set in Settings.', true);
                return null;
            }
            authHeaderValue = `Bearer ${settings.accessToken}`;
        } else if (settings.authMethod === 'basic') {
            if (!settings.username || !settings.password) {
                if (!suppressStatusUpdate) showStatus('Error: Username or Password not set in Settings for Basic Auth.', true);
                return null;
            }
            try {
                 authHeaderValue = `Basic ${btoa(`${settings.username}:${settings.password}`)}`;
            } catch (e) {
                console.error("Error encoding credentials");
                if (!suppressStatusUpdate) showStatus('Error encoding credentials for Basic Auth.', true);
                return null;
            }
        } else if (settings.authMethod === 'ntlm') {
            // NTLM auth is handled by the proxy - we don't need to set an auth header here
        } else {
            if (!suppressStatusUpdate) showStatus('Error: Invalid authentication method selected.', true);
            return null;
        }

        const proxyUrl = `/api/v1/${endpoint.replace(/^\//, '')}`;
        const headers = {
            'X-V1-Base-URL': settings.baseUrl,
            'Accept': 'application/json'
        };
        
        // Only add Authorization header for non-NTLM auth methods
        if (settings.authMethod !== 'ntlm' && authHeaderValue) {
            headers['Authorization'] = authHeaderValue;
        }

        const options = {
            method: method,
            headers: headers
        };

        if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
            headers['Content-Type'] = 'application/json';
            options.body = JSON.stringify(body);
        }

        showLoading(true);
        let detailedError = null; // Variable to hold detailed error message
        try {
            const response = await fetch(proxyUrl, options);

            if (!response.ok) {
                let errorMsg = `API Error: ${response.status} ${response.statusText}`;
                // --- Read body as text first to avoid double-read ---
                const errorBodyText = await response.text(); 
                detailedError = errorBodyText; // Default detail is the raw text
                try {
                    // --- Try parsing the text as JSON --- 
                    const errorData = JSON.parse(errorBodyText);
                    // Extract details if JSON parsing succeeded
                    if (errorData.message) {
                        detailedError = errorData.message;
                        errorMsg += ` - ${detailedError}`;
                    } else if (errorData.Exception) {
                        detailedError = errorData.Exception.Message || 'Unknown server exception';
                        errorMsg += ` - ${detailedError}`;
                    } else if (errorData.error) { 
                        // Handle structured error from our proxy itself
                        detailedError = errorData.error + (errorData.details ? ` (${JSON.stringify(errorData.details)})` : ''); 
                        errorMsg = detailedError; 
                    }
                } catch (e) {
                    // JSON parsing failed, use the raw text already captured
                    if (detailedError) { // Add raw text if we didn't find a specific message
                        errorMsg += ` - ${detailedError}`;
                    }
                }
                throw new Error(errorMsg);
            }

            if (response.status === 204) { // Handle No Content responses
                return null;
            }

            return await response.json();
        } catch (error) {
            console.error('API Call Failed');
            // Use settingsStatus for connection test errors, statusMessage otherwise
            const targetStatusElement = suppressStatusUpdate ? settingsStatus : statusMessage;
            const displayMessage = detailedError ? `Connection failed: ${detailedError}` : `Error: ${error.message}`;

            if (suppressStatusUpdate) {
                // For connection test, always update settingsStatus
                settingsStatus.textContent = displayMessage;
                settingsStatus.className = 'error';
            } else {
                 showStatus(displayMessage, true);
            }
            return null;
        } finally {
            showLoading(false);
        }
    }

    // --- UI Update Functions ---
    function showLoading(isLoading) {
        loadingIndicator.style.display = isLoading ? 'block' : 'none';
    }

    function showStatus(message, isError = false) {
        statusMessage.textContent = message;
        statusMessage.className = isError ? 'error' : 'success';
    }

    function populateFilterDropdowns(timeboxes, isInitialLoad = true) {
        if (!timeboxes || !timeboxes.Assets || timeboxes.Assets.length === 0) {
            return;
        }

        // For source filters
        updateFilterOptions(
            timeboxes.Assets, 
            sourceOwnerFilterSelect, 
            sourceScheduleFilterSelect, 
            isInitialLoad
        );

        // For target filters
        updateFilterOptions(
            timeboxes.Assets, 
            targetOwnerFilterSelect, 
            targetScheduleFilterSelect, 
            isInitialLoad
        );
    }

    function updateFilterOptions(timeboxAssets, ownerSelect, scheduleSelect, isInitialLoad = false) {
        // Get current selections
        const currentOwner = ownerSelect.value;
        const currentSchedule = scheduleSelect.value;

        // Collect available options based on current filters
        const availableOwners = new Set();
        const availableSchedules = new Set();

        timeboxAssets.forEach(tb => {
            const owner = tb.Attributes?.['Owner.Name']?.value || '';
            const schedule = tb.Attributes?.['Schedule.Name']?.value || '';
            
            // If no schedule filter or this timebox matches the schedule filter
            if (!currentSchedule || schedule === currentSchedule) {
                if (owner) availableOwners.add(owner);
            }
            
            // If no owner filter or this timebox matches the owner filter
            if (!currentOwner || owner === currentOwner) {
                if (schedule) availableSchedules.add(schedule);
            }
        });

        // Only during initial load or when explicitly directed to update both dropdowns,
        // update both dropdowns with all available options
        if (isInitialLoad) {
            updateDropdown(ownerSelect, Array.from(availableOwners), 'All Owners', currentOwner);
            updateDropdown(scheduleSelect, Array.from(availableSchedules), 'All Schedules', currentSchedule);
            return;
        }

        // When not initial load, we only update the "complementary" dropdown
        // If we're updating from an owner change, update the schedule options
        if (ownerSelect.dataset.lastChanged === 'true') {
            updateDropdown(scheduleSelect, Array.from(availableSchedules), 'All Schedules', currentSchedule);
            ownerSelect.dataset.lastChanged = 'false';
        } 
        // If we're updating from a schedule change, update the owner options
        else if (scheduleSelect.dataset.lastChanged === 'true') {
            updateDropdown(ownerSelect, Array.from(availableOwners), 'All Owners', currentOwner);
            scheduleSelect.dataset.lastChanged = 'false';
        }
    }

    function updateDropdown(selectElement, options, defaultText, currentValue) {
        // Store current scroll position
        const scrollTop = selectElement.scrollTop;
        
        // Build HTML options
        let optionsHtml = `<option value="">${defaultText}</option>`;
        
        options.sort().forEach(option => {
            // Preserve the current selection if it's in the new options
            const selected = option === currentValue ? 'selected' : '';
            optionsHtml += `<option value="${option}" ${selected}>${option}</option>`;
        });
        
        // Set HTML and restore scroll position
        selectElement.innerHTML = optionsHtml;
        selectElement.scrollTop = scrollTop;
    }

    function filterTimeboxes(selectElement, ownerFilter, scheduleFilter) {
        // Start with a clean dropdown
        selectElement.innerHTML = '<option value="">-- Select Timebox --</option>';
        
        if (!allTimeboxes || !allTimeboxes.Assets) {
            return;
        }

        // Apply filters
        const filteredTimeboxes = allTimeboxes.Assets.filter(tb => {
            const owner = tb.Attributes?.['Owner.Name']?.value || '';
            const schedule = tb.Attributes?.['Schedule.Name']?.value || '';
            
            const ownerMatch = !ownerFilter || owner === ownerFilter;
            const scheduleMatch = !scheduleFilter || schedule === scheduleFilter;
            
            return ownerMatch && scheduleMatch;
        });

        // Helper function to format date string
        const formatDate = (dateString) => {
            if (!dateString) return 'N/A';
            try {
                return dateString.substring(0, 10);
            } catch {
                return 'Invalid Date';
            }
        };

        // Sort and populate the dropdown
        filteredTimeboxes.sort((a, b) => {
            const nameA = a.Attributes?.Name?.value || '';
            const nameB = b.Attributes?.Name?.value || '';
            return nameA.localeCompare(nameB);
        }).forEach(tb => {
            const name = tb.Attributes?.Name?.value || 'Unnamed Timebox';
            const id = tb.id;
            const beginDate = formatDate(tb.Attributes?.BeginDate?.value);
            const endDate = formatDate(tb.Attributes?.EndDate?.value);
            const ownerName = tb.Attributes?.['Owner.Name']?.value || 'N/A';
            const scheduleName = tb.Attributes?.['Schedule.Name']?.value || 'N/A';

            const option = document.createElement('option');
            option.value = id;
            option.textContent = `${name} (${beginDate} - ${endDate}) Owner: ${ownerName}, Schedule: ${scheduleName}`;
            selectElement.appendChild(option);
        });

        // Check if nothing matches filters
        if (filteredTimeboxes.length === 0) {
            const option = document.createElement('option');
            option.disabled = true;
            option.textContent = '-- No matching timeboxes --';
            selectElement.appendChild(option);
        }
    }

    function populateTimeboxSelect(selectElement, timeboxes) {
        // Store the timeboxes for filtering if this is the first load
        if (timeboxes && timeboxes.Assets && (!allTimeboxes || !allTimeboxes.Assets)) {
            allTimeboxes = timeboxes;
            populateFilterDropdowns(timeboxes);
        }
        
        // Get appropriate filter values
        let ownerFilter = '';
        let scheduleFilter = '';
        
        if (selectElement === sourceTimeboxSelect) {
            ownerFilter = sourceOwnerFilterSelect.value;
            scheduleFilter = sourceScheduleFilterSelect.value;
        } else if (selectElement === targetTimeboxSelect) {
            ownerFilter = targetOwnerFilterSelect.value;
            scheduleFilter = targetScheduleFilterSelect.value;
        }
        
        filterTimeboxes(selectElement, ownerFilter, scheduleFilter);
    }

    // --- Core Logic Functions (Placeholders) ---

    async function fetchTimeboxes() {
        showStatus('Fetching timeboxes...');

        // Calculate the date 6 months ago
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
        // Format as YYYY-MM-DD
        const year = sixMonthsAgo.getFullYear();
        const month = String(sixMonthsAgo.getMonth() + 1).padStart(2, '0'); // Months are 0-indexed
        const day = String(sixMonthsAgo.getDate()).padStart(2, '0');
        const sixMonthsAgoDateString = `${year}-${month}-${day}`;

        // Fetch only active timeboxes - ADDED BeginDate, EndDate, Owner.Name, Schedule.Name to sel
        const timeboxSelectFields = 'Name,BeginDate,EndDate,Owner.Name,Schedule.Name';
        // Add the where clause for the date filter
        const timeboxQuery = `rest-1.v1/Data/Timebox?sel=${timeboxSelectFields}&where=BeginDate>='${sixMonthsAgoDateString}'`;

        const timeboxes = await v1ApiCall(timeboxQuery);
        if (timeboxes) {
            populateTimeboxSelect(sourceTimeboxSelect, timeboxes);
            populateTimeboxSelect(targetTimeboxSelect, timeboxes);
            showStatus('Timeboxes loaded.');
        } else {
            showStatus('Failed to load timeboxes. Check console and settings.', true);
            // Clear dropdowns if fetch failed
            populateTimeboxSelect(sourceTimeboxSelect, null);
            populateTimeboxSelect(targetTimeboxSelect, null);
        }
    }

    // --- New: Function to Populate Story Team Filter ---
    function populateStoryTeamFilter(stories) {
        const teams = new Set();
        if (stories && stories.length > 0) {
            stories.forEach(story => {
                const teamName = story.Attributes['Team.Name']?.value;
                if (teamName) {
                    teams.add(teamName);
                }
            });
        }
        
        // Clear previous options except the default
        storyTeamFilterSelect.innerHTML = '<option value="">All Teams</option>'; 
        
        Array.from(teams).sort().forEach(team => {
            const option = document.createElement('option');
            option.value = team;
            option.textContent = team;
            storyTeamFilterSelect.appendChild(option);
        });
        
        // Disable filter if no teams found
        storyTeamFilterSelect.disabled = teams.size === 0;
    }
    // --- End New Function ---

    // --- New: Function to Display Stories (Handles Team Filtering) ---
    function displayStories(stories, teamFilter) {
        storiesListDiv.innerHTML = ''; // Clear previous list
        const ul = document.createElement('ul');
        let displayedCount = 0;

        stories.forEach(story => {
            const storyTeamName = story.Attributes['Team.Name']?.value || '';
            // Apply team filter
            if (teamFilter && storyTeamName !== teamFilter) {
                return; // Skip story if it doesn't match the selected team filter
            }

            displayedCount++;
            const li = document.createElement('li');
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.value = story.id; // Keep full OID as value for potential reference
            checkbox.id = `story-${story.id}`;
            // Store numeric ID in a data attribute
            const numericId = story.id.split(':')[1];
            if (numericId) {
                checkbox.dataset.numericId = numericId;
            } else {
                console.warn(`Could not extract numeric ID from ${story.id}`);
            }
            checkbox.addEventListener('change', checkCopyButtonState);

            const label = document.createElement('label');
            const storyName = story.Attributes?.Name?.value || 'Unnamed Story';
            const storyNumber = story.Attributes?.Number?.value || '';
            label.htmlFor = checkbox.id;
            // Include team name in the display
            label.textContent = `${storyNumber} - ${storyName} (${storyTeamName || 'No Team'})`; 

            li.appendChild(checkbox);
            li.appendChild(label);

            // Display tasks (if any)
            const tasks = story.Attributes['Children:Task']?.value;
            const taskNames = story.Attributes['Children:Task.Name']?.value; 

            if (tasks && tasks.length > 0 && taskNames && taskNames.length === tasks.length) {
                const taskUl = document.createElement('ul');
                tasks.forEach((taskRef, index) => {
                    const taskLi = document.createElement('li');
                    const taskName = taskNames[index] || 'Unnamed Task'; 
                    const taskIdRef = taskRef.idref; 
                    taskLi.textContent = `Task: ${taskName}`;
                    if (taskIdRef) {
                       taskLi.dataset.taskId = taskIdRef;
                    }
                    taskUl.appendChild(taskLi);
                });
                li.appendChild(taskUl);
            }

            ul.appendChild(li);
        });

        if (ul.hasChildNodes()) {
            storiesListDiv.appendChild(ul);
            showStatus(`${displayedCount} stories loaded/filtered. Select stories to copy.`);
        } else if (teamFilter) {
             storiesListDiv.innerHTML = '<p>No stories match the selected team filter.</p>';
             showStatus('No stories match filter.');
        } else {
            // This case shouldn't be reached if the initial check passed, but good fallback
             storiesListDiv.innerHTML = '<p>No active stories found in the selected timebox.</p>';
             showStatus('No active stories found.');
        }
        checkCopyButtonState(); // Update button state
    }
    // --- End New Function ---

    async function fetchStoriesAndTasks(timeboxId) {
        if (!timeboxId) {
            storiesListDiv.innerHTML = '<p>Please select a source timebox first.</p>';
            copyButton.disabled = true;
            currentStories = []; // Clear stored stories
            populateStoryTeamFilter(currentStories); // Clear team filter
            return;
        }
        showStatus(`Fetching stories...`);
        storiesListDiv.innerHTML = ''; // Clear previous list
        copyButton.disabled = true;
        currentStories = []; // Clear stored stories before fetch
        populateStoryTeamFilter(currentStories); // Clear team filter

        // Construct the query - Added Team.Name
        const storyQuery = `rest-1.v1/Data/Story?sel=Name,Number,Description,Parent.ID,Children:Task,Task.Name,Task.Description,Team.Name&where=Timebox.ID='${timeboxId}'`;
        const storyResponse = await v1ApiCall(storyQuery);
        if (!storyResponse || !storyResponse.Assets) {
            showStatus('No stories found or error fetching stories.', true);
            showLoading(false);
            return;
        }

        if (storyResponse.Assets.length > 0) {
            currentStories = storyResponse.Assets; // Store fetched stories
            populateStoryTeamFilter(currentStories); // Populate the team filter dropdown
            displayStories(currentStories, storyTeamFilterSelect.value); // Initial display using current filter value
        } else { 
            storiesListDiv.innerHTML = '<p>No active stories found in the selected timebox.</p>';
            showStatus('No active stories found.');
            checkCopyButtonState(); 
        }
    }

    function getSelectedStories() {
        // Return an array of objects containing both full OID and numeric ID
        return Array.from(storiesListDiv.querySelectorAll('input[type="checkbox"]:checked'))
            .map(cb => ({
                oid: cb.value,
                numericId: cb.dataset.numericId
            }))
            .filter(item => item.numericId); // Filter out any items where numeric ID couldn't be extracted
    }

    function checkCopyButtonState() {
        const selectedStories = getSelectedStories();
        const targetTimeboxSelected = targetTimeboxSelect.value !== '';
        copyButton.disabled = !(selectedStories.length > 0 && targetTimeboxSelected);
    }

    async function copySelectedItems() {
        const storiesToCopy = getSelectedStories();
        const targetTimeboxId = targetTimeboxSelect.value;
        const targetParentId = targetParentSelect.value; // Might be "" if not selected

        // Button state check no longer includes targetParentId mandatory check
        if (storiesToCopy.length === 0 || !targetTimeboxId) {
            showStatus('Please select stories and a target timebox.', true);
            return;
        }

        showStatus(`Starting copy of ${storiesToCopy.length} stories...`);
        copyButton.disabled = true; // Disable button during copy

        // Get target timebox scope
        let targetTimeboxScope = null;
        try {
            showStatus('Fetching target timebox information...');
            // Query to get the scope of the target timebox
            const timeboxQuery = `rest-1.v1/Data/Timebox/${targetTimeboxId.split(':')[1]}?sel=Scope.ID`;
            const timeboxData = await v1ApiCall(timeboxQuery);
            
            if (timeboxData && timeboxData.Attributes && timeboxData.Attributes['Scope.ID'] && 
                timeboxData.Attributes['Scope.ID'].value) {
                targetTimeboxScope = timeboxData.Attributes['Scope.ID'].value;
            } else {
                showStatus('Could not determine the scope of the target timebox. Copy may fail.', true);
            }
        } catch (error) {
            console.error('Error fetching target timebox scope');
            showStatus('Error fetching target timebox scope. Copy may fail.', true);
        }

        let successCount = 0;
        let errorCount = 0;
        let skippedCount = 0;

        for (let i = 0; i < storiesToCopy.length; i++) {
            const storyInfo = storiesToCopy[i];
            const storyOid = storyInfo.oid;
            const storyNumericId = storyInfo.numericId;
            try {
                showStatus(`Processing story ${i+1} of ${storiesToCopy.length}...`);
                 // 1. Fetch details including AssetState
                const storySel = 'Name,Description,Scope,Priority,Team,Owners,Estimate,Order,Super,AffectedByDefects,Number,AssetState'; // Added AssetState
                const originalStory = await v1ApiCall(`rest-1.v1/Data/Story/${storyNumericId}?sel=${storySel}`);

                // Adjust check for single Asset response structure
                if (!originalStory || !originalStory.Attributes) {
                     console.error(`Failed to fetch details or received invalid data for story ${storyOid}`);
                     errorCount++;
                     continue; // Skip to next story
                }

                const sourceAttributes = originalStory.Attributes;
                const originalStoryNumber = sourceAttributes.Number?.value || storyOid;

                // --- Close Original Story If Not Already Closed (using Operation) ---
                const closedStateId = 128; // Common AssetState for 'Closed'. Adjust if your V1 instance uses a different ID.
                const closeOperationName = 'QuickClose'; // Use QuickClose as requested

                if (sourceAttributes.AssetState?.value !== closedStateId) {
                    showStatus(`Attempting to close original story ${originalStoryNumber} via operation '${closeOperationName}'...`);
                    try {
                        // Execute the QuickClose operation
                        const closeResponse = await v1ApiCall(`rest-1.v1/Data/Story/${storyNumericId}?op=${closeOperationName}`, 'POST', null); 
                        
                        if (!closeResponse || !closeResponse.id) { 
                             console.error(`Operation '${closeOperationName}' may have failed for story ${originalStoryNumber}. Copy will proceed.`);
                             showStatus(`Warning: Operation '${closeOperationName}' may have failed for story ${originalStoryNumber}. Copying anyway...`, true);
                        } else {
                            showStatus(`Original story ${originalStoryNumber} closed via operation. Proceeding with copy...`);
                        }
                    } catch (closeError) {
                        console.error(`Error executing operation '${closeOperationName}' on story ${originalStoryNumber}:`, closeError);
                        showStatus(`Warning: Error closing original story ${originalStoryNumber} via operation. Copying anyway...`, true);
                         // Continue with copy attempt even if closing failed
                    }
                } else {
                     showStatus(`Original story ${originalStoryNumber} already closed. Proceeding with copy...`);
                }
                // --- End Close Original Story ---

                // --- Determine Super ID to use ---
                let superIdToUse = null;
                let skipSuperAttribute = false;
                
                if (targetParentId) {
                    // User selected a target parent
                    superIdToUse = targetParentId;
                } else {
                    // No target parent selected, try using the source story's parent
                    if (sourceAttributes.Super && sourceAttributes.Super.value && sourceAttributes.Super.value.idref) {
                        superIdToUse = sourceAttributes.Super.value.idref;
                    } else {
                        // Parent is completely optional now, so we'll skip setting it
                        skipSuperAttribute = true;
                    }
                }
                // --- End Determine Super ID ---

                // 2. Prepare data for the new story
                const newStoryPayload = {
                    Attributes: {
                        // Required fields
                        Name: { value: sourceAttributes.Name?.value || 'Unnamed Story', act: 'set' },
                        Timebox: { value: targetTimeboxId, act: 'set' },
                        Super: { value: superIdToUse, act: 'set' },

                        // Use target timebox scope if available, otherwise try to use original scope
                        ...(targetTimeboxScope ? 
                            { Scope: { value: targetTimeboxScope, act: 'set' } } : 
                            (sourceAttributes.Scope && sourceAttributes.Scope.value && 
                             { Scope: { value: sourceAttributes.Scope.value.idref, act: 'set' } })
                        ),

                        // Add other attributes only if they exist in the source response
                        ...(sourceAttributes.Description && { Description: { value: sourceAttributes.Description.value, act: 'set' } }),
                        ...(sourceAttributes.Priority && sourceAttributes.Priority.value && { Priority: { value: sourceAttributes.Priority.value.idref, act: 'set' } }),
                        ...(sourceAttributes.Team && sourceAttributes.Team.value && { Team: { value: sourceAttributes.Team.value.idref, act: 'set' } }),
                        ...(sourceAttributes.Estimate && sourceAttributes.Estimate.value !== null && { Estimate: { value: sourceAttributes.Estimate.value, act: 'set' } }),
                        
                        // Add back multi-value relations with strict checks
                        ...(sourceAttributes.AffectedByDefects && sourceAttributes.AffectedByDefects.value && Array.isArray(sourceAttributes.AffectedByDefects.value) && sourceAttributes.AffectedByDefects.value.length > 0 && {
                            AffectedByDefects: { value: sourceAttributes.AffectedByDefects.value.map(o => ({ idref: o.idref, act: 'add' })), act: 'set' }
                        }),
                        
                        // --- Restore Owners (handle single vs multiple) --- 
                        ...(sourceAttributes.Owners && sourceAttributes.Owners.value && Array.isArray(sourceAttributes.Owners.value) && sourceAttributes.Owners.value.length > 0 && (() => {
                            const validOwnerIdRefs = sourceAttributes.Owners.value
                                .filter(o => o && o.idref) // Basic check for owner object and idref
                                .map(o => o.idref);
                                
                            if (validOwnerIdRefs.length > 0) {
                                // Use 'add' but provide a single string if only one owner, or array if multiple
                                return { Owners: { act: 'add', value: validOwnerIdRefs.length === 1 ? validOwnerIdRefs[0] : validOwnerIdRefs } };
                            } else {
                                return {}; // Return empty object if no valid owners found after filtering
                            }
                        })()),
                    }
                };

                // 3. Create the new story
                const createStoryResponse = await v1ApiCall('rest-1.v1/Data/Story', 'POST', newStoryPayload);
                if (!createStoryResponse || !createStoryResponse.id) {
                    console.error(`Failed to create copy for story ${storyOid}`);
                    errorCount++;
                    continue; // Skip to next story
                }
                const newStoryId = createStoryResponse.id;
                showStatus(`Created new story ${newStoryId}. Fetching original tasks...`);

                // 4. Fetch original tasks separately, including Status.ID and ToDo
                let originalTasks = [];
                const taskSel = 'Name,Description,Category,Owners,ToDo,Status.ID'; // Added Status.ID
                
                try {
                    const tasksResponse = await v1ApiCall(`rest-1.v1/Data/Task?sel=${taskSel}&where=Parent='${storyOid}'`);
                    
                    if (tasksResponse && tasksResponse.Assets) {
                        originalTasks = tasksResponse.Assets;
                        showStatus(`Found ${originalTasks.length} tasks for ${storyOid}. Copying...`);
                    } else {
                        showStatus(`No tasks found for ${storyOid}. Continuing...`);
                    }
                } catch (error) {
                    console.error(`Error fetching tasks for story ${storyOid}:`, error);
                    showStatus(`Warning: Could not fetch tasks for story ${storyOid}. Story was copied without tasks.`, true);
                }

                // 5. Copy Tasks for the new story
                let taskSuccessCount = 0;
                let taskErrorCount = 0;
                
                for (const sourceTask of originalTasks) {
                    try {
                        const taskAttributes = sourceTask.Attributes;
                        const originalTaskId = sourceTask.id; 
                        // const originalTaskNumericId = originalTaskId.split(':')[1]; // No longer needed for updating original task
                        // const originalTaskName = taskAttributes.Name?.value || originalTaskId; // No longer needed for status messages

                        // Build task payload for the NEW task
                        const newTaskPayload = {
                            Attributes: {
                                Name: { value: taskAttributes.Name?.value || 'Unnamed Task', act: 'set' },
                                Parent: { value: newStoryId, act: 'set' },
                                
                                // Handle optional fields with appropriate null checks
                                ...(taskAttributes.Description?.value && { 
                                    Description: { value: taskAttributes.Description.value, act: 'set' } 
                                }),
                                
                                // Handle Category with ID reference checks
                                ...(taskAttributes.Category?.value?.idref && { 
                                    Category: { value: taskAttributes.Category.value.idref, act: 'set' } 
                                }),
                                
                                // Handle ToDo with numeric validation
                                ...(taskAttributes.ToDo?.value !== undefined && taskAttributes.ToDo?.value !== null && {
                                    ToDo: { 
                                        value: typeof taskAttributes.ToDo.value === 'number' ? 
                                               taskAttributes.ToDo.value : 
                                               parseFloat(taskAttributes.ToDo.value), 
                                        act: 'set' 
                                    }
                                })
                            }
                        };
                        
                        // Add Owners with multi-value attribute handling (using "add" operation)
                        if (taskAttributes.Owners?.value && 
                            Array.isArray(taskAttributes.Owners.value) && 
                            taskAttributes.Owners.value.length > 0) {
                            
                            const validOwners = taskAttributes.Owners.value
                                .filter(o => o && o.idref && typeof o.idref === 'string')
                                .map(o => o.idref);
                            
                            if (validOwners.length > 0) {
                                newTaskPayload.Attributes.Owners = {
                                    act: "add",
                                    value: validOwners.length === 1 ? validOwners[0] : validOwners
                                };
                            }
                        }
                        
                        // Create the task
                        const createTaskResponse = await v1ApiCall('rest-1.v1/Data/Task', 'POST', newTaskPayload);
                        if (createTaskResponse && createTaskResponse.id) {
                            taskSuccessCount++;
                        } else {
                            console.error(`Failed to create task for story ${newStoryId}`);
                            taskErrorCount++;
                        }
                    } catch (error) {
                        console.error(`Error creating task for story ${newStoryId}:`, error);
                        taskErrorCount++;
                    }
                }

                successCount++;
                
                // Update status message with task copying results
                if (originalTasks.length > 0) {
                    if (taskErrorCount > 0) {
                        showStatus(`Copied story ${storyOid} with ${taskSuccessCount}/${originalTasks.length} tasks (${taskErrorCount} tasks failed).`);
                    } else {
                        showStatus(`Successfully copied story ${storyOid} with all ${taskSuccessCount} tasks.`);
                    }
                } else {
                    showStatus(`Successfully copied story ${storyOid} (no tasks found).`);
                }

            } catch (error) {
                console.error(`Error copying story ${storyOid}:`, error);
                showStatus(`Error copying story ${storyOid}: ${error.message}`, true);
                errorCount++;
                // Optional: Add retry logic or more specific error handling here
            }
        }

        // Final status update
        let finalMessage = `Copy complete. ${successCount} stories copied successfully.`;
        if (skippedCount > 0) {
            finalMessage += ` ${skippedCount} stories skipped (missing required Parent).`;
        }
        if (errorCount > 0) {
            finalMessage += ` ${errorCount} stories failed to copy. Check console for details.`;
            showStatus(finalMessage, true);
        } else {
            showStatus(finalMessage, false);
            storiesListDiv.innerHTML = '<p>Copy operation finished. Load stories again to see changes or select a different timebox.</p>';
        }
        checkCopyButtonState(); // Re-enable button if conditions met
    }

    // --- New Connection Test Function ---
    async function testConnection() {
        showLoading(true);
        settingsStatus.textContent = 'Testing connection...';
        settingsStatus.className = ''; // Reset class
        const testEndpoint = 'rest-1.v1/Data/Member?where=IsSelf="true"&sel=Username';
        const result = await v1ApiCall(testEndpoint, 'GET', null, true);
        showLoading(false);

        if (result) { // Simplified check - rely on API call failure for bad connection
            const username = result.Attributes?.Username?.value || 'unknown user'; // Safer access
            settingsStatus.textContent = `Connection successful! Authenticated as ${username}.`;
            settingsStatus.className = 'success';
            // Load both in parallel with timeout
            loadInitialData();
        } else {
            // Error message handled by v1ApiCall
            // Clear dropdowns if connection fails
            populateTimeboxSelect(sourceTimeboxSelect, null);
            populateTimeboxSelect(targetTimeboxSelect, null);
            populateParentSelect(targetParentSelect, null);
        }
    }

    // --- New Function to Fetch Target Parents ---
    async function fetchTargetParents() {
        const parentAssetType = settings.targetParentAssetType; 
        if (!parentAssetType) {
            console.error("Target Parent Asset Type not configured in settings.");
            showStatus('Target Parent Asset Type not configured.', true);
            return;
        }
        showStatus(`Fetching target parents (${parentAssetType})...`);
        // Fetch active parents of the configured type
        const parents = await v1ApiCall(`rest-1.v1/Data/${parentAssetType}?sel=Name,Number&where=AssetState=\'64\'`);
        if (parents) {
            populateParentSelect(targetParentSelect, parents);
            showStatus('Target parents loaded.', false); // Clear previous status if successful
        } else {
            showStatus(`Failed to load target parents (${parentAssetType}). Check asset type and console.`, true);
            populateParentSelect(targetParentSelect, null); // Clear dropdown
        }
    }

    // --- New Function to Populate Parent Select ---
    function populateParentSelect(selectElement, parents) {
        selectElement.innerHTML = '<option value="">-- Select Target Parent (Optional) --</option>'; // Changed to Optional
        if (parents && parents.Assets) {
            parents.Assets.sort((a, b) => {
                const nameA = a.Attributes?.Name?.value || '';
                const nameB = b.Attributes?.Name?.value || '';
                return nameA.localeCompare(nameB);
            }).forEach(p => {
                const name = p.Attributes?.Name?.value || 'Unnamed Parent';
                const number = p.Attributes?.Number?.value || '';
                const id = p.id;
                const option = document.createElement('option');
                option.value = id; // Store the full OID (e.g., Epic:123)
                option.textContent = `${number} - ${name}`;
                selectElement.appendChild(option);
            });
        } else {
             console.warn("No target parents found or invalid format:", parents);
        }
    }

    // --- Event Listeners ---
    loadStoriesButton.addEventListener('click', () => fetchStoriesAndTasks(sourceTimeboxSelect.value));
    copyButton.addEventListener('click', copySelectedItems);
    sourceTimeboxSelect.addEventListener('change', () => {
        storiesListDiv.innerHTML = '<p>Click "Load Stories" to fetch items for the selected timebox.</p>'; // Clear stories when source changes
        copyButton.disabled = true; // Disable copy button
        currentStories = []; // Clear stories
        populateStoryTeamFilter(currentStories); // Clear team filter
    });
    targetTimeboxSelect.addEventListener('change', checkCopyButtonState);
    targetParentSelect.addEventListener('change', checkCopyButtonState);

    // Add filter event listeners
    sourceOwnerFilterSelect.addEventListener('change', () => {
        sourceOwnerFilterSelect.dataset.lastChanged = 'true';
        populateFilterDropdowns(allTimeboxes, false);
        populateTimeboxSelect(sourceTimeboxSelect, allTimeboxes);
        // Clear any selected stories when filter changes
        storiesListDiv.innerHTML = '<p>Select a timebox and click "Load Stories".</p>';
        copyButton.disabled = true;
    });
    
    sourceScheduleFilterSelect.addEventListener('change', () => {
        sourceScheduleFilterSelect.dataset.lastChanged = 'true';
        populateFilterDropdowns(allTimeboxes, false);
        populateTimeboxSelect(sourceTimeboxSelect, allTimeboxes);
        // Clear any selected stories when filter changes
        storiesListDiv.innerHTML = '<p>Select a timebox and click "Load Stories".</p>';
        copyButton.disabled = true;
    });
    
    targetOwnerFilterSelect.addEventListener('change', () => {
        targetOwnerFilterSelect.dataset.lastChanged = 'true';
        populateFilterDropdowns(allTimeboxes, false);
        populateTimeboxSelect(targetTimeboxSelect, allTimeboxes);
        checkCopyButtonState();
    });
    
    targetScheduleFilterSelect.addEventListener('change', () => {
        targetScheduleFilterSelect.dataset.lastChanged = 'true';
        populateFilterDropdowns(allTimeboxes, false);
        populateTimeboxSelect(targetTimeboxSelect, allTimeboxes);
        checkCopyButtonState();
    });

    // --- New: Event Listener for Story Team Filter ---
    storyTeamFilterSelect.addEventListener('change', () => {
        displayStories(currentStories, storyTeamFilterSelect.value);
    });
    // --- End New Event Listener ---

    // Add this new function to handle parallel loading with timeout
    async function loadInitialData() {
        showStatus('Loading data, please wait...', false);
        
        // Create a promise that rejects after 30 seconds
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Data loading timed out after 30 seconds')), 30000);
        });
        
        try {
            // Start both data fetches in parallel and race against timeout
            await Promise.race([
                Promise.all([fetchTimeboxes(), fetchTargetParents()]),
                timeoutPromise
            ]);
            
            showStatus('Data loaded successfully.', false);
        } catch (error) {
            console.error('Error loading initial data:', error);
            showStatus(`Error loading data: ${error.message}`, true);
        }
    }

    // --- Initial Load ---
    loadSettings();
});
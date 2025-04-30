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
    const selectedCountBadge = document.getElementById('selected-count'); // New element for displaying count
    // Auth method selection elements
    const authNtlmRadio = document.getElementById('auth-ntlm'); 
    const authTokenRadio = document.getElementById('auth-token');
    const authBasicRadio = document.getElementById('auth-basic');
    const ntlmInputSection = document.getElementById('ntlm-input-section');
    const tokenInputSection = document.getElementById('token-input-section');
    const basicAuthInputSection = document.getElementById('basic-auth-input-section');
    const v1UsernameInput = document.getElementById('v1-username');
    const v1PasswordInput = document.getElementById('v1-password');
    // Password visibility toggle buttons
    const togglePasswordVisibility = document.getElementById('toggle-password-visibility');
    const toggleTokenVisibility = document.getElementById('toggle-token-visibility');
    // Story Owner Filter element
    const storyOwnerFilterSelect = document.getElementById('story-owner-filter');

    // Initialize Choices.js instances
    let storyOwnerChoices = null;
    let sourceTimeboxChoices = null;
    let targetTimeboxChoices = null;
    let targetParentChoices = null;
    let sourceOwnerFilterChoices = null;
    let sourceScheduleFilterChoices = null;
    let targetOwnerFilterChoices = null;
    let targetScheduleFilterChoices = null;

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

    // Store all timeboxes for filtering
    let allTimeboxes = [];
    // Store currently fetched stories for owner filtering
    let currentStories = [];

    let settings = {
        baseUrl: '',
        authMethod: 'ntlm', // Default to NTLM
        accessToken: '',
        username: '',
        password: '',
        targetParentAssetType: 'Epic'
    };

    // Initialize Choices.js dropdowns
    function initChoices() {
        // Initialize the multi-select for story owners
        storyOwnerChoices = new Choices(storyOwnerFilterSelect, {
            removeItemButton: true,
            placeholder: true,
            placeholderValue: 'Select owner(s) to filter',
            classNames: {
                containerOuter: 'choices-owner-filter'
            }
        });

        // Initialize standard dropdowns
        sourceTimeboxChoices = new Choices(sourceTimeboxSelect, {
            searchEnabled: true,
            searchPlaceholderValue: 'Search timeboxes...',
            placeholder: true,
            placeholderValue: '-- Select Source Timebox --'
        });

        targetTimeboxChoices = new Choices(targetTimeboxSelect, {
            searchEnabled: true,
            searchPlaceholderValue: 'Search timeboxes...',
            placeholder: true,
            placeholderValue: '-- Select Target Timebox --'
        });

        targetParentChoices = new Choices(targetParentSelect, {
            searchEnabled: true,
            searchPlaceholderValue: 'Search parents...',
            placeholder: true,
            placeholderValue: '-- Select Epic (Optional) --'
        });

        // Initialize filter dropdowns
        sourceOwnerFilterChoices = new Choices(sourceOwnerFilterSelect, {
            searchEnabled: true,
            placeholder: true,
            placeholderValue: 'All Owners'
        });

        sourceScheduleFilterChoices = new Choices(sourceScheduleFilterSelect, {
            searchEnabled: true,
            placeholder: true,
            placeholderValue: 'All Schedules'
        });

        targetOwnerFilterChoices = new Choices(targetOwnerFilterSelect, {
            searchEnabled: true,
            placeholder: true,
            placeholderValue: 'All Owners'
        });

        targetScheduleFilterChoices = new Choices(targetScheduleFilterSelect, {
            searchEnabled: true,
            placeholder: true,
            placeholderValue: 'All Schedules'
        });
    }

    // --- Add Password Toggle Functionality ---
    function setupPasswordToggles() {
        if (togglePasswordVisibility) {
            togglePasswordVisibility.addEventListener('click', () => {
                const type = v1PasswordInput.getAttribute('type') === 'password' ? 'text' : 'password';
                v1PasswordInput.setAttribute('type', type);
                togglePasswordVisibility.innerHTML = type === 'password' 
                    ? '<i class="bi bi-eye"></i>' 
                    : '<i class="bi bi-eye-slash"></i>';
            });
        }
        
        if (toggleTokenVisibility) {
            toggleTokenVisibility.addEventListener('click', () => {
                const type = v1TokenInput.getAttribute('type') === 'password' ? 'text' : 'password';
                v1TokenInput.setAttribute('type', type);
                toggleTokenVisibility.innerHTML = type === 'password' 
                    ? '<i class="bi bi-eye"></i>' 
                    : '<i class="bi bi-eye-slash"></i>';
            });
        }
    }

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
        const newPassword = v1PasswordInput.value; // Avoid trimming passwords

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
        let detailedError = null; 
        try {
            const response = await fetch(proxyUrl, options);

            if (!response.ok) {
                let errorMsg = `API Error: ${response.status} ${response.statusText}`;
                const errorBodyText = await response.text(); 
                detailedError = errorBodyText; 
                try {
                    const errorData = JSON.parse(errorBodyText);
                    if (errorData.message) {
                        detailedError = errorData.message;
                        errorMsg += ` - ${detailedError}`;
                    } else if (errorData.Exception) {
                        detailedError = errorData.Exception.Message || 'Unknown server exception';
                        errorMsg += ` - ${detailedError}`;
                    } else if (errorData.error) { 
                        detailedError = errorData.error + (errorData.details ? ` (${JSON.stringify(errorData.details)})` : ''); 
                        errorMsg = detailedError; 
                    }
                } catch (e) {
                    if (detailedError) { 
                        errorMsg += ` - ${detailedError}`;
                    }
                }
                // --- Return detailed error object instead of throwing immediately ---
                return { 
                    error: true, 
                    status: response.status, 
                    statusText: response.statusText, 
                    message: detailedError || errorMsg // Use detailedError if available
                };
                // throw new Error(errorMsg); // Old behavior
            }

            if (response.status === 204) { 
                return null;
            }

            return await response.json();
        } catch (error) {
            // This catch block now primarily handles network errors or unexpected issues
            console.error('API Call Failed (Network/Unexpected)');
            const displayMessage = `Network Error or unexpected issue: ${error.message}`;
            
            if (suppressStatusUpdate) {
                settingsStatus.textContent = displayMessage;
                settingsStatus.className = 'error';
            } else {
                 showStatus(displayMessage, true);
            }
             // --- Return a generic error object for network/other errors ---
            return { error: true, message: displayMessage, status: 0 }; 
            // return null; // Old behavior
        } finally {
            showLoading(false);
        }
    }

    // --- UI Update Functions ---
    function showLoading(isLoading) {
        loadingIndicator.style.display = isLoading ? 'flex' : 'none';
        if (isLoading) {
            loadingIndicator.classList.remove('d-none');
            loadingIndicator.classList.add('d-flex');
        } else {
            loadingIndicator.classList.add('d-none');
            loadingIndicator.classList.remove('d-flex');
        }
    }

    function showStatus(message, isError = false) {
        // Update both text and appearance
        const iconClass = isError ? 'bi-exclamation-triangle' : 'bi-info-circle';
        const alertClass = isError ? 'alert-danger' : 'alert-info';
        
        statusMessage.className = 'alert ' + alertClass;
        statusMessage.innerHTML = `<i class="bi ${iconClass} me-2"></i>${message}`;
        
        // Add animation for the status update
        statusMessage.classList.add('animate__animated', 'animate__fadeIn');
        setTimeout(() => {
            statusMessage.classList.remove('animate__animated', 'animate__fadeIn');
        }, 500);
    }

    function populateFilterDropdowns(timeboxes, isInitialLoad = true) {
        if (!timeboxes || !timeboxes.Assets || timeboxes.Assets.length === 0) {
            return;
        }

        // For source filters
        updateFilterOptions(
            timeboxes.Assets, 
            sourceOwnerFilterChoices, 
            sourceScheduleFilterChoices, 
            isInitialLoad
        );

        // For target filters
        updateFilterOptions(
            timeboxes.Assets, 
            targetOwnerFilterChoices, 
            targetScheduleFilterChoices, 
            isInitialLoad
        );
    }

    function updateFilterOptions(timeboxAssets, ownerChoices, scheduleChoices, isInitialLoad = false) {
        // Defensive check
        if (!ownerChoices || !scheduleChoices) {
            console.error("Choices instance not initialized in updateFilterOptions", { ownerChoices, scheduleChoices });
            return; 
        }
        // Get current selections
        const currentOwner = ownerChoices.getValue()?.value || ''; 
        const currentSchedule = scheduleChoices.getValue()?.value || ''; 

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

        // Format for Choices.js
        const ownerChoicesOptions = Array.from(availableOwners).sort().map(owner => ({
            value: owner,
            label: owner
        }));
        
        const scheduleChoicesOptions = Array.from(availableSchedules).sort().map(schedule => ({
            value: schedule,
            label: schedule
        }));

        // Only during initial load or when explicitly directed to update both dropdowns
        if (isInitialLoad) {
            ownerChoices.clearChoices();
            ownerChoices.setChoices([{ value: '', label: 'All Owners', selected: !currentOwner }].concat(ownerChoicesOptions));
            
            scheduleChoices.clearChoices();
            scheduleChoices.setChoices([{ value: '', label: 'All Schedules', selected: !currentSchedule }].concat(scheduleChoicesOptions));
            return;
        }

        // When not initial load, we only update the "complementary" dropdown
        if (ownerChoices.passedElement.element.dataset.lastChanged === 'true') {
            scheduleChoices.clearChoices();
            scheduleChoices.setChoices([{ value: '', label: 'All Schedules', selected: !currentSchedule }].concat(scheduleChoicesOptions));
            ownerChoices.passedElement.element.dataset.lastChanged = 'false';
        } else if (scheduleChoices.passedElement.element.dataset.lastChanged === 'true') {
            ownerChoices.clearChoices();
            ownerChoices.setChoices([{ value: '', label: 'All Owners', selected: !currentOwner }].concat(ownerChoicesOptions));
            scheduleChoices.passedElement.element.dataset.lastChanged = 'false';
        }
    }

    function filterTimeboxes(choicesInstance, ownerFilter, scheduleFilter) {
        // Clear current choices
        choicesInstance.clearStore();
        
        // --- Debug Log 1: Function entry and instance check ---
        console.log('filterTimeboxes called for:', choicesInstance?.passedElement?.element?.id, 'with filters:', { ownerFilter, scheduleFilter });
        if (!choicesInstance) {
            console.error('filterTimeboxes: choicesInstance is null!');
            return;
        }
        // --- End Debug Log 1 ---
        
        if (!allTimeboxes || !allTimeboxes.Assets) {
            console.warn('filterTimeboxes: allTimeboxes is not populated');
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

        // --- Debug Log 2: Filtered results ---
        console.log('filterTimeboxes: Filtered timeboxes count:', filteredTimeboxes.length);
        // console.log('filterTimeboxes: Filtered timeboxes data:', JSON.stringify(filteredTimeboxes)); // Uncomment for detailed data
        // --- End Debug Log 2 ---

        // Helper function to format date string
        const formatDate = (dateString) => {
            if (!dateString) return 'N/A';
            try {
                return dateString.substring(0, 10);
            } catch {
                return 'Invalid Date';
            }
        };

        // Sort timeboxes and format for Choices.js
        const timeboxOptions = filteredTimeboxes
            .sort((a, b) => {
                const nameA = a.Attributes?.Name?.value || '';
                const nameB = b.Attributes?.Name?.value || '';
                return nameA.localeCompare(nameB);
            })
            .map(tb => {
                const name = tb.Attributes?.Name?.value || 'Unnamed Timebox';
                const id = tb.id;
                const beginDate = formatDate(tb.Attributes?.BeginDate?.value);
                const endDate = formatDate(tb.Attributes?.EndDate?.value);
                const ownerName = tb.Attributes?.['Owner.Name']?.value || 'N/A';
                const scheduleName = tb.Attributes?.['Schedule.Name']?.value || 'N/A';
                
                return {
                    value: id,
                    label: `${name} (${beginDate} - ${endDate}) Owner: ${ownerName}, Schedule: ${scheduleName}`
                };
            });

        // --- Debug Log 3: Formatted options ---
        console.log('filterTimeboxes: Formatted options for Choices.js:', timeboxOptions);
        // --- End Debug Log 3 ---

        // Add placeholder option
        const placeholderOption = {
            value: '',
            label: '-- Select Timebox --', // Adjust label based on instance if needed
            placeholder: true
        };
        
        // Set choices with placeholder first
        // --- Debug Log 4: Before setChoices ---
        console.log(`filterTimeboxes: Calling setChoices on ${choicesInstance?.passedElement?.element?.id} with`, [placeholderOption].concat(timeboxOptions));
        // --- End Debug Log 4 ---
        choicesInstance.setChoices([placeholderOption].concat(timeboxOptions), 'value', 'label', true);
        
        // Handle no results
        if (filteredTimeboxes.length === 0) {
            choicesInstance.setChoices([
                placeholderOption,
                { value: 'no-match', label: '-- No matching timeboxes --', disabled: true }
            ], 'value', 'label', true);
             // --- Debug Log 5: No results ---
            console.log(`filterTimeboxes: Set 'no matching timeboxes' for ${choicesInstance?.passedElement?.element?.id}`);
            // --- End Debug Log 5 ---
        }
    }

    function populateTimeboxSelect(choicesInstance, timeboxes) {
        // Store the timeboxes for filtering if this is the first load
        if (timeboxes && timeboxes.Assets && (!allTimeboxes || !allTimeboxes.Assets)) {
            allTimeboxes = timeboxes;
            populateFilterDropdowns(timeboxes);
        }
        
        // Get appropriate filter values based on which dropdown is being populated
        let ownerFilter = '';
        let scheduleFilter = '';
        let ownerChoicesInstance = null;
        let scheduleChoicesInstance = null;

        if (choicesInstance === sourceTimeboxChoices) {
            ownerChoicesInstance = sourceOwnerFilterChoices;
            scheduleChoicesInstance = sourceScheduleFilterChoices;
        } else if (choicesInstance === targetTimeboxChoices) {
            ownerChoicesInstance = targetOwnerFilterChoices;
            scheduleChoicesInstance = targetScheduleFilterChoices;
        }

        // Defensive check
        if (ownerChoicesInstance && scheduleChoicesInstance) {
            ownerFilter = ownerChoicesInstance.getValue()?.value || ''; 
            scheduleFilter = scheduleChoicesInstance.getValue()?.value || '';
        } else {
            console.error("Filter Choices instance not found in populateTimeboxSelect", { ownerChoicesInstance, scheduleChoicesInstance });
        }
        
        filterTimeboxes(choicesInstance, ownerFilter, scheduleFilter);
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
            populateTimeboxSelect(sourceTimeboxChoices, timeboxes);
            populateTimeboxSelect(targetTimeboxChoices, timeboxes);
            showStatus('Timeboxes loaded.');
        } else {
            showStatus('Failed to load timeboxes. Check console and settings.', true);
            // Clear dropdowns if fetch failed
            populateTimeboxSelect(sourceTimeboxChoices, null);
            populateTimeboxSelect(targetTimeboxChoices, null);
        }
    }

    // --- Changed: Function to Populate Story Owner Filter (Choices.js version) ---
    function populateStoryOwnerFilter(stories) {
        console.log("populateStoryOwnerFilter called with", stories?.length, "stories."); // Log 1
        const owners = new Set();
        if (stories && stories.length > 0) {
            stories.forEach((story, index) => {
                const storyOwners = story.Attributes['Owners.Name']?.value;
                // console.log(`Story ${index} Owners raw:`, storyOwners); // Uncomment for very detailed logging
                if (storyOwners) {
                    if (Array.isArray(storyOwners)) {
                        storyOwners.forEach(owner => { if (owner) owners.add(owner); });
                    } else { // Single owner string
                        if (typeof storyOwners === 'string' && storyOwners) {
                           owners.add(storyOwners);
                        }
                    }
                }
            });
        }
        
        console.log("Found unique owners:", Array.from(owners)); // Log 3
        
        // Format choices options for Choices.js
        const ownerChoices = Array.from(owners).sort().map(owner => ({
            value: owner,
            label: owner
        }));
        
        console.log("Formatted owner choices for dropdown:", ownerChoices); // Log 4
        
        // Set choices using the Choices.js API
        if (storyOwnerChoices) {
            console.log("storyOwnerChoices instance found. Updating choices."); // Log 5
            storyOwnerChoices.clearChoices();
            storyOwnerChoices.setChoices(ownerChoices, 'value', 'label', true); // Pass 'value', 'label', and true (replace choices)
        } else {
            console.error("populateStoryOwnerFilter: storyOwnerChoices instance is null!"); // Log 5 (error case)
        }
    }

    // --- Changed: Function to Display Stories (Handles Multi-Owner Filtering) ---
    function displayStories(stories) {
        storiesListDiv.innerHTML = ''; // Clear previous list
        const ul = document.createElement('ul');
        let displayedCount = 0;

        // Get selected owners from the multi-select filter
        const selectedOwners = storyOwnerChoices ? 
            storyOwnerChoices.getValue().map(item => item.value) : [];
        const isFilterActive = selectedOwners.length > 0;

        stories.forEach(story => {
            const storyOwnersValue = story.Attributes['Owners.Name']?.value;
            let storyOwnersArray = [];
            if (storyOwnersValue) {
                 storyOwnersArray = Array.isArray(storyOwnersValue) ? storyOwnersValue : [storyOwnersValue];
            }
            
            // Apply owner filter - check if any of the story's owners are in the selected list
            let ownerMatch = false;
            if (!isFilterActive) {
                ownerMatch = true; // Show all if filter is not active
            } else {
                ownerMatch = storyOwnersArray.some(storyOwner => selectedOwners.includes(storyOwner));
            }

            if (!ownerMatch) {
                return; // Skip story if it doesn't match the selected owner filter
            }

            displayedCount++;
            const li = document.createElement('li');
            
            // Create checkbox with label in modern style
            const checkboxWrapper = document.createElement('div');
            checkboxWrapper.className = 'd-flex align-items-center';
            
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'form-check-input story-checkbox me-2';
            checkbox.value = story.id; // Keep full OID as value
            checkbox.id = `story-${story.id}`;
            
            // Store numeric ID in a data attribute
            const numericId = story.id.split(':')[1];
            if (numericId) {
                checkbox.dataset.numericId = numericId;
            } else {
                console.warn(`Could not extract numeric ID from ${story.id}`);
            }
            
            // Add change event listener that now also updates the counter
            checkbox.addEventListener('change', () => {
                checkCopyButtonState();
                updateSelectedCount();
            });

            const label = document.createElement('label');
            const storyName = story.Attributes?.Name?.value || 'Unnamed Story';
            const storyNumber = story.Attributes?.Number?.value || '';
            label.htmlFor = checkbox.id;
            label.className = 'form-check-label story-label';
            
            // Use badge for story number for better visibility
            const storyNumberBadge = document.createElement('span');
            storyNumberBadge.className = 'badge bg-secondary me-2';
            storyNumberBadge.textContent = storyNumber;
            
            // Use badge for owners with different color
            const ownersBadge = document.createElement('span');
            ownersBadge.className = 'badge bg-info ms-2';
            const ownersText = storyOwnersArray.length > 0 ? storyOwnersArray.join(', ') : 'No Owner';
            ownersBadge.textContent = ownersText;
            
            // Combine elements with proper structure
            label.appendChild(storyNumberBadge);
            label.appendChild(document.createTextNode(storyName));
            label.appendChild(ownersBadge);
            
            checkboxWrapper.appendChild(checkbox);
            checkboxWrapper.appendChild(label);
            li.appendChild(checkboxWrapper);

            // Display tasks (if any)
            const tasks = story.Attributes['Children:Task']?.value;
            const taskNames = story.Attributes['Children:Task.Name']?.value; 

            if (tasks && tasks.length > 0 && taskNames && taskNames.length === tasks.length) {
                const taskUl = document.createElement('ul');
                taskUl.className = 'task-list mt-2';
                tasks.forEach((taskRef, index) => {
                    const taskLi = document.createElement('li');
                    taskLi.className = 'task-item';
                    const taskName = taskNames[index] || 'Unnamed Task'; 
                    const taskIdRef = taskRef.idref; 
                    
                    // Add task icon
                    const taskIcon = document.createElement('i');
                    taskIcon.className = 'bi bi-check2-square me-2';
                    
                    taskLi.appendChild(taskIcon);
                    taskLi.appendChild(document.createTextNode(taskName));
                    
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
            const filterStatus = isFilterActive ? 'filtered' : 'loaded';
            showStatus(`${displayedCount} stories ${filterStatus}. Select stories to copy.`);
        } else if (isFilterActive) {
             storiesListDiv.innerHTML = '<div class="alert alert-warning"><i class="bi bi-exclamation-triangle me-2"></i>No stories match the selected owner filter(s).</div>';
             showStatus('No stories match filter.');
        } else {
             storiesListDiv.innerHTML = '<div class="alert alert-info"><i class="bi bi-info-circle me-2"></i>No active stories found in the selected timebox.</div>';
             showStatus('No active stories found.');
        }
        checkCopyButtonState(); // Update button state
        updateSelectedCount(); // Update count badge
    }

    async function fetchStoriesAndTasks(timeboxId) {
        if (!timeboxId) {
            storiesListDiv.innerHTML = '<p>Please select a source timebox first.</p>';
            copyButton.disabled = true;
            currentStories = []; // Clear stored stories
            populateStoryOwnerFilter(currentStories); // Clear owner filter
            return;
        }
        showStatus(`Fetching stories...`);
        storiesListDiv.innerHTML = ''; // Clear previous list
        copyButton.disabled = true;
        currentStories = []; // Clear stored stories before fetch
        populateStoryOwnerFilter(currentStories); // Clear owner filter

        // Construct the query - Changed Team.Name to Owners.Name
        const storyQuery = `rest-1.v1/Data/Story?sel=Name,Number,Description,Parent.ID,Children:Task,Task.Name,Task.Description,Owners.Name&where=Timebox.ID='${timeboxId}'`;
        const storyResponse = await v1ApiCall(storyQuery);
        if (!storyResponse || !storyResponse.Assets) {
            showStatus('No stories found or error fetching stories.', true);
            showLoading(false);
            return;
        }

        if (storyResponse.Assets.length > 0) {
            currentStories = storyResponse.Assets; // Store fetched stories
            populateStoryOwnerFilter(currentStories); // Populate the owner filter dropdown
            displayStories(currentStories); // Initial display (no filter active yet)
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
        const targetTimeboxSelected = targetTimeboxChoices.getValue()?.value !== '';
        copyButton.disabled = !(selectedStories.length > 0 && targetTimeboxSelected);
    }

    async function copySelectedItems() {
        const storiesToCopy = getSelectedStories();
        const targetTimeboxId = targetTimeboxChoices.getValue()?.value;
        const targetParentId = targetParentChoices.getValue()?.value; // Might be "" if not selected

        // Button state check no longer includes targetParentId mandatory check
        if (storiesToCopy.length === 0 || !targetTimeboxId) {
            showStatus('Please select stories and a target timebox.', true);
            return;
        }

        showStatus(`Starting copy of ${storiesToCopy.length} stories...`);
        copyButton.disabled = true; 

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
            let originalStory = null; // Initialize originalStory data
            let sourceAttributes = null;
            const originalStoryNumberForLog = storyOid; // Use OID for initial logs
            
            try {
                showStatus(`Processing story ${i+1} of ${storiesToCopy.length}...`);

                // --- Fetch Original Story with Fallback for Custom_AcceptanceCriteria ---
                const baseSel = 'Name,Number,Description,Scope,Priority,Team,Owners,Estimate,Order,Super,AffectedByDefects,AssetState,TaggedWith';
                const optionalField = 'Custom_AcceptanceCriteria';
                const fullSel = `${baseSel},${optionalField}`; // Try with optional field first
                let fetchErrorOccurred = false;

                console.log(`Attempting to fetch story ${storyNumericId} with sel: ${fullSel}`);
                let storyResponse = await v1ApiCall(`rest-1.v1/Data/Story/${storyNumericId}?sel=${fullSel}`);
                
                // Check if the first attempt failed specifically due to the optional field
                if (storyResponse?.error && storyResponse.message?.includes(optionalField)) {
                    console.warn(`Fetching story ${storyNumericId} failed due to ${optionalField}. Retrying without it.`);
                    showStatus(`Retrying fetch for story ${storyOid} without optional field...`);
                    storyResponse = await v1ApiCall(`rest-1.v1/Data/Story/${storyNumericId}?sel=${baseSel}`);
                }
                
                // Check the final response (either from first or second attempt)
                if (!storyResponse || storyResponse.error) {
                    fetchErrorOccurred = true;
                    const errorDetail = storyResponse?.message || 'Unknown fetch error';
                    console.error(`Failed to fetch details for story ${storyOid}. Error: ${errorDetail}`);
                    showStatus(`Error fetching details for story ${storyOid}: ${errorDetail}`, true);
                    // errorCount++; // Increment error count later if we cannot proceed
                    // continue; // Don't continue yet, try closing first
                } else {
                    originalStory = storyResponse; // Assign successful response
                    sourceAttributes = originalStory.Attributes;
                    console.log(`Successfully fetched details for story ${storyOid}`);
                }
                // --- End Fetch Original Story ---
                
                // Use fetched Number for subsequent logs if available
                const currentStoryNumberLog = sourceAttributes?.Number?.value || originalStoryNumberForLog;

                // --- Close Original Story If Not Already Closed --- 
                // Proceed even if fetch failed, maybe closing works?
                const closedStateId = 128; 
                const closeOperationName = 'QuickClose';
                let isAlreadyClosed = sourceAttributes?.AssetState?.value === closedStateId;

                if (!isAlreadyClosed) {
                    showStatus(`Attempting to close original story ${currentStoryNumberLog} via operation '${closeOperationName}'...`);
                    try {
                        const closeResponse = await v1ApiCall(`rest-1.v1/Data/Story/${storyNumericId}?op=${closeOperationName}`, 'POST', null); 
                        
                        // Check for errors returned by v1ApiCall
                        if (closeResponse?.error) {
                             console.error(`Operation '${closeOperationName}' failed for story ${currentStoryNumberLog}. Error: ${closeResponse.message}`);
                             showStatus(`Warning: Operation '${closeOperationName}' failed for story ${currentStoryNumberLog}. Copy will proceed if possible.`, true);
                        } else {
                            showStatus(`Original story ${currentStoryNumberLog} closed via operation. Proceeding with copy...`);
                            // Optimistically update local state if closing succeeded
                            if (sourceAttributes?.AssetState) {
                                sourceAttributes.AssetState.value = closedStateId;
                            }
                            isAlreadyClosed = true; // Mark as closed now
                        }
                    } catch (closeError) {
                        // Catch unexpected errors during the close call itself
                        console.error(`Unexpected error executing operation '${closeOperationName}' on story ${currentStoryNumberLog}:`, closeError);
                        showStatus(`Warning: Error closing original story ${currentStoryNumberLog} via operation. Copying anyway...`, true);
                    }
                } else {
                     showStatus(`Original story ${currentStoryNumberLog} already closed. Proceeding with copy...`);
                }
                // --- End Close Original Story ---

                // --- If fetching failed initially, we cannot proceed with copy ---
                if (fetchErrorOccurred || !originalStory || !sourceAttributes) {
                    console.error(`Cannot copy story ${storyOid} due to earlier fetch failure.`);
                    showStatus(`Skipping copy for story ${storyOid} due to fetch error.`, true);
                    errorCount++;
                    continue; // Skip to the next story
                }
                // --- End Fetch Failure Check ---

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
                        // Include Super only if not skipping
                        ...(!skipSuperAttribute && { Super: { value: superIdToUse, act: 'set' } }),

                        // Use target timebox scope or original scope
                        ...(targetTimeboxScope ? 
                            { Scope: { value: targetTimeboxScope, act: 'set' } } : 
                            (sourceAttributes.Scope && sourceAttributes.Scope.value && 
                             { Scope: { value: sourceAttributes.Scope.value.idref, act: 'set' } })
                        ),
                        
                        // --- Conditionally add Acceptance Criteria --- 
                        ...(sourceAttributes[optionalField] && sourceAttributes[optionalField].value !== null && { 
                            [optionalField]: { value: sourceAttributes[optionalField].value, act: 'set' } 
                        }),
                        // --- Other attributes ---
                        ...(sourceAttributes.Description && { Description: { value: sourceAttributes.Description.value, act: 'set' } }),
                        ...(sourceAttributes.Priority && sourceAttributes.Priority.value && { Priority: { value: sourceAttributes.Priority.value.idref, act: 'set' } }),
                        ...(sourceAttributes.Team && sourceAttributes.Team.value && { Team: { value: sourceAttributes.Team.value.idref, act: 'set' } }),
                        ...(sourceAttributes.Estimate && sourceAttributes.Estimate.value !== null && { Estimate: { value: sourceAttributes.Estimate.value, act: 'set' } }),
                        ...(sourceAttributes.TaggedWith && sourceAttributes.TaggedWith.value && sourceAttributes.TaggedWith.value.length > 0 && { TaggedWith: { value: sourceAttributes.TaggedWith.value, act: 'set' } }),
                        // --- End Added Fields ---
                        
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
                
                // Remove Super attribute entirely if skipSuperAttribute is true
                if (skipSuperAttribute) {
                    delete newStoryPayload.Attributes.Super;
                }

                // 3. Create the new story
                const createStoryResponse = await v1ApiCall('rest-1.v1/Data/Story', 'POST', newStoryPayload);
                
                // Check for errors returned by v1ApiCall
                if (!createStoryResponse || createStoryResponse.error) {
                    const errorDetail = createStoryResponse?.message || 'Unknown create error';
                    console.error(`Failed to create copy for story ${storyOid}. Error: ${errorDetail}`);
                    showStatus(`Error creating copy for ${storyOid}: ${errorDetail}`, true);
                    errorCount++;
                    continue; // Skip to next story
                }
                const newStoryId = createStoryResponse.id;
                showStatus(`Created new story ${newStoryId}. Fetching original tasks...`);

                // 4. Fetch original tasks separately
                let originalTasks = [];
                const taskSel = 'Name,Description,Category,Owners,ToDo,Status.ID,TaggedWith';
                try {
                    const tasksResponse = await v1ApiCall(`rest-1.v1/Data/Task?sel=${taskSel}&where=Parent=\'${storyOid}\'`);
                    
                    if (tasksResponse && !tasksResponse.error && tasksResponse.Assets) {
                        originalTasks = tasksResponse.Assets;
                        showStatus(`Found ${originalTasks.length} tasks for ${storyOid}. Copying...`);
                    } else if (tasksResponse?.error) {
                        showStatus(`Warning: Could not fetch tasks for story ${storyOid} due to error: ${tasksResponse.message}. Story copied without tasks.`, true);
                    } else {
                        showStatus(`No tasks found for ${storyOid}. Continuing...`);
                    }
                } catch (error) {
                    console.error(`Unexpected error fetching tasks for story ${storyOid}:`, error);
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
                                }),

                                // --- Add Task Tags (Corrected) --- 
                                ...(taskAttributes.TaggedWith?.value && taskAttributes.TaggedWith.value.length > 0 && {
                                    TaggedWith: {
                                        act: "set", // Use set for tags
                                        value: taskAttributes.TaggedWith.value 
                                    }
                                })
                                // --- End Add Task Tags ---
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
                // Catch any truly unexpected errors within the loop
                console.error(`Unexpected error copying story ${storyOid}:`, error);
                showStatus(`Unexpected error copying story ${storyOid}: ${error.message}`, true);
                errorCount++;
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

        if (result && result.Assets && result.Assets.length > 0) { // Check if result and Assets array exist
            // Access the username from the first asset in the array
            const username = result.Assets[0].Attributes?.Username?.value || 'unknown user'; 
            settingsStatus.textContent = `Connection successful! Authenticated as ${username}.`;
            settingsStatus.className = 'success';
            // Load both in parallel with timeout
            loadInitialData();
        } else {
            // Error message handled by v1ApiCall or result structure is unexpected
            // Ensure settingsStatus reflects the failure if v1ApiCall didn't already set it
            if (!settingsStatus.textContent.includes('failed') && !settingsStatus.textContent.includes('Error')) {
                 settingsStatus.textContent = 'Connection test failed: Could not retrieve user information.';
                 settingsStatus.className = 'error';
            }
            // Clear dropdowns if connection fails
            populateTimeboxSelect(sourceTimeboxChoices, null);
            populateTimeboxSelect(targetTimeboxChoices, null);
            populateParentSelect(targetParentChoices, null);
        }
    }

    // --- Modified Function to Fetch Target Parents ---
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
            populateParentSelect(targetParentChoices, parents); // Pass the Choices instance
            showStatus('Target parents loaded.', false); // Clear previous status if successful
        } else {
            showStatus(`Failed to load target parents (${parentAssetType}). Check asset type and console.`, true);
            populateParentSelect(targetParentChoices, null); // Pass the Choices instance
        }
    }

    // --- Modified Function to Populate Parent Select (using Choices API) ---
    function populateParentSelect(choicesInstance, parents) { 
        // --- Add Defensive Check --- 
        if (!choicesInstance) {
            console.error("populateParentSelect called with null choicesInstance");
            return; // Exit if the instance isn't initialized
        }
        // --- End Defensive Check ---
        
        choicesInstance.clearStore(); // Clear previous selections and choices

        const placeholder = { 
            value: '', 
            label: '-- Select Target Parent (Optional) --', 
            selected: true, 
            disabled: false, 
            placeholder: true 
        };
        
        let parentOptions = [placeholder]; // Start with the placeholder

        if (parents && parents.Assets) {
            const sortedParents = parents.Assets
                .sort((a, b) => {
                    const nameA = a.Attributes?.Name?.value || '';
                    const nameB = b.Attributes?.Name?.value || '';
                    return nameA.localeCompare(nameB);
                })
                .map(p => {
                    const name = p.Attributes?.Name?.value || 'Unnamed Parent';
                    const number = p.Attributes?.Number?.value || '';
                    const id = p.id;
                    return {
                        value: id, // Store the full OID (e.g., Epic:123)
                        label: `${number} - ${name}`
                    };
                });
            parentOptions = parentOptions.concat(sortedParents);
        } else {
             console.warn("No target parents found or invalid format:", parents);
             // Optional: Add a disabled option if no parents found
             // parentOptions.push({ value: 'no-parents', label: '-- No parents found --', disabled: true });
        }

        choicesInstance.setChoices(parentOptions, 'value', 'label', true); // Replace choices using Choices API
    }

    // --- Event Listeners ---
    loadStoriesButton.addEventListener('click', () => fetchStoriesAndTasks(sourceTimeboxChoices.getValue()?.value));
    copyButton.addEventListener('click', copySelectedItems);
    sourceTimeboxSelect.addEventListener('change', () => {
        storiesListDiv.innerHTML = '<p>Click "Load Stories" to fetch items for the selected timebox.</p>'; // Clear stories when source changes
        copyButton.disabled = true; // Disable copy button
        currentStories = []; // Clear stories
        populateStoryOwnerFilter(currentStories); // Clear owner filter
    });
    targetTimeboxSelect.addEventListener('change', checkCopyButtonState);
    targetParentSelect.addEventListener('change', checkCopyButtonState);

    // Add filter event listeners
    sourceOwnerFilterSelect.addEventListener('choice', () => {
        sourceOwnerFilterSelect.dataset.lastChanged = 'true';
        populateFilterDropdowns(allTimeboxes, false);
        populateTimeboxSelect(sourceTimeboxChoices, allTimeboxes);
        // Clear any selected stories when filter changes
        storiesListDiv.innerHTML = '<div class="alert alert-info"><i class="bi bi-info-circle me-2"></i>Select a timebox and click "Load Stories".</div>';
        copyButton.disabled = true;
        updateSelectedCount();
    });
    
    sourceScheduleFilterSelect.addEventListener('choice', () => {
        sourceScheduleFilterSelect.dataset.lastChanged = 'true';
        populateFilterDropdowns(allTimeboxes, false);
        populateTimeboxSelect(sourceTimeboxChoices, allTimeboxes);
        // Clear any selected stories when filter changes
        storiesListDiv.innerHTML = '<div class="alert alert-info"><i class="bi bi-info-circle me-2"></i>Select a timebox and click "Load Stories".</div>';
        copyButton.disabled = true;
        updateSelectedCount();
    });
    
    targetOwnerFilterSelect.addEventListener('choice', () => {
        targetOwnerFilterSelect.dataset.lastChanged = 'true';
        populateFilterDropdowns(allTimeboxes, false);
        populateTimeboxSelect(targetTimeboxChoices, allTimeboxes);
        checkCopyButtonState();
    });
    
    targetScheduleFilterSelect.addEventListener('choice', () => {
        targetScheduleFilterSelect.dataset.lastChanged = 'true';
        populateFilterDropdowns(allTimeboxes, false);
        populateTimeboxSelect(targetTimeboxChoices, allTimeboxes);
        checkCopyButtonState();
    });

    // --- Changed: Event Listener for Story Owner Filter ---
    storyOwnerFilterSelect.addEventListener('change', () => {
        console.log('Story Owner Filter changed!');
        if (!storyOwnerChoices) {
            console.error('storyOwnerChoices instance is null in event listener');
            return;
        }
        const selectedItems = storyOwnerChoices.getValue();
        console.log('Selected Owner Items:', selectedItems);
        const selectedValues = storyOwnerChoices.getValue(true);
        console.log('Selected Owner Values:', selectedValues);
        console.log('Current stories available for filtering:', currentStories?.length);
        displayStories(currentStories);
    });

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

    // --- Function to update the selected count badge ---
    function updateSelectedCount() {
        const selectedStories = getSelectedStories();
        selectedCountBadge.textContent = selectedStories.length;
        
        // Add animation for the counter
        selectedCountBadge.classList.add('badge-pulse');
        setTimeout(() => {
            selectedCountBadge.classList.remove('badge-pulse');
        }, 500);
    }

    // --- Add a function to setup event listeners for Choices.js instances ---
    function setupChoicesEventListeners() {
        // Source filter events
        sourceOwnerFilterSelect.addEventListener('choice', () => {
            sourceOwnerFilterSelect.dataset.lastChanged = 'true';
            populateFilterDropdowns(allTimeboxes, false);
            populateTimeboxSelect(sourceTimeboxChoices, allTimeboxes);
            // Clear any selected stories when filter changes
            storiesListDiv.innerHTML = '<div class="alert alert-info"><i class="bi bi-info-circle me-2"></i>Select a timebox and click "Load Stories".</div>';
            copyButton.disabled = true;
            updateSelectedCount();
        });
        
        sourceScheduleFilterSelect.addEventListener('choice', () => {
            sourceScheduleFilterSelect.dataset.lastChanged = 'true';
            populateFilterDropdowns(allTimeboxes, false);
            populateTimeboxSelect(sourceTimeboxChoices, allTimeboxes);
            // Clear any selected stories when filter changes
            storiesListDiv.innerHTML = '<div class="alert alert-info"><i class="bi bi-info-circle me-2"></i>Select a timebox and click "Load Stories".</div>';
            copyButton.disabled = true;
            updateSelectedCount();
        });
        
        // Target filter events
        targetOwnerFilterSelect.addEventListener('choice', () => {
            targetOwnerFilterSelect.dataset.lastChanged = 'true';
            populateFilterDropdowns(allTimeboxes, false);
            populateTimeboxSelect(targetTimeboxChoices, allTimeboxes);
            checkCopyButtonState();
        });
        
        targetScheduleFilterSelect.addEventListener('choice', () => {
            targetScheduleFilterSelect.dataset.lastChanged = 'true';
            populateFilterDropdowns(allTimeboxes, false);
            populateTimeboxSelect(targetTimeboxChoices, allTimeboxes);
            checkCopyButtonState();
        });
        
        // Main dropdown events
        sourceTimeboxSelect.addEventListener('choice', () => {
            storiesListDiv.innerHTML = '<div class="alert alert-info"><i class="bi bi-info-circle me-2"></i>Click "Load Stories" to fetch items for the selected timebox.</div>';
            copyButton.disabled = true;
            updateSelectedCount();
        });
        
        targetTimeboxSelect.addEventListener('choice', checkCopyButtonState);
        targetParentSelect.addEventListener('choice', checkCopyButtonState);
        
        // Story owner filter event
        storyOwnerFilterSelect.addEventListener('change', () => {
            displayStories(currentStories);
        });
    }

    // --- Initial Load and Setup ---
    function initializeApp() {
        // Initialize UI components
        initChoices();
        setupPasswordToggles();
        setupChoicesEventListeners();
        loadSettings();
        
        // Setup main button event listeners
        loadStoriesButton.addEventListener('click', () => {
            const timeboxId = sourceTimeboxChoices.getValue()?.value;
            fetchStoriesAndTasks(timeboxId);
        });
        
        copyButton.addEventListener('click', copySelectedItems);
        saveSettingsButton.addEventListener('click', saveSettings);
        
        // Setup auth method radio buttons
        authTokenRadio.addEventListener('change', toggleAuthInputs);
        authBasicRadio.addEventListener('change', toggleAuthInputs);
        authNtlmRadio.addEventListener('change', toggleAuthInputs);
        
        // Initialize the selected count
        updateSelectedCount();
    }

    // Start the app
    initializeApp();
});
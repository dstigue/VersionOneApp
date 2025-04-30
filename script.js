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
    const selectedCountBadge = document.getElementById('selected-count');
    const selectAllCheckbox = document.getElementById('select-all-stories');
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
    let targetOwnerFilterChoices = null;

    // Create filter elements
    const sourceOwnerFilterSelect = document.createElement('select');
    sourceOwnerFilterSelect.id = 'source-owner-filter';
    sourceOwnerFilterSelect.className = 'filter-select';
    
    const targetOwnerFilterSelect = document.createElement('select');
    targetOwnerFilterSelect.id = 'target-owner-filter';
    targetOwnerFilterSelect.className = 'filter-select';

    // Add filter elements to the DOM
    const sourceFiltersDiv = document.createElement('div');
    sourceFiltersDiv.className = 'filters-container';
    
    // Create filter groups with proper labeling
    const sourceOwnerGroup = document.createElement('div');
    sourceOwnerGroup.className = 'filter-group';
    sourceOwnerGroup.innerHTML = '<label for="source-owner-filter">Owner:</label>';
    sourceOwnerGroup.appendChild(sourceOwnerFilterSelect);
    
    sourceFiltersDiv.appendChild(document.createElement('div')).innerHTML = '<div class="filter-label">Filter by:</div>';
    sourceFiltersDiv.appendChild(sourceOwnerGroup);
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
    
    targetFiltersDiv.appendChild(document.createElement('div')).innerHTML = '<div class="filter-label">Filter by:</div>';
    targetFiltersDiv.appendChild(targetOwnerGroup);
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

        targetOwnerFilterChoices = new Choices(targetOwnerFilterSelect, {
            searchEnabled: true,
            placeholder: true,
            placeholderValue: 'All Owners'
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
            isInitialLoad
        );

        // For target filters
        updateFilterOptions(
            timeboxes.Assets, 
            targetOwnerFilterChoices, 
            isInitialLoad
        );
    }

    function updateFilterOptions(timeboxAssets, ownerChoices, isInitialLoad = false) {
        // Defensive check
        if (!ownerChoices) {
            console.error("Owner Choices instance not initialized in updateFilterOptions", { ownerChoices });
            return; 
        }
        // Get current selections
        const currentOwner = ownerChoices.getValue()?.value || ''; 

        // Collect available options based on current filters
        const availableOwners = new Set();

        timeboxAssets.forEach(tb => {
            const owner = tb.Attributes?.['Owner.Name']?.value || '';
            
            // Always add owner if present
            if (owner) availableOwners.add(owner);
        });

        // Format for Choices.js
        const ownerChoicesOptions = Array.from(availableOwners).sort().map(owner => ({
            value: owner,
            label: owner
        }));
        
        // Update owner dropdown
        ownerChoices.clearChoices();
        ownerChoices.setChoices([{ value: '', label: 'All Owners', selected: !currentOwner }].concat(ownerChoicesOptions));
    }

    function filterTimeboxes(choicesInstance, ownerFilter) {
        choicesInstance.clearStore();
        
        if (!allTimeboxes || !allTimeboxes.Assets) {
            console.warn('filterTimeboxes: allTimeboxes is not populated');
            return;
        }

        // Apply filters
        const filteredTimeboxes = allTimeboxes.Assets.filter(tb => {
            const owner = tb.Attributes?.['Owner.Name']?.value || '';
            
            const ownerMatch = !ownerFilter || owner === ownerFilter;
            
            return ownerMatch;
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
                
                return {
                    value: id,
                    label: `${name} (${beginDate} - ${endDate}) Owner: ${ownerName}`
                };
            });

        // Add placeholder option
        const placeholderOption = {
            value: '',
            label: '-- Select Timebox --', // Adjust label based on instance if needed
            placeholder: true
        };
        
        choicesInstance.setChoices([placeholderOption].concat(timeboxOptions), 'value', 'label', true);
        
        // Handle no results
        if (filteredTimeboxes.length === 0) {
            choicesInstance.setChoices([
                placeholderOption,
                { value: 'no-match', label: '-- No matching timeboxes --', disabled: true }
            ], 'value', 'label', true);
        }
    }

    function populateTimeboxSelect(choicesInstance, timeboxes) {
        // Store the timeboxes for filtering if this is the first load
        if (timeboxes && timeboxes.Assets && (!allTimeboxes || !allTimeboxes.Assets || allTimeboxes.Assets.length === 0)) { // Ensure allTimeboxes is properly checked/set
            allTimeboxes = timeboxes;
            populateFilterDropdowns(timeboxes, true); // Use true for initial load population
        } else if (allTimeboxes?.Assets?.length > 0) {
             // If timeboxes already exist, just repopulate filters (not initial load)
            // This might be redundant if filters are updated elsewhere, consider if needed
            // populateFilterDropdowns(allTimeboxes, false); 
        }
        
        // Get appropriate filter values based on which dropdown is being populated
        let ownerFilter = '';
        let ownerChoicesInstance = null;

        if (choicesInstance === sourceTimeboxChoices) {
            ownerChoicesInstance = sourceOwnerFilterChoices;
        } else if (choicesInstance === targetTimeboxChoices) {
            ownerChoicesInstance = targetOwnerFilterChoices;
        }

        // Defensive check
        if (ownerChoicesInstance) {
            ownerFilter = ownerChoicesInstance.getValue()?.value || ''; 
        } else {
            console.error("Owner Filter Choices instance not found in populateTimeboxSelect", { ownerChoicesInstance });
        }
        
        filterTimeboxes(choicesInstance, ownerFilter);
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

        // Fetch only active timeboxes - REMOVED Schedule.Name
        const timeboxSelectFields = 'Name,BeginDate,EndDate,Owner.Name';
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
        const owners = new Set();
        if (stories && stories.length > 0) {
            stories.forEach((story, index) => {
                const storyOwners = story.Attributes['Owners.Name']?.value;
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
        
        // Format choices options for Choices.js
        const ownerChoicesOptions = Array.from(owners).sort().map(owner => ({
            value: owner,
            label: owner
        }));
        
        // Set choices using the Choices.js API
        if (storyOwnerChoices) {
            storyOwnerChoices.clearStore();
            storyOwnerChoices.setChoices(ownerChoicesOptions, 'value', 'label', true);
        } else {
            console.error("populateStoryOwnerFilter: storyOwnerChoices instance is null!");
        }
    }

    // --- Changed: Function to Display Stories (Handles Multi-Owner Filtering) ---
    function displayStories(stories) {
        storiesListDiv.innerHTML = '';
        selectAllCheckbox.checked = false;
        selectAllCheckbox.indeterminate = false;
        const ul = document.createElement('ul');
        ul.className = 'list-unstyled';
        const ownerFilter = storyOwnerChoices ? storyOwnerChoices.getValue().map(owner => owner.value) : [];
        let displayedCount = 0;
        let filterStatus = ownerFilter.length > 0 ? `filtered by owner(s): ${ownerFilter.join(', ')}` : "(displaying all)";

        stories.forEach(story => {
            // --- Filtering Logic (remains the same) ---
            const storyOwnersValue = story.Attributes['Owners.Name']?.value;
            let storyOwnersArray = [];
            if (storyOwnersValue) {
                 storyOwnersArray = Array.isArray(storyOwnersValue) ? storyOwnersValue : [storyOwnersValue];
            }
            let ownerMatch = false;
            if (!ownerFilter.length) {
                ownerMatch = true;
            } else {
                ownerMatch = storyOwnersArray.some(storyOwner => storyOwner && ownerFilter.includes(storyOwner));
            }
            if (!ownerMatch) {
                return; // Skip story if it doesn't match filter
            }
            displayedCount++;
            // --- End Filtering Logic ---

            const li = document.createElement('li'); // Create li for the story

            // --- Story Checkbox/Label/Badges (remains the same) ---
            const checkboxWrapper = document.createElement('div');
            checkboxWrapper.className = 'd-flex align-items-center';
            
            const label = document.createElement('label');
            const storyId = story.id;
            label.htmlFor = `story-${storyId}`;
            label.className = 'form-check-label story-label flex-grow-1';

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'form-check-input story-checkbox me-2';
            checkbox.value = storyId;
            checkbox.id = `story-${storyId}`;
            checkbox.dataset.storyOid = storyId;
            const numericId = storyId.split(':')[1];
            if (numericId) {
                checkbox.dataset.numericId = numericId;
            } else {
                console.warn(`Could not extract numeric ID from ${storyId}`);
            }
            
            label.appendChild(checkbox);
            
            const storyName = story.Attributes?.Name?.value || 'Unnamed Story';
            const storyNumber = story.Attributes?.Number?.value || '';
            
            const storyNumberBadge = document.createElement('span');
            storyNumberBadge.className = 'badge bg-secondary me-2';
            storyNumberBadge.textContent = storyNumber;
            
            const ownersBadge = document.createElement('span');
            ownersBadge.className = 'badge bg-info ms-2';
            const ownersText = storyOwnersArray.length > 0 ? storyOwnersArray.join(', ') : 'No Owner';
            ownersBadge.textContent = ownersText;
            
            label.appendChild(storyNumberBadge);
            label.appendChild(document.createTextNode(` ${storyName} `));
            label.appendChild(ownersBadge);
            
            checkboxWrapper.appendChild(label);
            li.appendChild(checkboxWrapper);
            // --- End Story Checkbox/Label/Badges ---


            // --- Task Display Logic ---
            const tasks = story.Attributes['Children:Task']?.value;
            const taskNames = story.Attributes['Children:Task.Name']?.value;
            const taskNumbers = story.Attributes['Children:Task.Number']?.value;
            const taskToDos = story.Attributes['Children:Task.ToDo']?.value; // Get ToDo array

            // --- Relaxed IF Condition ---
            if (tasks && tasks.length > 0) {

                const taskUl = document.createElement('ul');
                taskUl.className = 'task-list mt-2';

                tasks.forEach((taskRef, index) => {
                    // --- Access data using index, with added safety ---
                    const taskName = (taskNames && index < taskNames.length) ? taskNames[index] : 'Unnamed Task';
                    const taskNumber = (taskNumbers && index < taskNumbers.length) ? taskNumbers[index] : '';
                    const taskIdRef = taskRef.idref;
                    const taskToDoRaw = (taskToDos && index < taskToDos.length) ? taskToDos[index] : null; // Safe access
                    // --------------------------------

                    // --- Task Item Creation (li, label, checkbox) ---
                    const taskLi = document.createElement('li');
                    taskLi.className = 'task-item';
                    const taskLabel = document.createElement('label');
                    const taskCheckboxId = `task-${taskIdRef || index}`;
                    taskLabel.htmlFor = taskCheckboxId;
                    taskLabel.className = 'form-check-label task-label d-flex align-items-center w-100';
                    const taskCheckbox = document.createElement('input');
                    taskCheckbox.type = 'checkbox';
                    taskCheckbox.className = 'form-check-input task-checkbox me-2';
                    taskCheckbox.value = taskIdRef;
                    taskCheckbox.id = taskCheckboxId;
                    taskCheckbox.dataset.storyOid = story.id;
                    taskCheckbox.dataset.taskId = taskIdRef;
                    // --- End Task Item Creation ---


                    // --- Calculate ToDo & Create Badges ---
                    let taskToDoHours = '0';
                    if (taskToDoRaw !== null && taskToDoRaw !== undefined) {
                        const parsedToDo = parseFloat(taskToDoRaw);
                        taskToDoHours = !isNaN(parsedToDo) ? parsedToDo.toFixed(2) : '0';
                    }
                    const hoursBadge = document.createElement('span');
                    hoursBadge.className = 'task-hours badge bg-success ms-auto ps-2 pe-2';
                    hoursBadge.textContent = `${taskToDoHours}h`;

                    const taskNumberBadge = document.createElement('span');
                    taskNumberBadge.className = 'badge bg-secondary me-2';
                    taskNumberBadge.textContent = taskNumber;
                    // --- End Calculate ToDo & Create Badges ---


                    // --- Append elements to task label ---
                    taskLabel.appendChild(taskCheckbox);
                    if (taskNumber) { // Only add badge if number exists and is not empty
                        taskLabel.appendChild(taskNumberBadge);
                    }
                    taskLabel.appendChild(document.createTextNode(` ${taskName} `)); // Use safely accessed taskName
                    taskLabel.appendChild(hoursBadge);
                    // --- End Append elements to task label ---

                    taskLi.appendChild(taskLabel);
                    taskUl.appendChild(taskLi);
                });
                li.appendChild(taskUl); // Append the populated task list to the story li
            } // End if (tasks && tasks.length > 0)

            // --- Append Story LI to Main UL ---
            // This ensures the story LI is added regardless of whether tasks were rendered
            ul.appendChild(li);
            // --- End Append Story LI ---

        }); // End stories.forEach

        // --- Final updates after loop (remains the same) ---
        const initialState = calculateSelectAllState();
        applySelectAllState(initialState);
        selectAllCheckbox.disabled = initialState.disabled;
        storiesListDiv.appendChild(ul);
        showStatus(`${displayedCount} stories ${filterStatus}. Select stories to copy.`);
        // --- End Final updates ---
    }

    // --- Calculate the desired state for the Select All checkbox ---
    function calculateSelectAllState() {
        // Consider ALL visible checkboxes (stories AND tasks)
        const allCheckboxes = storiesListDiv.querySelectorAll('input[type="checkbox"].story-checkbox, input[type="checkbox"].task-checkbox');
        const checkedCheckboxes = storiesListDiv.querySelectorAll('input[type="checkbox"].story-checkbox:checked, input[type="checkbox"].task-checkbox:checked');
        
        const totalCount = allCheckboxes.length;
        const checkedCount = checkedCheckboxes.length;

        let state = { checked: false, indeterminate: false, disabled: true };

        if (totalCount === 0) {
            // Keep default state (disabled, unchecked, not indeterminate)
        } else if (checkedCount === totalCount) {
            // All checked
            state = { checked: true, indeterminate: false, disabled: false };
        } else if (checkedCount === 0) {
            // None checked
            state = { checked: false, indeterminate: false, disabled: false };
        } else {
            // Some checked (indeterminate state)
            state = { checked: false, indeterminate: true, disabled: false };
        }
        return state;
    }

    // --- Apply a calculated state to the Select All checkbox ---
    function applySelectAllState(state) {
        selectAllCheckbox.checked = state.checked;
        selectAllCheckbox.indeterminate = state.indeterminate;
        selectAllCheckbox.disabled = state.disabled;
    }

    // --- Original function now acts as a wrapper ---
    function updateSelectAllCheckboxState() {
        const state = calculateSelectAllState();
        applySelectAllState(state);
    }

    // --- New Function: Get Selected Stories AND Tasks for Copy ---
    function getSelectedItemsForCopy() {
        const selectedItems = [];
        const checkedStoryCheckboxes = storiesListDiv.querySelectorAll('input[type="checkbox"].story-checkbox:checked');

        checkedStoryCheckboxes.forEach(storyCb => {
            const storyInfo = {
                oid: storyCb.dataset.storyOid,
                numericId: storyCb.dataset.numericId
            };

            const selectedTaskIds = [];
            const allTaskCheckboxesForStory = storiesListDiv.querySelectorAll(`.task-checkbox[data-story-oid="${storyInfo.oid}"]`);

            allTaskCheckboxesForStory.forEach((taskCb, index) => {
                const taskId = taskCb.dataset.taskId;
                const isChecked = taskCb.checked;

                if (isChecked) {
                    if (taskId) {
                        selectedTaskIds.push(taskId);
                    } else {
                        console.warn(`Story ${storyInfo.oid}: Found checked task checkbox without a dataset.taskId.`);
                    }
                }
            });

            selectedItems.push({
                storyInfo: storyInfo,
                selectedTaskIds: selectedTaskIds
            });
        });

        return selectedItems;
    }

    async function fetchStoriesAndTasks(timeboxId) {
        if (!timeboxId) {
            storiesListDiv.innerHTML = '<p>Please select a source timebox first.</p>';
            copyButton.disabled = true;
            currentStories = []; // Clear stored stories
            populateStoryOwnerFilter(currentStories); // Clear owner filter
            selectAllCheckbox.checked = false; // Reset Select All
            selectAllCheckbox.indeterminate = false;
            selectAllCheckbox.disabled = true;
            return;
        }
        showStatus(`Fetching stories...`);
        storiesListDiv.innerHTML = ''; // Clear previous list
        selectAllCheckbox.checked = false; // Reset Select All
        selectAllCheckbox.indeterminate = false;
        selectAllCheckbox.disabled = true;
        copyButton.disabled = true;
        currentStories = []; // Clear stored stories before fetch
        populateStoryOwnerFilter(currentStories); // Clear owner filter

        // Update the query to explicitly include parallel task attributes
        const storyQuery = `rest-1.v1/Data/Story?sel=Name,Number,Description,Parent.ID,Children:Task,Task.Name,Task.Number,Task.ToDo,Task.Description,Owners.Name&where=Timebox.ID='${timeboxId}'`;
        const storyResponse = await v1ApiCall(storyQuery);

        if (!storyResponse || !storyResponse.Assets) {
            showStatus('No stories found or error fetching stories.', true);
            showLoading(false);
            return;
        }

        // Attach full task details (No longer needed with parallel arrays)
        currentStories = storyResponse.Assets;

        populateStoryOwnerFilter(currentStories);
        displayStories(currentStories); // Pass stories with parallel arrays
        // Ensure the Select All checkbox is always enabled when stories are present
        if (currentStories.length > 0) {
            selectAllCheckbox.disabled = false;
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
        // Only need selected stories and target timebox. Task selection refines the copy, doesn't prevent it.
        const selectedStories = storiesListDiv.querySelectorAll('input[type="checkbox"].story-checkbox:checked');
        const targetTimeboxSelected = targetTimeboxChoices.getValue()?.value !== '';
        copyButton.disabled = !(selectedStories.length > 0 && targetTimeboxSelected);
    }

    async function copySelectedItems() {
        const storiesToCopy = getSelectedItemsForCopy();
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
            const itemToCopy = storiesToCopy[i]; // Renamed for clarity
            const storyInfo = itemToCopy.storyInfo;
            const selectedTaskIds = itemToCopy.selectedTaskIds;
            
            const storyOid = storyInfo.oid;
            const storyNumericId = storyInfo.numericId;
            let originalStory = null; 
            let sourceAttributes = null;
            let originalTasks = []; // Store fetched tasks here
            let newStoryId = null; // Store the ID of the newly created story
            let copySuccessful = false; // Flag to track success for closing
            const originalStoryNumberForLog = storyOid;
            
            try {
                showStatus(`Processing story ${i+1} of ${storiesToCopy.length}...`);

                // --- STEP 1: Fetch Original Story Details ---
                const baseSel = 'Name,Number,Description,Scope,Priority,Team,Owners,Estimate,Order,Super,AffectedByDefects,AssetState,TaggedWith';
                const optionalField = 'Custom_AcceptanceCriteria';
                const fullSel = `${baseSel},${optionalField}`; 
                let fetchErrorOccurred = false;
                let storyResponse = null; 

                console.log(`Attempting to fetch story ${storyNumericId} with sel: ${fullSel}`);
                storyResponse = await v1ApiCall(`rest-1.v1/Data/Story/${storyNumericId}?sel=${fullSel}`);
                
                if (storyResponse?.error) { 
                    console.warn(`Fetching story ${storyNumericId} with full selection failed (Error: ${storyResponse.message || 'Unknown'}). Retrying without optional field '${optionalField}'.`);
                    showStatus(`Retrying fetch for story ${storyOid} without optional field...`);
                    storyResponse = await v1ApiCall(`rest-1.v1/Data/Story/${storyNumericId}?sel=${baseSel}`);
                }
                
                if (!storyResponse || storyResponse.error) {
                    fetchErrorOccurred = true;
                    const errorDetail = storyResponse?.message || 'Unknown fetch error';
                    console.error(`Failed to fetch details for story ${storyOid}. Error: ${errorDetail}`);
                    showStatus(`Error fetching details for story ${storyOid}: ${errorDetail}. Skipping copy.`, true);
                    errorCount++;
                    continue; // Skip to the next story if fetch fails
                } else {
                    originalStory = storyResponse; 
                    sourceAttributes = originalStory.Attributes;
                    console.log(`Successfully fetched details for story ${storyOid}`);
                }
                // Use fetched Number for subsequent logs if available
                const currentStoryNumberLog = sourceAttributes?.Number?.value || originalStoryNumberForLog;
                // --- End Fetch Original Story ---

                // --- STEP 2: Fetch Original Tasks --- 
                const taskSel = 'Name,Description,Category,Owners,ToDo,Status.ID,TaggedWith';
                try {
                    showStatus(`Fetching tasks for original story ${currentStoryNumberLog}...`);
                    const tasksResponse = await v1ApiCall(`rest-1.v1/Data/Task?sel=${taskSel}&where=Parent='${storyOid}'`);
                    
                    if (tasksResponse && !tasksResponse.error && tasksResponse.Assets) {
                        originalTasks = tasksResponse.Assets;
                        showStatus(`Found ${originalTasks.length} tasks for ${currentStoryNumberLog}. Proceeding with copy...`);
                    } else if (tasksResponse?.error) {
                        showStatus(`Warning: Could not fetch tasks for story ${currentStoryNumberLog} due to error: ${tasksResponse.message}. Story will be copied without tasks.`, true);
                    } else {
                        showStatus(`No tasks found for ${currentStoryNumberLog}. Continuing...`);
                    }
                } catch (error) {
                    console.error(`Unexpected error fetching tasks for story ${currentStoryNumberLog}:`, error);
                    showStatus(`Warning: Could not fetch tasks for story ${currentStoryNumberLog}. Story will be copied without tasks.`, true);
                }
                // --- End Fetch Original Tasks ---
                
                // --- STEP 3: Create New Story Copy --- 
                // --- Determine Super ID to use --- 
                let superIdToUse = null;
                let skipSuperAttribute = false;
                
                if (targetParentId) {
                    superIdToUse = targetParentId;
                } else {
                    if (sourceAttributes.Super && sourceAttributes.Super.value && sourceAttributes.Super.value.idref) {
                        superIdToUse = sourceAttributes.Super.value.idref;
                    } else {
                        skipSuperAttribute = true;
                    }
                }
                // --- End Determine Super ID ---

                const newStoryPayload = { /* ... (payload building logic remains the same) ... */ };
                 // Payload building logic - Copied from previous state for completeness
                 newStoryPayload.Attributes = {
                     Name: { value: sourceAttributes.Name?.value || 'Unnamed Story', act: 'set' },
                     Timebox: { value: targetTimeboxId, act: 'set' },
                     ...(!skipSuperAttribute && { Super: { value: superIdToUse, act: 'set' } }),
                     ...(targetTimeboxScope ? 
                         { Scope: { value: targetTimeboxScope, act: 'set' } } : 
                         (sourceAttributes.Scope && sourceAttributes.Scope.value && 
                          { Scope: { value: sourceAttributes.Scope.value.idref, act: 'set' } })
                     ),
                     ...(sourceAttributes[optionalField] && sourceAttributes[optionalField].value !== null && { 
                         [optionalField]: { value: sourceAttributes[optionalField].value, act: 'set' } 
                     }),
                     ...(sourceAttributes.Description && { Description: { value: sourceAttributes.Description.value, act: 'set' } }),
                     ...(sourceAttributes.Priority && sourceAttributes.Priority.value && { Priority: { value: sourceAttributes.Priority.value.idref, act: 'set' } }),
                     ...(sourceAttributes.Team && sourceAttributes.Team.value && { Team: { value: sourceAttributes.Team.value.idref, act: 'set' } }),
                     ...(sourceAttributes.Estimate && sourceAttributes.Estimate.value !== null && { Estimate: { value: sourceAttributes.Estimate.value, act: 'set' } }),
                     ...(sourceAttributes.TaggedWith && sourceAttributes.TaggedWith.value && sourceAttributes.TaggedWith.value.length > 0 && { TaggedWith: { value: sourceAttributes.TaggedWith.value, act: 'set' } }),
                     ...(sourceAttributes.AffectedByDefects && sourceAttributes.AffectedByDefects.value && Array.isArray(sourceAttributes.AffectedByDefects.value) && sourceAttributes.AffectedByDefects.value.length > 0 && {
                         AffectedByDefects: { value: sourceAttributes.AffectedByDefects.value.map(o => ({ idref: o.idref, act: 'add' })), act: 'set' }
                     }),
                     ...(sourceAttributes.Owners && sourceAttributes.Owners.value && Array.isArray(sourceAttributes.Owners.value) && sourceAttributes.Owners.value.length > 0 && (() => {
                         const validOwnerIdRefs = sourceAttributes.Owners.value
                             .filter(o => o && o.idref) 
                             .map(o => o.idref);
                         if (validOwnerIdRefs.length > 0) {
                             return { Owners: { act: 'add', value: validOwnerIdRefs.length === 1 ? validOwnerIdRefs[0] : validOwnerIdRefs } };
                         } else {
                             return {};
                         }
                     })()),
                 };
                if (skipSuperAttribute) {
                    delete newStoryPayload.Attributes.Super;
                }

                showStatus(`Creating copy for story ${currentStoryNumberLog}...`);
                const createStoryResponse = await v1ApiCall('rest-1.v1/Data/Story', 'POST', newStoryPayload);
                
                if (!createStoryResponse || createStoryResponse.error) {
                    const errorDetail = createStoryResponse?.message || 'Unknown create error';
                    console.error(`Failed to create copy for story ${currentStoryNumberLog}. Error: ${errorDetail}`);
                    showStatus(`Error creating copy for ${currentStoryNumberLog}: ${errorDetail}. Skipping associated tasks and closure.`, true);
                    errorCount++;
                    continue; // Skip to next story if copy fails
                }
                newStoryId = createStoryResponse.id;
                showStatus(`Created new story ${newStoryId}. Copying tasks...`);
                // --- End Create New Story Copy ---

                // --- STEP 4: Copy Tasks (Only Selected Ones) --- 
                let taskSuccessCount = 0;
                let taskErrorCount = 0;
                let attemptedTaskCount = 0; // Track tasks we try to copy
                
                for (const sourceTask of originalTasks) {
                    const sourceTaskId = sourceTask.id; // e.g., Task:12345

                    const isSelected = selectedTaskIds.includes(sourceTaskId);

                    if (isSelected) {
                        attemptedTaskCount++;
                        try {
                             // Task payload building and API call logic remains the same
                             const taskAttributes = sourceTask.Attributes;
                             const newTaskPayload = {
                                 Attributes: {
                                     Name: { value: taskAttributes.Name?.value || 'Unnamed Task', act: 'set' },
                                     Parent: { value: newStoryId, act: 'set' },
                                     ...(taskAttributes.Description?.value && { 
                                         Description: { value: taskAttributes.Description.value, act: 'set' } 
                                     }),
                                     ...(taskAttributes.Category?.value?.idref && { 
                                         Category: { value: taskAttributes.Category.value.idref, act: 'set' } 
                                     }),
                                     ...(taskAttributes.ToDo?.value !== undefined && taskAttributes.ToDo?.value !== null && { // Allow 0 ToDo
                                        ToDo: { 
                                            value: typeof taskAttributes.ToDo.value === 'number' ? taskAttributes.ToDo.value : (parseFloat(taskAttributes.ToDo.value) || 0), // Default to 0 if parsing fails
                                            act: 'set' 
                                        }
                                    }),
                                     ...(taskAttributes.TaggedWith?.value && taskAttributes.TaggedWith.value.length > 0 && {
                                         TaggedWith: {
                                             act: "set", 
                                             value: taskAttributes.TaggedWith.value 
                                         }
                                     })
                                 }
                             };
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
                             
                            const createTaskResponse = await v1ApiCall('rest-1.v1/Data/Task', 'POST', newTaskPayload);
                            if (createTaskResponse && createTaskResponse.id) {
                                taskSuccessCount++;
                            } else {
                                const taskErrorDetail = createTaskResponse?.message || 'Unknown task create error';
                                console.error(`Failed to create task copy for new story ${newStoryId}. Original task ID: ${sourceTask.id}. Error: ${taskErrorDetail}`);
                                taskErrorCount++;
                            }
                        } catch (error) {
                            console.error(`Error creating task copy for new story ${newStoryId}:`, error);
                            taskErrorCount++;
                        }
                    }
                }
                // --- End Copy Tasks ---

                // --- Mark overall copy success --- 
                if (taskErrorCount > 0) {
                    showStatus(`Copied story ${currentStoryNumberLog} with ${taskSuccessCount}/${attemptedTaskCount} selected tasks (${taskErrorCount} tasks failed).`, true);
                } else if (attemptedTaskCount > 0) {
                    showStatus(`Successfully copied story ${currentStoryNumberLog} with all ${taskSuccessCount} selected tasks.`);
                    copySuccessful = true; // Mark as fully successful only if all *attempted* tasks copied
                } else { // No tasks were selected to be copied
                    showStatus(`Successfully copied story ${currentStoryNumberLog} (no tasks selected for copy).`);
                     copySuccessful = true; // Still consider story copy successful
                }

            } catch (error) {
                // Catch any truly unexpected errors within the main loop for this story
                console.error(`Unexpected error processing story ${storyOid}:`, error);
                showStatus(`Unexpected error copying story ${storyOid}: ${error.message}`, true);
                errorCount++;
                copySuccessful = false; // Ensure close doesn't run on unexpected error
            } 

            // --- STEP 5: Close Original Story (Only if copy was successful) --- 
            if (copySuccessful) {
                const closedStateId = 128; 
                const closeOperationName = 'QuickClose';
                const originalAssetState = sourceAttributes?.AssetState?.value;
                const currentStoryNumberLog = sourceAttributes?.Number?.value || originalStoryNumberForLog;

                if (originalAssetState !== closedStateId) {
                    showStatus(`Attempting to close original story ${currentStoryNumberLog} (post-copy)...`);
                    try {
                        const closeResponse = await v1ApiCall(`rest-1.v1/Data/Story/${storyNumericId}?op=${closeOperationName}`, 'POST', null); 
                        
                        if (closeResponse?.error) {
                             console.error(`Operation '${closeOperationName}' failed for original story ${currentStoryNumberLog}. Error: ${closeResponse.message}`);
                             showStatus(`Warning: Failed to close original story ${currentStoryNumberLog} after successful copy.`, true);
                        } else {
                            showStatus(`Original story ${currentStoryNumberLog} closed successfully after copy.`);
                        }
                    } catch (closeError) {
                        console.error(`Unexpected error executing operation '${closeOperationName}' on original story ${currentStoryNumberLog}:`, closeError);
                        showStatus(`Warning: Error closing original story ${currentStoryNumberLog} after successful copy.`, true);
                    }
                } else {
                     showStatus(`Original story ${currentStoryNumberLog} was already closed. No action needed.`);
                }
            } else {
                 console.log(`Skipping closure of original story ${storyOid} because copy was not fully successful.`);
                 showStatus(`Skipping closure for original story ${sourceAttributes?.Number?.value || storyOid} due to copy issues.`);
            }
             // --- End Close Original Story --- 
        }
        // --- Final status update (remains the same) --- 
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

    // --- New Function: Update Task Checkboxes for a Given Story ---
    function updateTaskStatesForStory(storyOid, isChecked) {
        console.log(`[updateTaskStatesForStory] Called for ${storyOid}. Setting tasks to: ${isChecked}`);
        const taskCheckboxes = storiesListDiv.querySelectorAll(`.task-checkbox[data-story-oid="${storyOid}"]`);
        console.log(`[updateTaskStatesForStory] Found ${taskCheckboxes.length} tasks.`);
        
        taskCheckboxes.forEach((taskCb, index) => {
            console.log(`[updateTaskStatesForStory] Task ${index + 1} (${taskCb.id}): Setting checked to ${isChecked}`);
            taskCb.checked = isChecked;
        });

        // Update UI states after task states are set
        console.log(`[updateTaskStatesForStory] Updating related UI states.`);
        updateSelectAllCheckboxState();
        checkCopyButtonState();
        updateSelectedCount();
    }

    // --- Start Event Listener Setup ---
    function setupEventListeners() {
        // Settings
        saveSettingsButton.addEventListener('click', saveSettings);
        authTokenRadio.addEventListener('change', toggleAuthInputs);
        authBasicRadio.addEventListener('change', toggleAuthInputs);
        authNtlmRadio.addEventListener('change', toggleAuthInputs);
        setupPasswordToggles(); // This function already adds its own listeners
        
        // Main Actions
        loadStoriesButton.addEventListener('click', () => {
            const timeboxId = sourceTimeboxChoices.getValue()?.value;
            fetchStoriesAndTasks(timeboxId);
        });
        copyButton.addEventListener('click', copySelectedItems);

        // Filters & Dropdowns
        sourceOwnerFilterSelect.addEventListener('change', () => {
            populateTimeboxSelect(sourceTimeboxChoices, allTimeboxes);
            storiesListDiv.innerHTML = '<div class="alert alert-info"><i class="bi bi-info-circle me-2"></i>Select a timebox and click "Load Stories".</div>';
            copyButton.disabled = true;
            updateSelectedCount();
            updateSelectAllCheckboxState();
        });
        targetOwnerFilterSelect.addEventListener('change', () => {
            populateTimeboxSelect(targetTimeboxChoices, allTimeboxes);
            checkCopyButtonState();
        });
        sourceTimeboxSelect.addEventListener('change', () => {
            storiesListDiv.innerHTML = '<p>Click "Load Stories" to fetch items for the selected timebox.</p>'; 
            copyButton.disabled = true; 
            currentStories = []; 
            populateStoryOwnerFilter(currentStories); 
            updateSelectedCount();
            updateSelectAllCheckboxState();
        });
        targetTimeboxSelect.addEventListener('change', checkCopyButtonState);
        targetParentSelect.addEventListener('change', checkCopyButtonState);
        
        // Story owner filter
        storyOwnerFilterSelect.addEventListener('change', (event) => {
            event.stopPropagation(); 
            if (!storyOwnerChoices) {
                return;
            }
            displayStories(currentStories);
            updateSelectedCount(); 
            updateSelectAllCheckboxState(); 
        });

        // Story/Task List Interactions
        selectAllCheckbox.addEventListener('change', () => {
            const isChecked = selectAllCheckbox.checked;

            const allStoryCheckboxes = storiesListDiv.querySelectorAll('input[type="checkbox"].story-checkbox');
            const allTaskCheckboxes = storiesListDiv.querySelectorAll('input[type="checkbox"].task-checkbox');
            
            allStoryCheckboxes.forEach(checkbox => { checkbox.checked = isChecked; });
            allTaskCheckboxes.forEach(checkbox => { checkbox.checked = isChecked; });
            
            updateSelectedCount();
            checkCopyButtonState();
        });

        // Listener for changes within the stories list (delegated)
        storiesListDiv.addEventListener('change', (event) => {
            const target = event.target;
            let stateNeedsUpdate = false;

            if (target.matches('.story-checkbox')) {
                const storyCheckbox = target;
                const currentStoryCheckedState = storyCheckbox.checked;
                const storyOid = storyCheckbox.dataset.storyOid;

                const taskCheckboxes = storiesListDiv.querySelectorAll(`.task-checkbox[data-story-oid="${storyOid}"]`);
                taskCheckboxes.forEach((taskCb, index) => {
                    taskCb.checked = currentStoryCheckedState;
                });
                stateNeedsUpdate = true;
            }

            if (target.matches('.task-checkbox')) {
                const taskCheckbox = target;
                const currentTaskCheckedState = taskCheckbox.checked;
                const storyOid = taskCheckbox.dataset.storyOid;
                
                let parentStateChanged = false;

                if (storyOid) {
                    const parentStoryCheckbox = document.getElementById(`story-${storyOid}`);
                    if (parentStoryCheckbox) {
                        if (currentTaskCheckedState && !parentStoryCheckbox.checked) {
                            parentStoryCheckbox.checked = true;
                            parentStateChanged = true; 
                        }
                        else if (!currentTaskCheckedState) {
                            const siblingTaskCheckboxes = storiesListDiv.querySelectorAll(`.task-checkbox[data-story-oid="${storyOid}"]`);
                            let anyOtherTaskChecked = false;
                            siblingTaskCheckboxes.forEach(siblingCb => {
                                if (siblingCb !== taskCheckbox && siblingCb.checked) {
                                    anyOtherTaskChecked = true;
                                }
                            });

                            if (!anyOtherTaskChecked && parentStoryCheckbox.checked) {
                                parentStoryCheckbox.checked = false;
                                parentStateChanged = true; 
                            }
                        }
                    }
                }
                stateNeedsUpdate = true; 
            }

            if (stateNeedsUpdate) {
                const calculatedState = calculateSelectAllState();
                setTimeout(() => {
                    applySelectAllState(calculatedState);
                    checkCopyButtonState();
                    updateSelectedCount();
                }, 0);
            }
        });
    }
    // --- End Event Listener Setup ---

    // --- Initial Load and Setup ---
    function initializeApp() {
        // Initialize UI components
        initChoices(); 
        setupEventListeners(); // Centralized listener setup
        loadSettings(); 
        updateSelectedCount(); // Initialize count
    }

    // Start the app
    initializeApp();

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
        const selectedCount = storiesListDiv.querySelectorAll('input[type="checkbox"].story-checkbox:checked').length;
        selectedCountBadge.textContent = selectedCount.toString();
    }
});
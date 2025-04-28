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
    // New elements for auth method selection
    const authTokenRadio = document.getElementById('auth-token');
    const authBasicRadio = document.getElementById('auth-basic');
    const tokenInputSection = document.getElementById('token-input-section');
    const basicAuthInputSection = document.getElementById('basic-auth-input-section');
    const v1UsernameInput = document.getElementById('v1-username');
    const v1PasswordInput = document.getElementById('v1-password');

    let settings = {
        baseUrl: '',
        authMethod: 'token', // Default to token
        accessToken: '',
        username: '',
        password: '',
        targetParentAssetType: 'Epic' // <<< --- IMPORTANT: Change 'Epic' if your Super relates to a different asset type (e.g., 'Theme')
    };

    // --- Settings Handling ---
    function toggleAuthInputs() {
        if (authTokenRadio.checked) {
            tokenInputSection.style.display = 'block';
            basicAuthInputSection.style.display = 'none';
        } else {
            console.log('Switching to Basic Auth view');
            tokenInputSection.style.display = 'none';
            basicAuthInputSection.style.display = 'block';
        }
    }

    function loadSettings() {
        const savedSettings = localStorage.getItem('v1CopierSettings');
        if (savedSettings) {
            settings = JSON.parse(savedSettings);
            v1UrlInput.value = settings.baseUrl || '';
            v1TokenInput.value = settings.accessToken || '';
            v1UsernameInput.value = settings.username || '';
            v1PasswordInput.value = settings.password || ''; // Note: Storing password in localStorage is insecure

            // Set the correct radio button
            if (settings.authMethod === 'basic') {
                authBasicRadio.checked = true;
            } else {
                authTokenRadio.checked = true; // Default to token if unset or invalid
                settings.authMethod = 'token'; // Ensure setting is consistent
            }
            toggleAuthInputs(); // Show/hide correct fields

            settingsStatus.textContent = 'Settings loaded.';
            settingsStatus.className = 'success';
            if (settings.baseUrl && settings.accessToken) {
                fetchTimeboxes(); // Attempt to fetch timeboxes if settings are present
            }
        } else {
            settingsStatus.textContent = 'No settings found. Please configure.';
            settingsStatus.className = 'error';
            toggleAuthInputs(); // Ensure correct fields are shown initially
        }
    }

    async function saveSettings() {
        const newBaseUrl = v1UrlInput.value.trim();
        const selectedAuthMethod = authBasicRadio.checked ? 'basic' : 'token';
        const newAccessToken = v1TokenInput.value.trim();
        const newUsername = v1UsernameInput.value.trim();
        const newPassword = v1PasswordInput.value.trim(); // Avoid trimming passwords

        let isValid = true;
        let errorMsg = '';

        if (!newBaseUrl) {
            isValid = false;
            errorMsg = 'Base URL cannot be empty. ';
        }

        if (selectedAuthMethod === 'token' && !newAccessToken) {
            isValid = false;
            errorMsg += 'Access Token cannot be empty. ';
        }

        if (selectedAuthMethod === 'basic' && (!newUsername || !newPassword)) {
            isValid = false;
            errorMsg += 'Username and Password cannot be empty for Basic Auth. ';
        }

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
        // fetchTimeboxes(); // We can let testConnection call fetchTimeboxes on success
    }

    saveSettingsButton.addEventListener('click', saveSettings);
    // Add event listeners for radio buttons
    authTokenRadio.addEventListener('change', toggleAuthInputs);
    authBasicRadio.addEventListener('change', toggleAuthInputs);

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
                console.error("Error base64 encoding credentials:", e);
                if (!suppressStatusUpdate) showStatus('Error encoding credentials for Basic Auth.', true);
                return null;
            }
        } else {
            if (!suppressStatusUpdate) showStatus('Error: Invalid authentication method selected.', true);
            return null;
        }

        const proxyUrl = `/api/v1/${endpoint.replace(/^\//, '')}`;
        const headers = {
            'Authorization': authHeaderValue,
            'X-V1-Base-URL': settings.baseUrl,
            'Accept': 'application/json'
        };

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
                let errorMsg = `API Error (via proxy): ${response.status} ${response.statusText}`;
                try {
                    const errorData = await response.json();
                    console.error('API Error Response (via proxy):', errorData);
                    if (errorData.message) {
                        detailedError = errorData.message;
                        errorMsg += ` - ${detailedError}`;
                    } else if (errorData.Exception) {
                        detailedError = errorData.Exception.Message || 'Unknown server exception';
                        errorMsg += ` - ${detailedError}`;
                    } else if (errorData.error) {
                        detailedError = errorData.error + (errorData.details ? ` (${errorData.details})` : '');
                        errorMsg = detailedError;
                    }
                } catch (e) {
                    const textError = await response.text();
                    if (textError) {
                        detailedError = textError;
                        errorMsg += ` - ${detailedError}`;
                    }
                    console.error('Non-JSON API Error Response (via proxy):', textError);
                }
                throw new Error(errorMsg);
            }

            if (response.status === 204) { // Handle No Content responses
                return null;
            }

            return await response.json();
        } catch (error) {
            console.error('API Call Failed:', error);
            // Use settingsStatus for connection test errors, statusMessage otherwise
            const targetStatusElement = suppressStatusUpdate ? settingsStatus : statusMessage;
            const displayMessage = detailedError ? `Connection failed: ${detailedError} (${error.message.split(' - ')[0]})` : `Error: ${error.message}`;

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

    function populateTimeboxSelect(selectElement, timeboxes) {
        selectElement.innerHTML = '<option value="">-- Select Timebox --</option>'; // Clear existing options
        if (timeboxes && timeboxes.Assets) {
            timeboxes.Assets.sort((a, b) => {
                // Attempt to sort by Name, handle potential missing attributes gracefully
                const nameA = a.Attributes?.Name?.value || '';
                const nameB = b.Attributes?.Name?.value || '';
                return nameA.localeCompare(nameB);
            }).forEach(tb => {
                const name = tb.Attributes?.Name?.value || 'Unnamed Timebox';
                const id = tb.id;
                const option = document.createElement('option');
                option.value = id;
                option.textContent = name;
                selectElement.appendChild(option);
            });
        } else {
             console.warn("No timeboxes found or invalid format:", timeboxes);
        }
    }

    // --- Core Logic Functions (Placeholders) ---

    async function fetchTimeboxes() {
        showStatus('Fetching timeboxes...');
        // Fetch only active timeboxes
        const timeboxes = await v1ApiCall('rest-1.v1/Data/Timebox?sel=Name&where=AssetState=\'64\'');
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

    async function fetchStoriesAndTasks(timeboxId) {
        if (!timeboxId) {
            storiesListDiv.innerHTML = '<p>Please select a source timebox first.</p>';
            copyButton.disabled = true;
            return;
        }
        showStatus(`Fetching stories for ${timeboxId}...`);
        storiesListDiv.innerHTML = ''; // Clear previous list
        copyButton.disabled = true;

        // Fetch stories in the selected timebox
        const stories = await v1ApiCall(`rest-1.v1/Data/Story?sel=Name,Number,Children:Task[AssetState!='128'].Name&where=Timebox='${timeboxId}';AssetState='64'`);

        if (stories && stories.Assets && stories.Assets.length > 0) {
            const ul = document.createElement('ul');
            stories.Assets.forEach(story => {
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
                    // Optionally disable checkbox or handle error
                }
                checkbox.addEventListener('change', checkCopyButtonState);

                const label = document.createElement('label');
                const storyName = story.Attributes?.Name?.value || 'Unnamed Story';
                const storyNumber = story.Attributes?.Number?.value || '';
                label.htmlFor = checkbox.id;
                label.textContent = `${storyNumber} - ${storyName}`;

                li.appendChild(checkbox);
                li.appendChild(label);

                // Display tasks (if any)
                const tasks = story.Attributes['Children:Task[AssetState!=\'128\']']?.value;
                if (tasks && tasks.length > 0) {
                    const taskUl = document.createElement('ul');
                    tasks.forEach(task => {
                        const taskLi = document.createElement('li');
                        const taskName = task.Attributes?.Name?.value || 'Unnamed Task';
                        // Store task ID and necessary info for copying if needed later
                        taskLi.textContent = `Task: ${taskName}`;
                        taskLi.dataset.taskId = task.id;
                        taskUl.appendChild(taskLi);
                    });
                    li.appendChild(taskUl);
                }

                ul.appendChild(li);
            });
            storiesListDiv.appendChild(ul);
            showStatus('Stories loaded. Select stories to copy.');
        } else if (stories) { // Request succeeded but no stories found
            storiesListDiv.innerHTML = '<p>No active stories found in the selected timebox.</p>';
            showStatus('No active stories found.');
        } else { // API call failed
            storiesListDiv.innerHTML = '<p>Failed to load stories. Check console.</p>';
            // Status already set by v1ApiCall failure
        }
        checkCopyButtonState(); // Update button state initially
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

        let successCount = 0;
        let errorCount = 0;
        let skippedCount = 0;

        for (let i = 0; i < storiesToCopy.length; i++) {
            const storyInfo = storiesToCopy[i];
            const storyOid = storyInfo.oid;
            const storyNumericId = storyInfo.numericId;
            try {
                showStatus(`Processing story ${storyOid} (ID: ${storyNumericId})...`);
                // 1. Fetch details using the NUMERIC ID and a comprehensive sel parameter
                const storySel = 'Name,Description,Scope,Priority,Team,Owners,Estimate,Order,Super,AffectedByDefects,Number';
                const originalStory = await v1ApiCall(`rest-1.v1/Data/Story/${storyNumericId}?sel=${storySel}`);

                // Log immediately after await
                console.log('IMMEDIATE originalStory:', JSON.stringify(originalStory));
                console.log('IMMEDIATE !originalStory.Attributes evaluation:', !originalStory?.Attributes);

                // Adjust check for single Asset response structure
                if (!originalStory || !originalStory.Attributes) {
                     console.error(`Failed to fetch details or received invalid data for story ${storyOid}`);
                     if (originalStory) {
                        console.error("Received data:", JSON.stringify(originalStory));
                     }
                     errorCount++;
                     continue; // Skip to next story
                }

                const sourceAttributes = originalStory.Attributes;
                console.log('Source Attributes for Story:', JSON.stringify(sourceAttributes, null, 2));

                // --- Determine Super ID to use ---
                let superIdToUse = null;
                if (targetParentId) {
                    // User selected a target parent
                    superIdToUse = targetParentId;
                    console.log(`Using selected Target Parent: ${superIdToUse} for story ${storyOid}`);
                } else {
                    // No target parent selected, try using the source story's parent
                    if (sourceAttributes.Super && sourceAttributes.Super.value && sourceAttributes.Super.value.idref) {
                        superIdToUse = sourceAttributes.Super.value.idref;
                        console.log(`Using Source Parent: ${superIdToUse} for story ${storyOid}`);
                    } else {
                        // Source parent is null/missing, AND no target selected. Cannot copy.
                        console.warn(`Skipping story ${storyOid}: Target Parent not selected and original story has no Parent ('Super'). 'Super' is required.`);
                        showStatus(`Skipping story ${storyOid}: Missing required Parent.`, true); // Show status briefly
                        skippedCount++;
                        continue; // Skip to the next story
                    }
                }
                // --- End Determine Super ID ---


                // 2. Prepare data for the new story
                const newStoryPayload = {
                    Attributes: {
                        // Required fields
                        Name: { value: `Copy of ${sourceAttributes.Name?.value || 'Unnamed Story'}`, act: 'set' },
                        Timebox: { value: targetTimeboxId, act: 'set' },
                        Super: { value: superIdToUse, act: 'set' }, // Set Super based on logic above

                        // Add other attributes only if they exist in the source response
                        ...(sourceAttributes.Description && { Description: { value: sourceAttributes.Description.value, act: 'set' } }),
                        ...(sourceAttributes.Scope && sourceAttributes.Scope.value && { Scope: { value: sourceAttributes.Scope.value.idref, act: 'set' } }),
                        ...(sourceAttributes.Priority && sourceAttributes.Priority.value && { Priority: { value: sourceAttributes.Priority.value.idref, act: 'set' } }),
                        ...(sourceAttributes.Team && sourceAttributes.Team.value && { Team: { value: sourceAttributes.Team.value.idref, act: 'set' } }),
                        ...(sourceAttributes.Estimate && sourceAttributes.Estimate.value !== null && { Estimate: { value: sourceAttributes.Estimate.value, act: 'set' } }),
                        // Order removed previously

                        // Add back multi-value relations with strict checks
                        // Owners removed previously for debugging
                        ...(sourceAttributes.AffectedByDefects && sourceAttributes.AffectedByDefects.value && Array.isArray(sourceAttributes.AffectedByDefects.value) && sourceAttributes.AffectedByDefects.value.length > 0 && {
                            AffectedByDefects: { value: sourceAttributes.AffectedByDefects.value.map(o => ({ idref: o.idref, act: 'add' })), act: 'set' }
                        }),
                        ...(sourceAttributes.Super && sourceAttributes.Super.value && { Super: { value: sourceAttributes.Super.value.idref, act: 'set' } }),
                        // --- Add back multi-value relations with strict checks --- 
                        // --- Restore Owners --- 
                        ...(sourceAttributes.Owners && sourceAttributes.Owners.value && Array.isArray(sourceAttributes.Owners.value) && sourceAttributes.Owners.value.length > 0 && { 
                            Owners: { value: sourceAttributes.Owners.value.map(o => ({ idref: o.idref, act: 'add' })), act: 'set' } 
                        }),
                    }
                };

                // 3. Create the new story
                console.log('Payload for creating new Story:', JSON.stringify(newStoryPayload, null, 2));
                const createStoryResponse = await v1ApiCall('rest-1.v1/Data/Story', 'POST', newStoryPayload);
                if (!createStoryResponse || !createStoryResponse.id) {
                    console.error(`Failed to create copy for story ${storyOid}`);
                    errorCount++;
                    continue; // Skip to next story
                }
                const newStoryId = createStoryResponse.id;
                showStatus(`Created new story ${newStoryId}. Fetching original tasks...`);

                // 4. Fetch original tasks separately - ensure sel includes Owners
                let originalTasks = []; // Declare with let outside
                // Select desired task attributes
                const taskSel = 'Name,Description,Category,Owners,ToDo'; // Make sure Owners is here
                // ---- Simplify WHERE clause for debugging ----
                const tasksResponse = await v1ApiCall(`rest-1.v1/Data/Task?sel=${taskSel}&where=Parent='${storyOid}'`);
                // const tasksResponse = await v1ApiCall(`rest-1.v1/Data/Task?sel=${taskSel}&where=Parent='${storyOid}';AssetState!=128;AssetState!=208`);
                // ---- End Simplification ---- 
                if (tasksResponse && tasksResponse.Assets) {
                    originalTasks = tasksResponse.Assets; // Assign here
                    showStatus(`Found ${originalTasks.length} tasks for ${storyOid}. Copying...`);
                } else {
                    showStatus(`No active tasks found or failed to fetch tasks for ${storyOid}. Continuing...`);
                }

                // 5. Copy Tasks for the new story
                for (const sourceTask of originalTasks) {
                    const taskAttributes = sourceTask.Attributes;
                    console.log(`Processing Task ID: ${sourceTask.id}, Attributes:`, JSON.stringify(taskAttributes, null, 2));
                    const newTaskPayload = {
                        Attributes: {
                            Name: { value: taskAttributes.Name?.value || 'Unnamed Task', act: 'set' },
                            Parent: { value: newStoryId, act: 'set' }, // Link to NEW story
                            ...(taskAttributes.Description && { Description: { value: taskAttributes.Description.value, act: 'set' } }),
                            ...(taskAttributes.Category?.value?.idref && { Category: { value: taskAttributes.Category.value.idref, act: 'set' } }),
                            // --- Ensure Task Owners copy uses strict check (already done, verifying) ---
                            // --- Keep Owners commented out to avoid 500 error ---
                            // ...(taskAttributes.Owners && taskAttributes.Owners.value && Array.isArray(taskAttributes.Owners.value) && taskAttributes.Owners.value.length > 0 && { 
                            //     Owners: { value: taskAttributes.Owners.value.map(o => ({ idref: o.idref, act: 'add' })), act: 'set' } 
                            // }),
                        }
                    };
                    // ---- ADDED LOGGING for Task Payload ----
                    console.log('Payload for creating new Task:', JSON.stringify(newTaskPayload, null, 2));
                    // ---- END LOGGING ----
                    const createTaskResponse = await v1ApiCall('rest-1.v1/Data/Task', 'POST', newTaskPayload);
                    if (!createTaskResponse) {
                         console.warn(`Failed to copy task ${sourceTask.id} for new story ${newStoryId}`);
                         // Decide if this constitutes a full story copy failure or just a partial one
                    }
                }

                successCount++;
                // Use storyOid for user-facing messages
                showStatus(`Successfully copied story ${storyOid} and its tasks to ${newStoryId}.`);

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
            fetchTimeboxes(); // Fetch timeboxes now that connection is confirmed
            fetchTargetParents(); // Fetch target parents as well
        } else {
            // Error message handled by v1ApiCall
            // Clear dropdowns if connection fails
            populateTimeboxSelect(sourceTimeboxSelect, null);
            populateTimeboxSelect(targetTimeboxSelect, null);
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
        selectElement.innerHTML = '<option value="">-- Select Target Parent (Required) --</option>'; // Clear existing options
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
    });
    targetTimeboxSelect.addEventListener('change', checkCopyButtonState);
    targetParentSelect.addEventListener('change', checkCopyButtonState);


    // --- Initial Load ---
    loadSettings();
}); 
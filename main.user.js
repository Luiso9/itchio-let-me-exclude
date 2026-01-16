// ==UserScript==
// @name         OI LET ME EXCLUDE
// @namespace    http://tampermonkey.net/
// @version      3.5
// @description  let u exclude tag on itch.io without needing to manually edit URL params.
// @author       Luiso9
// @downloadURL  https://raw.githubusercontent.com/Luiso9/itchio-let-me-exclude/refs/heads/main/main.user.js
// @updateURL    https://raw.githubusercontent.com/Luiso9/itchio-let-me-exclude/refs/heads/main/main.user.js
// @homepageURL  https://github.com/Luiso9/itchio-let-me-exclude
// @match        https://itch.io/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    const CONFIG = {
        STORAGE_KEY: 'itchio_exclude_config',
        CACHE_KEY: 'itchio_tags_cache',
        CACHE_TIME: 'itchio_tags_timestamp',
        CACHE_DURATION: 604800000,
        TAG_SOURCE_URL: 'https://ai.driannsa.my.id/tags.json'
    };

    function normalizeTag(readableTag) {
        let clean = readableTag.toLowerCase()
            .replace(/\s+/g, '-')
            .replace(/[^a-z0-9\-]/g, '');
        return `tg.${clean}`;
    }

    function getExcludedTags() {
        const saved = localStorage.getItem(CONFIG.STORAGE_KEY);
        return saved ? JSON.parse(saved) : [];
    }

    function saveExcludedTag(readableTag) {
        const current = getExcludedTags();
        if (!current.includes(readableTag)) {
            current.push(readableTag);
            localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(current));
            updatePageUrl();
        }
    }

    function removeExcludedTag(readableTag) {
        const current = getExcludedTags();
        const filtered = current.filter(t => t !== readableTag);
        localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(filtered));
        updatePageUrl();
    }

    function updatePageUrl() {
        const desiredTags = getExcludedTags();
        const url = new URL(window.location.href);
        url.searchParams.delete('exclude');
        desiredTags.forEach(tag => {
            url.searchParams.append('exclude', normalizeTag(tag));
        });
        if (url.toString() !== window.location.href) {
            window.location.replace(url.toString());
        }
    }

    async function fetchTags() {
        const cached = localStorage.getItem(CONFIG.CACHE_KEY);
        const timestamp = localStorage.getItem(CONFIG.CACHE_TIME);
        const now = Date.now();

        if (cached && timestamp && (now - timestamp < CONFIG.CACHE_DURATION)) {
            return JSON.parse(cached);
        }

        try {
            const response = await fetch(CONFIG.TAG_SOURCE_URL);
            if (!response.ok) throw new Error('Network response was not ok');
            const data = await response.json();
            localStorage.setItem(CONFIG.CACHE_KEY, JSON.stringify(data));
            localStorage.setItem(CONFIG.CACHE_TIME, now);
            return data;
        } catch (error) {
            console.error(error);
            return cached ? JSON.parse(cached) : [];
        }
    }

    async function createNativeUI() {
        const tagsLabel = document.querySelector('.tags_label');
        if (!tagsLabel) return;
        
        const container = tagsLabel.parentElement;
        const availableTags = await fetchTags();

        const header = document.createElement('div');
        header.className = 'tags_label';
        header.style.marginTop = '15px';
        header.innerHTML = `
            <span title="Excluded tags" class="tags_label" style="color: #fa5c5c;">
                <svg role="img" viewBox="0 0 24 24" version="1.1" stroke-width="2" stroke-linecap="round" class="svgicon icon_tag" width="18" height="18" fill="none" stroke="currentColor" stroke-linejoin="round" style="margin-right:5px;"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>
                Exclude Tags
            </span>
        `;
        container.appendChild(header);

        const renderExcludedPills = () => {
            container.querySelectorAll('.custom-ban-pill').forEach(el => el.remove());
            
            const current = getExcludedTags();
            current.forEach(tag => {
                const pill = document.createElement('div');
                pill.className = 'tag_segmented_btn custom-ban-pill';
                pill.style.marginRight = '5px';
                
                const a = document.createElement('a');
                a.innerHTML = `${tag} <span style="opacity:0.6; margin-left:4px;">✕</span>`;
                a.style.cssText = `
                    border-color: #fa5c5c !important; 
                    color: #fa5c5c !important; 
                    cursor: pointer;
                    display: inline-block;
                    padding: 5px 10px;
                    border: 1px solid;
                    border-radius: 4px;
                    text-decoration: none;
                    font-size: 14px;
                    background: rgba(250, 92, 92, 0.1);
                `;
                
                a.onclick = (e) => {
                    e.preventDefault();
                    removeExcludedTag(tag);
                };

                pill.appendChild(a);
                container.insertBefore(pill, wrapper); 
            });
        };

        const wrapper = document.createElement('div');
        wrapper.className = 'selectize-control tag_selector single';
        wrapper.style.display = 'block';
        wrapper.style.marginTop = '5px';
        wrapper.style.width = '100%';

        const inputDiv = document.createElement('div');
        inputDiv.className = 'selectize-input items not-full has-options';
        inputDiv.style.display = 'flex';
        inputDiv.style.alignItems = 'center';
        
        const input = document.createElement('input');
        input.type = 'text';
        input.autocomplete = 'off';
        input.placeholder = 'Type to exclude...';
        input.style.width = '100%';
        input.style.border = 'none';
        input.style.outline = 'none';
        input.style.background = 'transparent';
        input.style.color = 'inherit';

        inputDiv.appendChild(input);
        wrapper.appendChild(inputDiv);

        const dropdown = document.createElement('div');
        dropdown.className = 'selectize-dropdown single tag_selector';
        dropdown.style.display = 'none';
        dropdown.style.width = '100%';
        dropdown.style.position = 'absolute';
        dropdown.style.zIndex = '999';
        
        const dropdownContent = document.createElement('div');
        dropdownContent.className = 'selectize-dropdown-content';
        dropdown.appendChild(dropdownContent);
        wrapper.appendChild(dropdown);

        container.appendChild(wrapper);

        input.addEventListener('input', () => {
            const val = input.value.trim().toLowerCase();
            dropdownContent.innerHTML = '';
            
            if (!val || !availableTags) {
                dropdown.style.display = 'none';
                return;
            }

            const matches = availableTags.filter(t => t.toLowerCase().includes(val)).slice(0, 8);
            
            if (matches.length > 0) {
                dropdown.style.display = 'block';
                matches.forEach(match => {
                    const option = document.createElement('div');
                    option.className = 'option';
                    option.innerText = match;
                    option.style.padding = '5px 10px';
                    option.style.cursor = 'pointer';
                    
                    option.onmouseover = () => {
                        option.style.backgroundColor = '#f5f5f5';
                        option.style.color = '#000';
                    };
                    option.onmouseout = () => {
                        option.style.backgroundColor = 'transparent';
                        option.style.color = 'inherit';
                    };
                    
                    option.onclick = () => {
                        saveExcludedTag(match);
                        input.value = '';
                        dropdown.style.display = 'none';
                    };
                    dropdownContent.appendChild(option);
                });
            } else {
                dropdown.style.display = 'none';
            }
        });

        document.addEventListener('click', (e) => {
            if (!wrapper.contains(e.target)) {
                dropdown.style.display = 'none';
            }
        });

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Tab' || e.key === 'Enter') {
                const visibleOption = dropdownContent.querySelector('.option');
                if (visibleOption && dropdown.style.display !== 'none') {
                    e.preventDefault();
                    visibleOption.click();
                }
            }
        });

        renderExcludedPills();
    }

    updatePageUrl();
    createNativeUI();

})();
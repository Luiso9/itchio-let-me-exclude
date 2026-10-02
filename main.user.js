// ==UserScript==
// @name         OI LET ME EXCLUDE
// @namespace    http://tampermonkey.net/
// @version      3.7
// @description  let u exclude tag on itch.io without needing to manually edit URL params.
// @author       Luiso9
// @downloadURL  https://github.com/Luiso9/itchio-let-me-exclude/raw/refs/heads/main/main.user.js
// @updateURL    https://github.com/Luiso9/itchio-let-me-exclude/raw/refs/heads/main/main.user.js
// @homepageURL  https://github.com/Luiso9/itchio-let-me-exclude
// @icon         https://r2.driannsa.app/f/assets/126867004_p0.jpg
// @match        https://itch.io/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    const CONFIG = {
        STORAGE_KEY: 'itchio_exclude_config',
        CACHE_KEY: 'itchio_tags_cache',
        CACHE_TIME: 'itchio_tags_timestamp',
        CACHE_DURATION: 604800000, // 7 days
        TAG_SOURCE_URL: 'https://raw.githubusercontent.com/Luiso9/itchio-let-me-exclude/refs/heads/main/tags.json',
        MAX_SUGGESTIONS: 8
    };

    // ---------- Helpers ----------

    function normalizeTag(readableTag) {
        const clean = readableTag.toLowerCase()
            .replace(/\s+/g, '-')
            .replace(/[^a-z0-9\-]/g, '')
            .replace(/-+/g, '-')       // "dungeons--dragons" -> "dungeons-dragons"
            .replace(/^-|-$/g, '');
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

    // ---------- Tag list ----------

    async function fetchTags() {
        const cached = localStorage.getItem(CONFIG.CACHE_KEY);
        const timestamp = Number(localStorage.getItem(CONFIG.CACHE_TIME));
        const now = Date.now();

        if (cached && timestamp && (now - timestamp < CONFIG.CACHE_DURATION)) {
            const parsed = JSON.parse(cached);
            if (Array.isArray(parsed)) return parsed;
        }

        try {
            const response = await fetch(CONFIG.TAG_SOURCE_URL);
            if (!response.ok) throw new Error('Network response was not ok');
            const data = await response.json();
            if (!Array.isArray(data)) throw new Error('Tag list is not an array');
            localStorage.setItem(CONFIG.CACHE_KEY, JSON.stringify(data));
            localStorage.setItem(CONFIG.CACHE_TIME, String(now));
            return data;
        } catch (error) {
            console.error(error);
            // fall back to old cache if we have one
            return cached ? JSON.parse(cached) : [];
        }
    }

    // Tags that START with the query come first, then tags that merely CONTAIN it.
    // Tags that are already excluded are skipped.
    function findMatches(query, allTags) {
        const q = query.toLowerCase();
        const excluded = getExcludedTags().map(t => t.toLowerCase());
        const startsWith = [];
        const contains = [];

        for (const tag of allTags) {
            const lower = tag.toLowerCase();
            if (excluded.includes(lower)) continue;

            if (lower.startsWith(q)) {
                startsWith.push(tag);
            } else if (lower.includes(q)) {
                contains.push(tag);
            }
        }

        return startsWith.concat(contains).slice(0, CONFIG.MAX_SUGGESTIONS);
    }

    // ---------- UI ----------

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

        // --- Input + dropdown ---
        const wrapper = document.createElement('div');
        wrapper.className = 'selectize-control tag_selector single';
        wrapper.style.display = 'block';
        wrapper.style.position = 'relative'; // so the dropdown sits under the input
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
        dropdown.style.top = '100%';
        dropdown.style.left = '0';
        dropdown.style.zIndex = '999';

        const dropdownContent = document.createElement('div');
        dropdownContent.className = 'selectize-dropdown-content';
        dropdown.appendChild(dropdownContent);
        wrapper.appendChild(dropdown);

        container.appendChild(wrapper);

        // --- Excluded tag pills ---
        const renderExcludedPills = () => {
            container.querySelectorAll('.custom-ban-pill').forEach(el => el.remove());

            getExcludedTags().forEach(tag => {
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

        // --- Autocomplete logic ---
        let currentMatches = [];
        let activeIndex = 0;

        const closeDropdown = () => {
            dropdown.style.display = 'none';
            currentMatches = [];
        };

        const pickTag = (tag) => {
            input.value = '';
            closeDropdown();
            saveExcludedTag(tag);
        };

        // Highlights the active option (the one Enter/Tab will pick)
        const highlightActive = () => {
            const options = dropdownContent.querySelectorAll('.option');
            options.forEach((option, i) => {
                const isActive = i === activeIndex;
                option.style.backgroundColor = isActive ? '#f5f5f5' : 'transparent';
                option.style.color = isActive ? '#000' : 'inherit';
            });
        };

        const renderDropdown = () => {
            dropdownContent.innerHTML = '';

            const query = input.value.trim();
            if (!query || !Array.isArray(availableTags)) {
                closeDropdown();
                return;
            }

            currentMatches = findMatches(query, availableTags);
            if (currentMatches.length === 0) {
                closeDropdown();
                return;
            }

            activeIndex = 0;
            dropdown.style.display = 'block';

            currentMatches.forEach((match, i) => {
                const option = document.createElement('div');
                option.className = 'option';
                option.innerText = match;
                option.style.padding = '5px 10px';
                option.style.cursor = 'pointer';

                option.onmouseover = () => {
                    activeIndex = i;
                    highlightActive();
                };

                // mousedown (not click) so the input doesn't lose focus first
                option.onmousedown = (e) => {
                    e.preventDefault();
                    pickTag(match);
                };

                dropdownContent.appendChild(option);
            });

            highlightActive();
        };

        input.addEventListener('input', renderDropdown);
        input.addEventListener('focus', renderDropdown);

        input.addEventListener('keydown', (e) => {
            if (dropdown.style.display === 'none') return;

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                activeIndex = (activeIndex + 1) % currentMatches.length;
                highlightActive();
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                activeIndex = (activeIndex - 1 + currentMatches.length) % currentMatches.length;
                highlightActive();
            } else if (e.key === 'Enter' || e.key === 'Tab') {
                e.preventDefault();
                pickTag(currentMatches[activeIndex]);
            } else if (e.key === 'Escape') {
                closeDropdown();
            }
        });

        document.addEventListener('click', (e) => {
            if (!wrapper.contains(e.target)) {
                closeDropdown();
            }
        });

        renderExcludedPills();
    }

    updatePageUrl();
    createNativeUI();

})();

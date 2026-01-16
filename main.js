// ==UserScript==
// @name         Itch.io Smart Excluder (UX Enhanced)
// @namespace    http://tampermonkey.net/
// @version      3.0
// @description  Fetches tags, enforces strict selection, auto-reloads on delete, and supports Tab-complete.
// @author       Gemini & User
// @match        https://itch.io/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    const CONFIG = {
        STORAGE_KEY: 'itchio_exclude_config',
        CACHE_KEY: 'itchio_tags_cache',
        CACHE_TIME: 'itchio_tags_timestamp',
        CACHE_DURATION: 604800000, // 7 Days
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
            console.error("Itch Excluder: Failed to fetch tags.", error);
            return cached ? JSON.parse(cached) : [];
        }
    }

    async function createUI() {
        const availableTags = await fetchTags();

        const div = document.createElement('div');
        div.style.cssText = `
            position: fixed; bottom: 20px; right: 20px;
            background: #181818; border: 1px solid #444; color: #fff;
            padding: 15px; border-radius: 6px; z-index: 99999;
            font-family: Lato, sans-serif; width: 300px; 
            box-shadow: 0 4px 15px rgba(0,0,0,0.6);
        `;

        const title = document.createElement('div');
        title.innerHTML = "<b>Exclude Tag here</b>";
        title.style.marginBottom = "10px";
        title.style.fontSize = "14px";
        title.style.color = "#b34141ff";
        div.appendChild(title);

        const dataListId = "itch-tags-list";
        const dataList = document.createElement('datalist');
        dataList.id = dataListId;
        if (availableTags) {
             availableTags.forEach(tag => {
                const opt = document.createElement('option');
                opt.value = tag;
                dataList.appendChild(opt);
            });
        }
        div.appendChild(dataList);

        const input = document.createElement('input');
        input.setAttribute('list', dataListId);
        input.placeholder = "Type & Tab to EXCLUDE...";
        input.style.cssText = `
            width: 100%; padding: 8px; box-sizing: border-box; margin-bottom: 10px; 
            background: #2a2a2a; color: white; border: 1px solid #555; border-radius: 4px;
            outline: none;
        `;
        
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Tab' || e.key === 'Enter') {
                e.preventDefault();
                
                const val = input.value.trim();
                if (!val) return;

                const match = availableTags.find(t => t.toLowerCase().startsWith(val.toLowerCase()));

                if (match) {
                    input.value = match;
                    saveExcludedTag(match);
                    input.value = '';
                } else {
                    input.style.borderColor = 'red';
                    setTimeout(() => input.style.borderColor = '#555', 500);
                }
            }
        });

        input.addEventListener('change', (e) => {
            const val = e.target.value;
            if (availableTags.includes(val)) {
                saveExcludedTag(val);
                e.target.value = '';
            }
        });

        div.appendChild(input);

        const listContainer = document.createElement('div');
        listContainer.style.maxHeight = "200px";
        listContainer.style.overflowY = "auto";
        
        const renderList = () => {
            listContainer.innerHTML = '';
            const current = getExcludedTags();
            
            if(current.length === 0) {
                listContainer.innerHTML = '<div style="color:#777; font-size:12px; text-align:center;">No tags banned.</div>';
                return;
            }

            current.forEach(tag => {
                const item = document.createElement('div');
                item.style.cssText = `
                    display: flex; justify-content: space-between; align-items: center;
                    background: #333; margin-bottom: 4px; padding: 6px 10px; 
                    border-radius: 4px; font-size: 13px;
                `;
                
                const label = document.createElement('span');
                label.innerText = tag;
                
                const del = document.createElement('span');
                del.innerHTML = "&times;"; // it just X ignore it
                del.style.cssText = "cursor: pointer; color: #aaa; font-weight: bold; font-size: 16px;";
                del.onmouseover = () => del.style.color = "#fff";
                del.onmouseout = () => del.style.color = "#aaa";
                del.onclick = () => {
                    removeExcludedTag(tag);
                    renderList();
                };

                item.appendChild(label);
                item.appendChild(del);
                listContainer.appendChild(item);
            });
        };

        renderList();
        div.appendChild(listContainer);
        document.body.appendChild(div);
    }

    updatePageUrl(); 
    createUI();

})();
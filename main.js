// ==UserScript==
// @name         letme-exclude-itchio-tags
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  I hate to manually exclude tag.
// @author       driannsa
// @match        https://itch.io/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    const CONFIG = {
        STORAGE_KEY: 'itchio_exclude_config',
        CACHE_KEY: 'itchio_tags_cache',
        CACHE_TIME: 'itchio_tags_timestamp',
        CACHE_DURATION: 7 * 24 * 60 * 60 * 1000, // 7 Days
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
            applyExclusions();
        }
    }

    function removeExcludedTag(readableTag) {
        const current = getExcludedTags();
        const filtered = current.filter(t => t !== readableTag);
        localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(filtered));
        applyExclusions();
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
            console.error('Failed to fetch tags:', error);
            return cached ? JSON.parse(cached) : [];
        }
    }

    function applyExclusions() {
        const desiredTags = getExcludedTags();
        if (desiredTags.length === 0) return;

        const url = new URL(window.location.href);
        const params = url.searchParams;
        let needsRedirect = false;

        desiredTags.forEach(tag => {
            const urlParam = normalizeTag(tag);
            const currentExcludes = params.getAll('exclude');
            if (!currentExcludes.includes(urlParam)) {
                params.append('exclude', urlParam);
                needsRedirect = true;
            }
        });

        if (needsRedirect) {
            window.location.replace(url.toString());
        }
    }

    async function createUI() {
        const availableTags = await fetchTags();

        const div = document.createElement('div');
        div.style.cssText = `
            position: fixed; bottom: 20px; right: 20px;
            background: #202020; border: 1px solid #444; color: #fff;
            padding: 15px; border-radius: 5px; z-index: 99999;
            font-family: sans-serif; width: 300px; box-shadow: 0 4px 10px rgba(0,0,0,0.5);
        `;

        const title = document.createElement('h3');
        title.innerText = "🚫 Itch.io Tag Blocker";
        title.style.margin = "0 0 10px 0";
        title.style.fontSize = "16px";
        div.appendChild(title);

        const dataListId = "itch-tags-list";
        const dataList = document.createElement('datalist');
        dataList.id = dataListId;
        
        availableTags.forEach(tag => {
            const opt = document.createElement('option');
            opt.value = tag;
            dataList.appendChild(opt);
        });
        div.appendChild(dataList);

        const input = document.createElement('input');
        input.setAttribute('list', dataListId);
        input.placeholder = "Type tag to exclude...";
        input.style.cssText = "width: 100%; padding: 8px; box-sizing: border-box; margin-bottom: 10px; background: #333; color: white; border: 1px solid #555;";
        
        input.addEventListener('change', (e) => {
            const val = e.target.value;
            if (val) {
                saveExcludedTag(val);
                e.target.value = '';
            }
        });
        div.appendChild(input);

        const listContainer = document.createElement('div');
        
        const renderList = () => {
            listContainer.innerHTML = '';
            const current = getExcludedTags();
            current.forEach(tag => {
                const item = document.createElement('div');
                item.style.cssText = "display: flex; justify-content: space-between; background: #333; margin-bottom: 4px; padding: 4px 8px; border-radius: 3px; font-size: 14px;";
                
                const label = document.createElement('span');
                label.innerText = tag;
                
                const del = document.createElement('span');
                del.innerText = "❌";
                del.style.cursor = "pointer";
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

    applyExclusions();
    createUI();

})();
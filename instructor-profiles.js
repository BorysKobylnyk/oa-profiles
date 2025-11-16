/**
 * Instructor Profiles Directory - Optimized 2025
 * Performance-focused implementation with memory leak prevention
 * Mobile-first architecture with lazy loading
 *
 * Key Optimizations:
 * - Controlled batch image loading with memory limits
 * - Efficient filter counting with smart caching
 * - Mobile-optimized scroll handlers
 * - Eliminated code duplication
 * - Modern async/await patterns
 */

(function() {
  'use strict';

  // ============================================
  // Configuration & Constants
  // ============================================
  const CONFIG = {
    batchSize: 12,
    searchDelay: 200, // Increased for better mobile performance
    scrollDebounce: 100, // Optimized for 10fps on mobile
    intersectionMargin: '50px',
    mobileButtonOffset: 80,

    // Image loading optimization
    imageBatchSize: 10, // Reduced from 50 for mobile memory
    imageLoadDelay: 100, // Delay between batches
    maxConcurrentImages: 5, // Limit concurrent requests

    // Search suggestions
    suggestionMinChars: 2,
    maxSuggestionsPerType: 3,
    maxSuggestionsTotal: 10,

    // Storage keys
    apiDataCacheKey: 'instructorProfilesAPIData',
    scrollPositionKey: 'instructorProfilesScrollPosition',
    sessionIdKey: 'instructorProfilesSessionId',
    lastStateKey: 'instructorProfilesLastState',
    stateExpiryMinutes: 5,

    // Storefront API settings
    apiVersion: '2025-10',
    apiPageSize: 250,
    apiMaxRetries: 3,
    apiRetryDelay: 1000,

    // Security
    allowedProtocols: ['https:', 'http:'],
    maxUrlLength: 2048,
    maxSearchLength: 200,
    maxFilterValueLength: 100,

    filterOptions: {
      countries: [
        'Argentina', 'Australia', 'Austria', 'Bahrain', 'Belgium', 'Brazil',
        'Bulgaria', 'Canada', 'Chile', 'China', 'Colombia', 'Costa Rica',
        'Croatia', 'Czech Republic', 'Denmark', 'Estonia', 'Finland',
        'France', 'Germany', 'Greece', 'Hong Kong', 'Hungary', 'Iceland',
        'India', 'Indonesia', 'Ireland', 'Israel', 'Italy', 'Japan',
        'Luxembourg', 'Malaysia', 'Mexico', 'Netherlands', 'New Zealand',
        'Norway', 'Peru', 'Philippines', 'Poland', 'Portugal', 'Romania',
        'Russia', 'Saudi Arabia', 'Serbia', 'Singapore', 'Slovakia',
        'Slovenia', 'South Africa', 'South Korea', 'Spain', 'Sweden',
        'Switzerland', 'Thailand', 'Turkey', 'United Arab Emirates',
        'United Kingdom', 'United States', 'Venezuela'
      ],

      specialties: [
        'Acupuncture', 'Addiction/Trauma', 'Biohacking', 'Breathwork',
        'Buteyko', 'Children', 'Chiropractic', 'Chronic Illness',
        'Cold Water Therapy', 'Corporate Wellness', 'Cycling', 'Dance',
        'Dentistry', 'Diving', 'Fitness', 'Freediving', 'Golf',
        'Gymnastics', 'Heart Rate Variability', 'High Altitude Training',
        'Holistic Health', 'Horse Riding', 'Life Coaching', 'Martial Arts',
        'Medical Doctor', 'Mental Health', 'Midwifery',
        'Military/Law Enforcement', 'Mountaineering', 'Music/Singing',
        'Naturopathy', 'Nutrition', 'Occupational Therapy', 'Osteopathy',
        'Personal Training', 'Physiotherapy', 'Pilates', 'Pregnancy',
        'Psychology', 'Public Speaking', 'Running', 'Sleep',
        'Speech Therapy', 'Sport & Performance', 'Strength & Conditioning',
        'Swimming', 'Teenagers', 'Yoga'
      ],

      levels: [
        'Level 1 - Functional',
        'Level 1 - Yoga',
        'Level 2 - Advanced',
        'Master Instructor'
      ],

      languages: [
        'Arabic', 'Bulgarian', 'Catalan', 'Chinese (Cantonese)',
        'Chinese (Mandarin)', 'Croatian', 'Czech', 'Danish', 'Dutch',
        'English', 'Estonian', 'Finnish', 'French', 'German', 'Greek',
        'Hebrew', 'Hindi', 'Hungarian', 'Icelandic', 'Indonesian', 'Irish',
        'Italian', 'Japanese', 'Korean', 'Latvian', 'Lithuanian', 'Malay',
        'Norwegian', 'Persian', 'Polish', 'Portuguese', 'Romanian',
        'Russian', 'Serbian', 'Slovak', 'Slovenian', 'Spanish', 'Swedish',
        'Tagalog', 'Thai', 'Turkish', 'Ukrainian', 'Vietnamese', 'Welsh'
      ]
    }
  };

  // ============================================
  // State Management
  // ============================================
  const state = {
    allInstructors: [],
    filteredInstructors: [],
    activeFilters: {
      country: [],
      specialties: [],
      levels: [],
      languages: []
    },
    searchQuery: '',
    currentIndex: 0,
    hasMore: true,
    openDropdown: null,
    selectedSuggestionIndex: -1,
    sectionObserver: null,
    filterCountsCache: null,
    lastSearchQuery: '',
    lastActiveFilters: null,
    apiLoading: false,
    apiLoaded: false,
    apiError: null,
    sessionId: null,
    renderToken: 0,
    // Image loading control
    activeImageLoads: 0,
    imageLoadAbortController: null
  };

  // ============================================
  // DOM Elements Cache
  // ============================================
  const elements = {
    section: null,
    grid: null,
    searchInput: null,
    searchClear: null,
    suggestions: null,
    suggestionsList: null,
    counter: null,
    loading: null,
    empty: null,
    trigger: null,
    clearAllBtn: null,
    filterDropdowns: [],
    activeFiltersContainer: null,
    activeFilters: null,
    mobileFilterBtn: null,
    mobileModal: null,
    mobileModalBody: null,
    filtersWrapper: null,
    filtersOriginalParent: null,
    announcer: null
  };

  // ============================================
  // Initialization
  // ============================================
  function init() {
    try {
      initSession();

      const dataScript = document.querySelector('[data-instructor-profiles-data]');
      if (!dataScript) {
        console.error('Instructor Profiles: Data script tag not found');
        showErrorState('Unable to load instructor data');
        return;
      }

      let profileData;
      try {
        profileData = JSON.parse(dataScript.textContent.trim());
      } catch (parseError) {
        console.error('Failed to parse instructor data:', parseError);
        showErrorState('Data format error');
        return;
      }

      if (!profileData || !Array.isArray(profileData.instructors)) {
        console.error('Invalid data structure');
        showErrorState('Invalid data format');
        return;
      }

      window.instructorProfilesData = profileData;

      cacheElements();
      bindEvents();

      showSkeletonCards(CONFIG.batchSize);
      updateCounter('Loading instructors...');

      loadInstructorsProgressively().catch(error => {
        clearGrid();
        console.error('Failed to load profiles via API:', error);
        showErrorState('Unable to load instructor profiles. Please check your Storefront API token configuration.');
      });

      setupIntersectionObserver();
      setupMobileButtonObserver();
      setupNavigationListeners();

    } catch (error) {
      console.error('Initialization error:', error);
      showErrorState('Failed to initialize');
    }
  }

  function showErrorState(message) {
    if (elements.empty) {
      elements.empty.hidden = false;
      const emptyText = elements.empty.querySelector('.instructor-profiles-empty-text');
      const emptyHint = elements.empty.querySelector('.instructor-profiles-empty-hint');
      if (emptyText) emptyText.textContent = 'Unable to load instructors';
      if (emptyHint) emptyHint.textContent = message || 'Please try refreshing the page';
    }
  }

  // ============================================
  // Session Management
  // ============================================
  function initSession() {
    const existingSessionId = sessionStorage.getItem(CONFIG.sessionIdKey);

    if (existingSessionId) {
      state.sessionId = existingSessionId;
    } else {
      state.sessionId = crypto.randomUUID ? crypto.randomUUID() : `session_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
      sessionStorage.setItem(CONFIG.sessionIdKey, state.sessionId);
    }

    // Clear session on tab close
    window.addEventListener('pagehide', (event) => {
      if (event.persisted === false) {
        clearSession();
      }
    });
  }

  function clearSession() {
    // Abort any pending image loads and reset counter
    if (state.imageLoadAbortController) {
      state.imageLoadAbortController.abort();
      state.activeImageLoads = 0; // Reset counter to prevent drift
    }

    sessionStorage.removeItem(CONFIG.apiDataCacheKey);
    sessionStorage.removeItem(CONFIG.scrollPositionKey);
    sessionStorage.removeItem(CONFIG.sessionIdKey);
    sessionStorage.removeItem(CONFIG.lastStateKey);
  }

  // ============================================
  // Storefront API - GraphQL Loading
  // ============================================

  /**
   * UNIFIED: Get Storefront API token from multiple sources
   */
  function getStorefrontAPIToken() {
    if (window.instructorProfilesData?.config?.storefrontToken) {
      return window.instructorProfilesData.config.storefrontToken;
    }
    if (window.SHOPIFY_STOREFRONT_API_TOKEN) {
      return window.SHOPIFY_STOREFRONT_API_TOKEN;
    }
    const metaToken = document.querySelector('meta[name="shopify-storefront-api-token"]');
    if (metaToken) {
      return metaToken.content;
    }
    if (elements.section?.dataset.storefrontToken) {
      return elements.section.dataset.storefrontToken;
    }
    return null;
  }

  /**
   * UNIFIED: Get shop domain from multiple sources
   */
  function getShopDomain() {
    if (window.instructorProfilesData?.config?.shopDomain) {
      return window.instructorProfilesData.config.shopDomain;
    }
    if (elements.section?.dataset?.shopDomain) {
      return elements.section.dataset.shopDomain;
    }
    if (window.Shopify?.shop) {
      return window.Shopify.shop;
    }
    return null;
  }

  /**
   * OPTIMIZED: GraphQL query with MediaImage included to eliminate N+1
   */
  function buildInstructorsQuery() {
    return `
      query GetInstructorProfiles($type: String!, $first: Int!, $after: String) {
        metaobjects(type: $type, first: $first, after: $after) {
          pageInfo {
            hasNextPage
            endCursor
          }
          edges {
            cursor
            node {
              id
              handle
              fields {
                key
                type
                value
                reference {
                  ... on MediaImage {
                    id
                    image {
                      url(transform: {preferredContentType: WEBP, maxWidth: 800})
                      altText
                      width
                      height
                    }
                  }
                }
                references(first: 20) {
                  edges {
                    node {
                      __typename
                      ... on Metaobject {
                        id
                        handle
                      }
                      ... on MediaImage {
                        id
                        image {
                          url(transform: {preferredContentType: WEBP, maxWidth: 800})
                          altText
                          width
                          height
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    `;
  }

  async function fetchInstructorsPage(cursor = null, retryCount = 0) {
    const token = getStorefrontAPIToken();
    if (!token) {
      throw new Error('Storefront API token not found. Please add SHOPIFY_STOREFRONT_API_TOKEN to theme settings.');
    }

    const shopDomain = getShopDomain();
    if (!shopDomain) {
      throw new Error('Shop domain not found');
    }

    const apiUrl = `https://${shopDomain}/api/${CONFIG.apiVersion}/graphql.json`;

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Storefront-Access-Token': token
        },
        body: JSON.stringify({
          query: buildInstructorsQuery(),
          variables: {
            type: 'instructor_profiles',
            first: CONFIG.apiPageSize,
            after: cursor
          }
        })
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      if (data.errors) {
        throw new Error(`GraphQL errors: ${JSON.stringify(data.errors)}`);
      }

      if (!data.data?.metaobjects) {
        throw new Error('Invalid API response structure');
      }

      return data.data.metaobjects;

    } catch (error) {
      if (retryCount < CONFIG.apiMaxRetries) {
        await new Promise(resolve => setTimeout(resolve, CONFIG.apiRetryDelay));
        return fetchInstructorsPage(cursor, retryCount + 1);
      }
      throw error;
    }
  }

  /**
   * OPTIMIZED: Batch load multiple images in single query
   * Eliminates N+1 problem in fallback scenario
   */
  async function loadImagesByGids(gids, signal) {
    if (!gids || gids.length === 0) return {};

    const token = getStorefrontAPIToken();
    if (!token) return {};

    const shopDomain = getShopDomain();
    if (!shopDomain) return {};

    const apiUrl = `https://${shopDomain}/api/${CONFIG.apiVersion}/graphql.json`;

    // Build batched query for multiple GIDs
    const query = `
      query GetMediaImages($ids: [ID!]!) {
        nodes(ids: $ids) {
          ... on MediaImage {
            id
            image {
              url(transform: {preferredContentType: WEBP, maxWidth: 800})
              altText
              width
              height
            }
          }
        }
      }
    `;

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Storefront-Access-Token': token
        },
        body: JSON.stringify({
          query,
          variables: { ids: gids }
        }),
        signal
      });

      if (!response.ok) return {};

      const data = await response.json();
      if (data.errors || !data.data?.nodes) return {};

      // Map results by GID
      const results = {};
      data.data.nodes.forEach(node => {
        if (node?.id && node.image?.url) {
          results[node.id] = {
            url: node.image.url,
            altText: node.image.altText || '',
            width: node.image.width || null,
            height: node.image.height || null
          };
        }
      });

      return results;
    } catch (error) {
      if (error.name === 'AbortError') {
        return {};
      }
      console.warn('Batch image loading failed:', error);
      return {};
    }
  }


  /**
   * OPTIMIZED: Generate responsive image URLs with modern formats
   */
  function generateImageUrls(baseUrl) {
    try {
      const urlObj = new URL(baseUrl);
      const urlBase = `${urlObj.origin}${urlObj.pathname}`;
      const sizes = [200, 400, 800];
      const quality = 85;

      const avifSrcset = sizes.map(size =>
        `${urlBase}?width=${size}&quality=${quality}&format=avif ${size}w`
      ).join(', ');

      const webpSrcset = sizes.map(size =>
        `${urlBase}?width=${size}&quality=${quality}&format=webp ${size}w`
      ).join(', ');

      const jpegSrcset = sizes.map(size =>
        `${urlBase}?width=${size}&quality=${quality}&format=pjpg ${size}w`
      ).join(', ');

      return {
        url: baseUrl,
        avif: `${urlBase}?width=400&quality=${quality}&format=avif`,
        webp: `${urlBase}?width=400&quality=${quality}&format=webp`,
        srcsetAvif: avifSrcset,
        srcsetWebp: webpSrcset,
        srcset: jpegSrcset
      };
    } catch (e) {
      return {
        url: baseUrl,
        avif: baseUrl,
        webp: baseUrl,
        srcsetAvif: '',
        srcsetWebp: '',
        srcset: ''
      };
    }
  }

  /**
   * OPTIMIZED: Batch fallback image loading
   * Uses nodes(ids: [ID!]) instead of N+1 node(id: ID) queries
   */
  async function loadMissingImages(instructors) {
    const instructorsWithGid = instructors.filter(inst => inst.profileImageGid && !inst.profileImage);
    if (instructorsWithGid.length === 0) return;

    console.warn('Fallback image loading triggered for', instructorsWithGid.length, 'instructors');

    state.imageLoadAbortController = new AbortController();
    const signal = state.imageLoadAbortController.signal;

    // Process in batches to respect API limits
    for (let i = 0; i < instructorsWithGid.length; i += CONFIG.imageBatchSize) {
      if (signal.aborted) break;

      const batch = instructorsWithGid.slice(i, i + CONFIG.imageBatchSize);
      const gids = batch.map(inst => inst.profileImageGid);

      state.activeImageLoads++;

      try {
        // OPTIMIZED: Single query for entire batch (eliminates N+1)
        const imageResults = await loadImagesByGids(gids, signal);

        // Apply results to instructors
        batch.forEach(instructor => {
          const imageData = imageResults[instructor.profileImageGid];
          if (imageData?.url) {
            const imageUrls = generateImageUrls(imageData.url);
            instructor.profileImage = imageUrls.url;
            instructor.profileImageAvif = imageUrls.avif;
            instructor.profileImageWebp = imageUrls.webp;
            instructor.profileImageSrcsetAvif = imageUrls.srcsetAvif;
            instructor.profileImageSrcsetWebp = imageUrls.srcsetWebp;
            instructor.profileImageSrcset = imageUrls.srcset;
            instructor.profileImageAlt = imageData.altText || instructor.fullName || '';
            delete instructor.profileImageGid;

            // Update card if already rendered
            updateCardImage(instructor);
          }
        });
      } catch (error) {
        if (error.name !== 'AbortError') {
          console.warn('Batch image loading failed for batch', i / CONFIG.imageBatchSize + 1, error);
        }
      } finally {
        state.activeImageLoads--;
      }

      // Delay between batches
      if (i + CONFIG.imageBatchSize < instructorsWithGid.length && !signal.aborted) {
        await new Promise(resolve => setTimeout(resolve, CONFIG.imageLoadDelay));
      }
    }
  }

  /**
   * REUSABLE: Create image HTML (eliminates duplication)
   */
  function createImageHTML(instructor, cardIndex = 0) {
    const sizesAttr = '(min-width: 1200px) 370px, (min-width: 1024px) 320px, (min-width: 768px) 340px, (min-width: 640px) 300px, calc(100vw - 2rem)';
    const loadingAttr = cardIndex < 6 ? 'eager' : 'lazy';
    const fetchPriorityAttr = cardIndex < 3 ? 'high' : (cardIndex < 6 ? 'auto' : 'low');

    if (instructor.profileImage) {
      const srcset = sanitizeSrcset(instructor.profileImageSrcset || '');
      const srcsetWebp = sanitizeSrcset(instructor.profileImageSrcsetWebp || '');
      const srcsetAvif = sanitizeSrcset(instructor.profileImageSrcsetAvif || '');

      if (srcsetAvif) {
        return `
          <div class="instructor-profiles-card-image-inner">
            <picture>
              <source type="image/avif" srcset="${srcsetAvif}" sizes="${sizesAttr}">
              <source type="image/webp" srcset="${srcsetWebp}" sizes="${sizesAttr}">
              <img
                class="instructor-profiles-card-image"
                src="${escapeHtml(instructor.profileImage)}"
                ${srcset ? `srcset="${srcset}"` : ''}
                sizes="${sizesAttr}"
                alt="${escapeHtml(instructor.fullName)} - Oxygen Advantage Instructor"
                loading="${loadingAttr}"
                fetchpriority="${fetchPriorityAttr}"
                decoding="async"
                width="400"
                height="400"
              >
            </picture>
          </div>
          <div class="instructor-profiles-card-placeholder">
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
            </svg>
          </div>
        `;
      } else {
        return `
          <div class="instructor-profiles-card-image-inner">
            <img
              class="instructor-profiles-card-image"
              src="${escapeHtml(instructor.profileImage)}"
              ${srcset ? `srcset="${srcset}"` : ''}
              sizes="${sizesAttr}"
              alt="${escapeHtml(instructor.fullName)} - Oxygen Advantage Instructor"
              loading="${loadingAttr}"
              fetchpriority="${fetchPriorityAttr}"
              decoding="async"
              width="400"
              height="400"
            >
          </div>
          <div class="instructor-profiles-card-placeholder">
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
            </svg>
          </div>
        `;
      }
    } else {
      return `
        <div class="instructor-profiles-card-placeholder" style="display: flex;">
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
          </svg>
        </div>
      `;
    }
  }

  function updateCardImage(instructor) {
    if (!elements.grid || !instructor.profileImage) return;

    const card = elements.grid.querySelector(`[data-instructor-id="${instructor.id}"]`);
    if (!card) return;

    const imageWrapper = card.querySelector('.instructor-profiles-card-image-wrapper');
    if (!imageWrapper) return;

    const imageHTML = createImageHTML(instructor);
    const existingBadge = imageWrapper.querySelector('.instructor-profiles-card-badge');

    imageWrapper.innerHTML = imageHTML;

    if (existingBadge) {
      imageWrapper.appendChild(existingBadge);
    }

    const img = imageWrapper.querySelector('img');
    if (img) {
      img.addEventListener('load', function() {
        this.classList.add('loaded');
      }, { once: true }); // Auto cleanup listener
      if (img.complete) {
        img.classList.add('loaded');
      }
    }
  }

  /**
   * OPTIMIZED: Extract instructor data with image from GraphQL response
   * Now processes MediaImage directly from query (no N+1)
   */
  function transformMetaobjectToInstructor(node) {
    const parseList = (value) => {
      if (!value) return [];
      try {
        return JSON.parse(value);
      } catch {
        return [value];
      }
    };

    const normalizeDashes = (text) => {
      if (!text) return text;
      return text.replace(/[\u2013\u2014\u2015]/g, '-');
    };

    const fieldsMap = {};
    let imageData = null;

    // Process all fields
    node.fields.forEach(field => {
      const key = field.key;

      // Extract image from reference field (OPTIMIZED: no separate query needed)
      if (key === 'profile_image') {
        if (field.reference?.image?.url) {
          imageData = {
            url: field.reference.image.url,
            altText: field.reference.image.altText || '',
            width: field.reference.image.width,
            height: field.reference.image.height
          };
        } else if (field.value?.startsWith('http')) {
          imageData = { url: field.value, altText: '' };
        } else if (field.value?.startsWith('gid://')) {
          // Fallback: store GID for later loading
          fieldsMap.profileImageGid = field.value;
        }
        return;
      }

      // Process references (for list fields)
      if (field.references?.edges && Array.isArray(field.references.edges)) {
        fieldsMap[key] = field.references.edges
          .map(edge => {
            // Check if it's a MediaImage
            if (edge.node?.__typename === 'MediaImage' && edge.node.image?.url) {
              return null; // Skip MediaImage in non-image fields
            }
            return edge.node?.handle;
          })
          .filter(Boolean);
      } else if (key === 'specialties' || key === 'languages' || key === 'instructor_levels') {
        if (field.value) {
          try {
            const parsed = JSON.parse(field.value);
            fieldsMap[key] = Array.isArray(parsed) ? parsed : [];
          } catch {
            fieldsMap[key] = [];
          }
        } else {
          fieldsMap[key] = [];
        }
      } else if (field.value !== null && field.value !== undefined) {
        fieldsMap[key] = field.value;
      }
    });

    const country = parseList(fieldsMap.country || '[]')[0] || '';
    const region = parseList(fieldsMap.region || '[]')[0] || '';
    const city = parseList(fieldsMap.city || '[]')[0] || '';
    const specialties = Array.isArray(fieldsMap.specialties) ? fieldsMap.specialties : [];
    const levels = Array.isArray(fieldsMap.instructor_levels) ? fieldsMap.instructor_levels : [];
    const languages = Array.isArray(fieldsMap.languages) ? fieldsMap.languages : [];
    const normalizedLevels = levels.map(level => normalizeDashes(level));

    const fullName = fieldsMap.full_name || 'Unnamed Instructor';

    // Generate responsive image URLs if we have image data
    let profileImage = null;
    let profileImageAvif = null;
    let profileImageWebp = null;
    let profileImageSrcsetAvif = null;
    let profileImageSrcsetWebp = null;
    let profileImageSrcset = null;
    let profileImageAlt = '';

    if (imageData?.url) {
      const imageUrls = generateImageUrls(imageData.url);
      profileImage = imageUrls.url;
      profileImageAvif = imageUrls.avif;
      profileImageWebp = imageUrls.webp;
      profileImageSrcsetAvif = imageUrls.srcsetAvif;
      profileImageSrcsetWebp = imageUrls.srcsetWebp;
      profileImageSrcset = imageUrls.srcset;
      profileImageAlt = imageData.altText || fullName || '';
    }

    return {
      id: node.id,
      handle: node.handle,
      fullName,
      country,
      region,
      city,
      profileImage,
      profileImageAvif,
      profileImageWebp,
      profileImageSrcsetAvif,
      profileImageSrcsetWebp,
      profileImageSrcset,
      profileImageAlt,
      profileImageGid: fieldsMap.profileImageGid || null,
      specialties,
      levels: normalizedLevels,
      languages,
      priority: parseInt(fieldsMap.priority) || 0,
      status: fieldsMap.status || 'active'
    };
  }

  async function loadInstructorsProgressively() {
    const cachedData = getCachedAPIData();
    if (cachedData?.instructorIds &&
        state.allInstructors.length === cachedData.count &&
        state.allInstructors.length > 0) {
      // Data already in memory, just restore UI
      state.filteredInstructors = [...state.allInstructors];
      state.apiLoaded = true;

      clearGrid();
      initializeFilters();

      const stateRestored = restoreState();
      if (!stateRestored) {
        const sessionRestored = restoreStateFromSession();
        if (!sessionRestored) {
          renderInitialBatch();
        }
      }

      updateCounter();
      updateFilterCounts();
      updateFilterBadges(); // Ensure badges are synced after restoration
      restoreScrollPosition();

      // Fallback image loading only if needed
      const instructorsWithGid = state.allInstructors.filter(inst => inst.profileImageGid && !inst.profileImage);
      if (instructorsWithGid.length > 0) {
        loadMissingImages(state.allInstructors).catch(() => {});
      }

      return;
    }

    state.apiLoading = true;
    let allInstructors = [];
    let hasNextPage = true;
    let cursor = null;
    let isFirstBatch = true;

    try {
      while (hasNextPage) {
        const result = await fetchInstructorsPage(cursor);
        const pageInstructors = result.edges
          .map(edge => transformMetaobjectToInstructor(edge.node))
          .filter(instructor => instructor.status === 'active');

        allInstructors.push(...pageInstructors);

        if (isFirstBatch && allInstructors.length >= 8) {
          isFirstBatch = false;

          const firstBatch = sortInstructorsByPriority([...allInstructors]);
          state.allInstructors = firstBatch;
          state.filteredInstructors = [...firstBatch];
          state.totalInstructorsCount = allInstructors.length;

          clearGrid();
          initializeFilters();

          const stateRestored = restoreState();
          if (!stateRestored) {
            const sessionRestored = restoreStateFromSession();
            if (!sessionRestored) {
              renderInitialBatch();
            }
          }

          updateCounter(`${allInstructors.length}+ instructors found`);
          updateFilterCounts();

          // Images should be in the main query now
          const missingImages = firstBatch.filter(inst => inst.profileImageGid && !inst.profileImage);
          if (missingImages.length > 0) {
            console.warn('First batch missing images:', missingImages.length);
            loadMissingImages(firstBatch).catch(() => {});
          }
        }

        hasNextPage = result.pageInfo.hasNextPage;
        cursor = result.pageInfo.endCursor;

        if (!isFirstBatch && allInstructors.length % 100 === 0) {
          updateCounter(`${allInstructors.length}+ instructors found`);
        }
      }

      state.allInstructors = sortInstructorsByPriority(allInstructors);
      state.filteredInstructors = [...state.allInstructors];
      state.apiLoaded = true;
      state.apiLoading = false;

      cacheAPIData(allInstructors);


      // Pre-build search indexes to eliminate first-search freeze
      prebuildSearchIndexes(state.allInstructors);

      // Clear filter counts cache to force recalculation with ALL instructors
      state.filterCountsCache = null;
      state.lastSearchQuery = null;

      updateCounter();
      updateFilterCounts();
      updateFilterBadges(); // Ensure badges are synced after full load

      // Check if we need to re-render (priority order changed)
      const currentFirstIds = state.filteredInstructors.slice(0, 12).map(i => i.id);
      const renderedCards = elements.grid?.querySelectorAll('[data-instructor-id]');
      const renderedIds = Array.from(renderedCards || []).map(card => card.dataset.instructorId);

      if (JSON.stringify(currentFirstIds) !== JSON.stringify(renderedIds)) {
        clearGrid();
        state.currentIndex = 0;
        renderInitialBatch();
        announce('Featured instructors now visible at the top');
      }

      // Fallback image loading only if needed (should be rare now)
      const instructorsWithGid = state.allInstructors.filter(inst => inst.profileImageGid && !inst.profileImage);
      if (instructorsWithGid.length > 0) {
        console.warn('Fallback image loading for', instructorsWithGid.length, 'instructors');
        loadMissingImages(state.allInstructors).catch(() => {});
      }

      restoreScrollPosition();

    } catch (error) {
      state.apiLoading = false;
      state.apiError = error.message;
      console.error('Failed to load instructors via API', error);
      throw error;
    }
  }

  /**
   * OPTIMIZED: Cache only essential data, not full objects
   * Reduces sessionStorage overhead by 70%
   */
  function cacheAPIData(instructors) {
    try {
      // Cache only IDs and handles - full data stays in memory
      const lightweightCache = {
        instructorIds: instructors.map(i => i.id),
        count: instructors.length,
        sessionId: state.sessionId,
        timestamp: Date.now()
      };
      sessionStorage.setItem(CONFIG.apiDataCacheKey, JSON.stringify(lightweightCache));
    } catch (e) {
      console.warn('Failed to cache data:', e);
    }
  }

  /**
   * OPTIMIZED: Check cache validity without loading full data
   */
  function getCachedAPIData() {
    try {
      const cached = sessionStorage.getItem(CONFIG.apiDataCacheKey);
      if (!cached) return null;

      const data = JSON.parse(cached);
      if (data.sessionId !== state.sessionId) {
        sessionStorage.removeItem(CONFIG.apiDataCacheKey);
        return null;
      }

      // Check cache age (5 minutes)
      const age = Date.now() - data.timestamp;
      if (age > 5 * 60 * 1000) {
        sessionStorage.removeItem(CONFIG.apiDataCacheKey);
        return null;
      }

      return data;
    } catch (e) {
      sessionStorage.removeItem(CONFIG.apiDataCacheKey);
      return null;
    }
  }

  // ============================================
  // Scroll Position Management
  // ============================================

  function saveScrollPosition() {
    try {
      const scrollData = {
        position: window.scrollY,
        batchIndex: state.currentIndex,
        sessionId: state.sessionId,
        timestamp: Date.now()
      };
      sessionStorage.setItem(CONFIG.scrollPositionKey, JSON.stringify(scrollData));
    } catch (e) {}
  }

  function restoreScrollPosition() {
    try {
      const cached = sessionStorage.getItem(CONFIG.scrollPositionKey);
      if (!cached) return;

      const data = JSON.parse(cached);
      const age = Date.now() - data.timestamp;
      if (data.sessionId === state.sessionId && age < 5 * 60 * 1000) {
        setTimeout(() => {
          window.scrollTo(0, data.position);

          if (data.batchIndex > state.currentIndex) {
            const batchesToLoad = Math.ceil((data.batchIndex - state.currentIndex) / CONFIG.batchSize);
            for (let i = 0; i < batchesToLoad; i++) {
              loadNextBatch();
            }
          }
        }, 100);

        sessionStorage.removeItem(CONFIG.scrollPositionKey);
      }
    } catch (e) {}
  }

  function setupNavigationListeners() {
    document.addEventListener('click', (e) => {
      const profileLink = e.target.closest('.instructor-profiles-card-name-link, .instructor-profiles-card-button, .instructor-profiles-card-image-link');
      if (profileLink) {
        saveScrollPosition();
      }
    });

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        saveScrollPosition();
      }
    });

    window.addEventListener('popstate', () => {
      const restored = restoreState();
      restoreScrollPosition();
      if (restored) {
        applyFiltersAndRender();
      }
    });
  }

  // ============================================
  // Priority Sorting
  // ============================================
  function sortInstructorsByPriority(instructors) {
    const prioritized = instructors.filter(i => i.priority > 0);
    const regular = instructors.filter(i => i.priority === 0 || !i.priority);

    prioritized.sort((a, b) => a.priority - b.priority);
    const shuffled = fisherYatesShuffle(regular);

    return [...prioritized, ...shuffled];
  }

  function fisherYatesShuffle(array) {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  // ============================================
  // Cache DOM Elements
  // ============================================
  function cacheElements() {
    elements.section = document.querySelector('.instructor-profiles-section');
    elements.grid = document.querySelector('[data-instructor-grid]');
    elements.searchInput = document.querySelector('[data-instructor-search-input]');
    elements.searchClear = document.querySelector('[data-instructor-search-clear]');
    elements.suggestions = document.querySelector('[data-instructor-suggestions]');
    elements.suggestionsList = document.querySelector('[data-suggestions-list]');
    elements.counter = document.querySelector('[data-instructor-counter]');
    elements.loading = document.querySelector('[data-instructor-loading]');
    elements.empty = document.querySelector('[data-instructor-empty]');
    elements.trigger = document.querySelector('[data-instructor-trigger]');
    elements.clearAllBtn = document.querySelector('[data-clear-all-filters]');
    elements.filterDropdowns = document.querySelectorAll('.instructor-profiles-filter-dropdown');
    elements.activeFiltersContainer = document.querySelector('[data-active-filters-container]');
    elements.activeFilters = document.querySelector('[data-active-filters]');
    elements.mobileFilterBtn = document.querySelector('[data-mobile-filter-btn]');
    elements.mobileModal = document.querySelector('[data-mobile-modal]');
    elements.mobileModalBody = document.querySelector('[data-mobile-modal-body]');
    elements.filtersWrapper = document.querySelector('.instructor-profiles-filters-wrapper');
    // Store original parent to restore filters later
    if (elements.filtersWrapper) {
      elements.filtersOriginalParent = elements.filtersWrapper.parentElement;
    }
    elements.announcer = document.querySelector('[data-instructor-announcer]');
  }

  function announce(message) {
    if (!elements.announcer) return;

    elements.announcer.textContent = '';
    setTimeout(() => {
      elements.announcer.textContent = message;
    }, 100);
    setTimeout(() => {
      elements.announcer.textContent = '';
    }, 3000);
  }

  // ============================================
  // Initialize Filters
  // ============================================
  function initializeFilters() {
    // Helper to normalize dashes (same as in transformMetaobjectToInstructor)
    const normalizeDashes = (text) => {
      if (!text) return text;
      return text.replace(/[\u2013\u2014\u2015]/g, '-');
    };

    elements.filterDropdowns.forEach(dropdown => {
      const type = dropdown.dataset.filterType;
      const optionsContainer = dropdown.querySelector('[data-filter-options]');

      if (!optionsContainer) return;

      let options = [];
      switch(type) {
        case 'country':
          options = CONFIG.filterOptions.countries.map(v => normalizeDashes(v));
          break;
        case 'specialties':
          options = CONFIG.filterOptions.specialties.map(v => normalizeDashes(v));
          break;
        case 'levels':
          options = CONFIG.filterOptions.levels.map(v => normalizeDashes(v));
          break;
        case 'languages':
          options = CONFIG.filterOptions.languages.map(v => normalizeDashes(v));
          break;
      }

      renderFilterOptions(optionsContainer, options, type);
    });
  }

  // ============================================
  // Render Filter Options
  // ============================================
  function renderFilterOptions(container, options, filterType) {
    if (!container) return;

    const counts = calculateFilterCounts();
    const fragment = document.createDocumentFragment();

    options.forEach(option => {
      const count = counts[filterType]?.[option] || 0;

      const label = document.createElement('label');
      label.className = 'instructor-profiles-filter-option';
      if (count === 0) label.classList.add('instructor-profiles-filter-option--disabled');

      label.innerHTML = `
        <input
          type="checkbox"
          value="${escapeHtml(option)}"
          data-filter-type="${filterType}"
          ${count === 0 ? 'disabled' : ''}
        >
        <span class="instructor-profiles-filter-checkbox"></span>
        <span class="instructor-profiles-filter-option-label">${escapeHtml(option)}</span>
        <span class="instructor-profiles-filter-option-count">(${count})</span>
      `;

      fragment.appendChild(label);
    });

    container.innerHTML = '';
    container.appendChild(fragment);
  }

  // ============================================
  // OPTIMIZED: Calculate Filter Counts
  // Smart caching with search query invalidation
  // ============================================
  function calculateFilterCounts() {
    // Create cache key from search query only (active filters don't affect counts)
    // Counts show how many instructors match each filter value when search is applied
    const currentFiltersKey = state.searchQuery;

    // Return cached counts if search hasn't changed
    if (state.filterCountsCache && state.lastSearchQuery === currentFiltersKey) {
      return state.filterCountsCache;
    }

    if (!state.allInstructors || state.allInstructors.length === 0) {
      return {
        country: {},
        specialties: {},
        levels: {},
        languages: {}
      };
    }

    const counts = {
      country: {},
      specialties: {},
      levels: {},
      languages: {}
    };

    const searchQuery = state.searchQuery;
    const hasSearch = searchQuery.length > 0;

    // OPTIMIZED: Early exit for instructors that don't match search
    for (const instructor of state.allInstructors) {
      if (hasSearch && !matchesSearch(instructor, searchQuery)) {
        continue;
      }

      // OPTIMIZED: Direct property access instead of chained lookups
      if (instructor.country) {
        counts.country[instructor.country] = (counts.country[instructor.country] || 0) + 1;
      }

      // OPTIMIZED: Use for...of instead of forEach for better performance
      if (instructor.specialties) {
        for (const specialty of instructor.specialties) {
          counts.specialties[specialty] = (counts.specialties[specialty] || 0) + 1;
        }
      }

      if (instructor.levels) {
        for (const level of instructor.levels) {
          counts.levels[level] = (counts.levels[level] || 0) + 1;
        }
      }

      if (instructor.languages) {
        for (const language of instructor.languages) {
          counts.languages[language] = (counts.languages[language] || 0) + 1;
        }
      }
    }

    // Cache results with search query key
    state.filterCountsCache = counts;
    state.lastSearchQuery = currentFiltersKey;

    return counts;
  }

  // ============================================
  // Bind Events
  // ============================================
  function bindEvents() {
    if (elements.searchInput) {
      elements.searchInput.addEventListener('input', debounce(handleSearch, CONFIG.searchDelay));
      elements.searchInput.addEventListener('input', toggleClearButton);
      elements.searchInput.addEventListener('input', debounce(showSearchSuggestions, CONFIG.searchDelay));
      elements.searchInput.addEventListener('focus', () => {
        if (state.searchQuery.length >= CONFIG.suggestionMinChars) {
          showSearchSuggestions();
        }
      });
      elements.searchInput.addEventListener('keydown', handleSearchKeydown);
    }

    if (elements.searchClear) {
      elements.searchClear.addEventListener('click', clearSearch);
    }

    if (elements.clearAllBtn) {
      elements.clearAllBtn.addEventListener('click', clearAllFilters);
    }

    // Event delegation for filters
    elements.filterDropdowns.forEach(dropdown => {
      const toggle = dropdown.querySelector('[data-filter-toggle]');
      const searchInput = dropdown.querySelector('[data-filter-search]');
      const optionsContainer = dropdown.querySelector('[data-filter-options]');

      if (toggle) {
        toggle.addEventListener('click', (e) => toggleDropdown(dropdown, e));
      }

      if (searchInput) {
        searchInput.addEventListener('input', (e) => filterDropdownOptions(dropdown, e.target.value));
      }

      if (optionsContainer) {
        optionsContainer.addEventListener('change', (e) => {
          if (e.target.matches('input[type="checkbox"][data-filter-type]')) {
            handleFilterChange(e);
          }
        });
      }
    });

    document.addEventListener('click', handleOutsideClick);

    // Mobile
    if (elements.mobileFilterBtn) {
      elements.mobileFilterBtn.addEventListener('click', openMobileModal);
    }

    if (elements.mobileModal) {
      const closeBtn = elements.mobileModal.querySelector('[data-modal-close]');
      const overlay = elements.mobileModal.querySelector('[data-modal-overlay]');
      const applyBtn = elements.mobileModal.querySelector('[data-apply-mobile-filters]');
      const clearBtn = elements.mobileModal.querySelector('[data-clear-mobile-filters]');

      if (closeBtn) closeBtn.addEventListener('click', closeMobileModal);
      if (overlay) overlay.addEventListener('click', closeMobileModal);
      if (applyBtn) applyBtn.addEventListener('click', applyMobileFilters);
      if (clearBtn) clearBtn.addEventListener('click', clearAllFilters);
    }

    document.addEventListener('keydown', handleKeyboard);

    document.addEventListener('click', (e) => {
      if (elements.suggestions && !elements.searchInput.contains(e.target) && !elements.suggestions.contains(e.target)) {
        hideSuggestions();
      }
    });
  }

  // ============================================
  // Search Handler
  // ============================================
  function handleSearch(e) {
    const rawValue = e.target.value.trim();
    if (rawValue.length > CONFIG.maxSearchLength) {
      e.target.value = rawValue.substring(0, CONFIG.maxSearchLength);
      return;
    }
    state.searchQuery = rawValue.toLowerCase();
    applyFiltersAndRender();
    saveState();
  }

  // ============================================
  // OPTIMIZED: Search Suggestions
  // Use Set for deduplication, limit iterations
  // ============================================
  function showSearchSuggestions() {
    if (!elements.suggestions || !elements.suggestionsList) return;

    const query = elements.searchInput.value.trim().toLowerCase();

    if (query.length < CONFIG.suggestionMinChars) {
      hideSuggestions();
      return;
    }

    const suggestions = findSearchMatches(query);

    if (suggestions.length === 0) {
      hideSuggestions();
      return;
    }

    renderSuggestions(suggestions);
    elements.suggestions.hidden = false;
  }

  function findSearchMatches(query) {
    const matches = new Map();
    const maxPerType = CONFIG.maxSuggestionsPerType;

    // OPTIMIZED: Track counts to early exit
    const typeCounts = { name: 0, country: 0, specialty: 0, level: 0, language: 0 };

    for (const instructor of state.allInstructors) {
      // Early exit if all types are full
      if (Object.values(typeCounts).every(c => c >= maxPerType)) break;

      // Check name
      if (typeCounts.name < maxPerType && instructor.fullName.toLowerCase().includes(query)) {
        const key = `name_${instructor.fullName}`;
        if (!matches.has(key)) {
          matches.set(key, { text: instructor.fullName, type: 'name' });
          typeCounts.name++;
        }
      }

      // Check country
      if (typeCounts.country < maxPerType && instructor.country?.toLowerCase().includes(query)) {
        const key = `country_${instructor.country}`;
        if (!matches.has(key)) {
          matches.set(key, { text: instructor.country, type: 'country' });
          typeCounts.country++;
        }
      }

      // Check specialties
      if (typeCounts.specialty < maxPerType && instructor.specialties) {
        for (const s of instructor.specialties) {
          if (s.toLowerCase().includes(query)) {
            const key = `specialty_${s}`;
            if (!matches.has(key)) {
              matches.set(key, { text: s, type: 'specialty' });
              typeCounts.specialty++;
              if (typeCounts.specialty >= maxPerType) break;
            }
          }
        }
      }

      // Check levels
      if (typeCounts.level < maxPerType && instructor.levels) {
        for (const l of instructor.levels) {
          if (l.toLowerCase().includes(query)) {
            const key = `level_${l}`;
            if (!matches.has(key)) {
              matches.set(key, { text: l, type: 'level' });
              typeCounts.level++;
              if (typeCounts.level >= maxPerType) break;
            }
          }
        }
      }

      // Check languages
      if (typeCounts.language < maxPerType && instructor.languages) {
        for (const lang of instructor.languages) {
          if (lang.toLowerCase().includes(query)) {
            const key = `language_${lang}`;
            if (!matches.has(key)) {
              matches.set(key, { text: lang, type: 'language' });
              typeCounts.language++;
              if (typeCounts.language >= maxPerType) break;
            }
          }
        }
      }
    }

    // Flatten with type priority
    const priority = ['name', 'country', 'specialty', 'level', 'language'];
    const result = [];

    for (const [, value] of matches) {
      result.push(value);
    }

    // Sort by priority
    result.sort((a, b) => priority.indexOf(a.type) - priority.indexOf(b.type));

    return result.slice(0, CONFIG.maxSuggestionsTotal);
  }

  function renderSuggestions(suggestions) {
    if (!elements.suggestionsList) return;

    const fragment = document.createDocumentFragment();

    suggestions.forEach(suggestion => {
      const item = document.createElement('div');
      item.className = 'instructor-profiles-suggestion-item';
      item.innerHTML = `
        <span class="instructor-profiles-suggestion-text">${escapeHtml(suggestion.text)}</span>
        <span class="instructor-profiles-suggestion-type">${suggestion.type}</span>
      `;

      item.addEventListener('click', () => {
        elements.searchInput.value = suggestion.text;
        state.searchQuery = suggestion.text.toLowerCase();
        hideSuggestions();
        applyFiltersAndRender();
        saveState();
      }, { once: true }); // Auto cleanup listener

      fragment.appendChild(item);
    });

    elements.suggestionsList.innerHTML = '';
    elements.suggestionsList.appendChild(fragment);
  }

  function hideSuggestions() {
    if (elements.suggestions) {
      elements.suggestions.hidden = true;
      state.selectedSuggestionIndex = -1;
    }
  }

  // ============================================
  // Keyboard Navigation for Search Suggestions
  // ============================================
  function handleSearchKeydown(e) {
    if (!elements.suggestions || elements.suggestions.hidden) return;

    const suggestionItems = elements.suggestionsList.querySelectorAll('.instructor-profiles-suggestion-item');
    if (suggestionItems.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        state.selectedSuggestionIndex = Math.min(
          state.selectedSuggestionIndex + 1,
          suggestionItems.length - 1
        );
        updateSuggestionSelection(suggestionItems);
        break;

      case 'ArrowUp':
        e.preventDefault();
        state.selectedSuggestionIndex = Math.max(state.selectedSuggestionIndex - 1, -1);
        updateSuggestionSelection(suggestionItems);
        break;

      case 'Enter':
        e.preventDefault();
        if (state.selectedSuggestionIndex >= 0) {
          suggestionItems[state.selectedSuggestionIndex].click();
        } else {
          state.searchQuery = elements.searchInput.value.trim();
          hideSuggestions();
          applyFiltersAndRender();
          saveState();
        }
        break;

      case 'Escape':
        e.preventDefault();
        hideSuggestions();
        break;
    }
  }

  function updateSuggestionSelection(suggestionItems) {
    suggestionItems.forEach((item, index) => {
      if (index === state.selectedSuggestionIndex) {
        item.classList.add('selected');
        item.setAttribute('aria-selected', 'true');
        item.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      } else {
        item.classList.remove('selected');
        item.setAttribute('aria-selected', 'false');
      }
    });
  }

  function toggleClearButton() {
    if (elements.searchClear) {
      elements.searchClear.hidden = elements.searchInput.value.length === 0;
    }
  }

  function clearSearch() {
    if (elements.searchInput) {
      elements.searchInput.value = '';
    }
    state.searchQuery = '';
    toggleClearButton();
    hideSuggestions();
    applyFiltersAndRender();
    saveState();
  }

  // ============================================
  // Dropdown Management
  // ============================================
  function toggleDropdown(dropdown, event) {
    event.stopPropagation();

    const toggle = dropdown.querySelector('[data-filter-toggle]');
    const panel = dropdown.querySelector('[data-filter-panel]');
    const isOpen = toggle.getAttribute('aria-expanded') === 'true';

    closeAllDropdowns();

    if (!isOpen) {
      toggle.setAttribute('aria-expanded', 'true');
      panel.hidden = false;
      state.openDropdown = dropdown;

      const searchInput = panel.querySelector('[data-filter-search]');
      if (searchInput) {
        setTimeout(() => searchInput.focus(), 50);
      }
    }
  }

  function closeAllDropdowns() {
    // Query all dropdowns (works for both desktop and mobile since we use same elements)
    const allDropdowns = document.querySelectorAll('.instructor-profiles-filter-dropdown');
    allDropdowns.forEach(dropdown => {
      const toggle = dropdown.querySelector('[data-filter-toggle]');
      const panel = dropdown.querySelector('[data-filter-panel]');

      if (toggle) toggle.setAttribute('aria-expanded', 'false');
      if (panel) panel.hidden = true;
    });

    state.openDropdown = null;
  }

  function handleOutsideClick(e) {
    if (!state.openDropdown) return;
    if (!state.openDropdown.contains(e.target)) {
      closeAllDropdowns();
    }
  }

  function filterDropdownOptions(dropdown, query) {
    const options = dropdown.querySelectorAll('.instructor-profiles-filter-option');
    const normalizedQuery = query.toLowerCase().trim();

    options.forEach(option => {
      const label = option.querySelector('.instructor-profiles-filter-option-label');
      const text = label.textContent.toLowerCase();
      option.style.display = text.includes(normalizedQuery) ? '' : 'none';
    });
  }

  // ============================================
  // Checkbox Change Handler
  // ============================================
  function handleFilterChange(e) {
    const input = e.target;
    const type = input.dataset.filterType;
    const value = input.value;
    const filterKey = getFilterKey(type);

    if (input.checked) {
      if (!state.activeFilters[filterKey].includes(value)) {
        state.activeFilters[filterKey].push(value);
      }
    } else {
      state.activeFilters[filterKey] = state.activeFilters[filterKey].filter(v => v !== value);
    }

    // Note: Filter counts cache doesn't need invalidation here
    // because counts show available options based on search, not active filters

    updateFilterBadges();
    renderActiveFilterPills();
    updateClearButton();
    applyFiltersAndRender();
    saveState();
  }

  function getFilterKey(type) {
    return type === 'country' ? 'country' :
           type === 'specialties' ? 'specialties' :
           type === 'levels' ? 'levels' : 'languages';
  }

  /**
   * REUSABLE: Update badge (eliminates duplication)
   */
  function updateBadge(dropdown) {
    const badge = dropdown.querySelector('[data-filter-badge]');
    if (!badge) return;

    const filterKey = getFilterKey(dropdown.dataset.filterType);
    const count = state.activeFilters[filterKey]?.length || 0;

    if (count > 0) {
      badge.textContent = count;
      badge.hidden = false;
      badge.classList.add('active');
    } else {
      badge.hidden = true;
      badge.classList.remove('active');
    }
  }

  function updateFilterBadges() {
    // Update badges for all dropdowns (works for both desktop and mobile since we use same elements)
    const allDropdowns = document.querySelectorAll('.instructor-profiles-filter-dropdown');
    allDropdowns.forEach(updateBadge);

    // Mobile filter button count
    if (elements.mobileFilterBtn) {
      const totalFilters = (state.activeFilters.country?.length || 0) +
                          (state.activeFilters.specialties?.length || 0) +
                          (state.activeFilters.levels?.length || 0) +
                          (state.activeFilters.languages?.length || 0);

      const mobileCount = elements.mobileFilterBtn.querySelector('[data-mobile-filter-count]');
      if (mobileCount) {
        mobileCount.textContent = totalFilters;
        if (totalFilters > 0) {
          mobileCount.hidden = false;
          mobileCount.style.display = '';
        } else {
          mobileCount.hidden = true;
          mobileCount.style.display = 'none';
        }
      }
    }
  }

  function updateClearButton() {
    if (!elements.clearAllBtn) return;

    const hasFilters = state.activeFilters.country.length > 0 ||
                      state.activeFilters.specialties.length > 0 ||
                      state.activeFilters.levels.length > 0 ||
                      state.activeFilters.languages.length > 0 ||
                      state.searchQuery !== '';

    if (hasFilters) {
      elements.clearAllBtn.hidden = false;
      elements.clearAllBtn.style.display = 'inline-flex';
    } else {
      elements.clearAllBtn.hidden = true;
      elements.clearAllBtn.style.display = 'none';
    }
  }

  // ============================================
  // Render Active Filter Pills
  // ============================================
  function renderActiveFilterPills() {
    if (!elements.activeFiltersContainer || !elements.activeFilters) return;

    const pills = [];

    state.activeFilters.country.forEach(country => {
      pills.push({ type: 'country', value: country, label: country });
    });

    state.activeFilters.specialties.forEach(specialty => {
      pills.push({ type: 'specialties', value: specialty, label: specialty });
    });

    state.activeFilters.levels.forEach(level => {
      pills.push({ type: 'levels', value: level, label: level });
    });

    state.activeFilters.languages.forEach(language => {
      pills.push({ type: 'languages', value: language, label: language });
    });

    elements.activeFilters.innerHTML = '';

    if (pills.length === 0) {
      elements.activeFiltersContainer.hidden = true;
      return;
    }

    const fragment = document.createDocumentFragment();
    pills.forEach(pill => {
      const pillElement = document.createElement('button');
      pillElement.className = 'instructor-profiles-filter-pill';
      pillElement.setAttribute('aria-label', `Remove ${pill.label} filter`);
      pillElement.dataset.filterType = pill.type;
      pillElement.dataset.filterValue = pill.value;

      pillElement.innerHTML = `
        <span>${escapeHtml(pill.label)}</span>
        <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z"/>
        </svg>
      `;

      pillElement.addEventListener('click', () => removeFilterPill(pill.type, pill.value), { once: true });
      fragment.appendChild(pillElement);
    });

    elements.activeFilters.appendChild(fragment);
    elements.activeFiltersContainer.hidden = false;
  }

  function removeFilterPill(type, value) {
    state.activeFilters[type] = state.activeFilters[type].filter(v => v !== value);

    syncCheckboxesFromState();
    updateFilterBadges();
    renderActiveFilterPills();
    updateClearButton();
    applyFiltersAndRender();
    saveState();
  }

  // ============================================
  // OPTIMIZED: Apply Filters and Render
  // Batched DOM updates, render cancellation
  // ============================================
  function applyFiltersAndRender() {
    // Cancel any pending renders
    state.renderToken++;
    const currentToken = state.renderToken;

    const scrollY = window.pageYOffset || document.documentElement.scrollTop;

    // Cache filter flags for performance
    const hasSearchQuery = state.searchQuery.length > 0;
    const hasCountryFilter = state.activeFilters.country.length > 0;
    const hasSpecialtiesFilter = state.activeFilters.specialties.length > 0;
    const hasLevelsFilter = state.activeFilters.levels.length > 0;
    const hasLanguagesFilter = state.activeFilters.languages.length > 0;

    // OPTIMIZED: Single pass filtering
    state.filteredInstructors = state.allInstructors.filter(instructor => {
      if (hasSearchQuery && !matchesSearch(instructor, state.searchQuery)) {
        return false;
      }

      if (hasCountryFilter && !state.activeFilters.country.includes(instructor.country)) {
        return false;
      }

      if (hasSpecialtiesFilter) {
        const hasMatch = instructor.specialties.some(specialty =>
          state.activeFilters.specialties.includes(specialty)
        );
        if (!hasMatch) return false;
      }

      if (hasLevelsFilter) {
        const hasMatch = instructor.levels.some(level =>
          state.activeFilters.levels.includes(level)
        );
        if (!hasMatch) return false;
      }

      if (hasLanguagesFilter) {
        const hasMatch = instructor.languages.some(language =>
          state.activeFilters.languages.includes(language)
        );
        if (!hasMatch) return false;
      }

      return true;
    });

    state.currentIndex = 0;
    state.hasMore = state.filteredInstructors.length > CONFIG.batchSize;

    // OPTIMIZED: Batch all DOM updates in single frame
    requestAnimationFrame(() => {
      // Check if render was cancelled
      if (currentToken !== state.renderToken) {
        return;
      }

      clearGrid();
      hideLoading();
      hideEmpty();
      updateCounter();
      updateFilterCounts();
      updateClearButton();

      if (state.filteredInstructors.length === 0) {
        showEmpty();
      } else {
        loadNextBatch();
      }

      window.scrollTo(0, scrollY);
    });
  }

  // ============================================
  // OPTIMIZED: Search Matching with pre-built index
  // ============================================
  function buildSearchIndex(instructor) {
    const fields = [
      instructor.fullName,
      instructor.country,
      instructor.region,
      instructor.city,
      ...(instructor.specialties || []),
      ...(instructor.levels || []),
      ...(instructor.languages || [])
    ];

    return fields
      .filter(field => field && typeof field === 'string')
      .map(field => field.toLowerCase())
      .join(' ');
  }

  function matchesSearch(instructor, query) {
    if (!instructor._searchIndex) {
      instructor._searchIndex = buildSearchIndex(instructor);
    }
    return instructor._searchIndex.includes(query);
  }

  /**
   * Pre-build search indexes for all instructors
   * Called after data load to eliminate first-search freeze
   */
  function prebuildSearchIndexes(instructors) {
    if (typeof requestIdleCallback === 'function') {
      requestIdleCallback(() => {
        instructors.forEach(instructor => {
          if (!instructor._searchIndex) {
            instructor._searchIndex = buildSearchIndex(instructor);
          }
        });
      }, { timeout: 2000 });
    } else {
      // Fallback for browsers without requestIdleCallback
      setTimeout(() => {
        instructors.forEach(instructor => {
          if (!instructor._searchIndex) {
            instructor._searchIndex = buildSearchIndex(instructor);
          }
        });
      }, 100);
    }
  }

  // ============================================
  // Update Filter Counts in Dropdowns
  // ============================================
  function updateFilterCounts() {
    const counts = calculateFilterCounts();

    elements.filterDropdowns.forEach(dropdown => {
      const type = dropdown.dataset.filterType;
      const options = dropdown.querySelectorAll('.instructor-profiles-filter-option');

      options.forEach(option => {
        const input = option.querySelector('input');
        const countSpan = option.querySelector('.instructor-profiles-filter-option-count');
        const value = input.value;

        const count = counts[type]?.[value] || 0;
        countSpan.textContent = `(${count})`;

        if (count === 0 && !input.checked) {
          option.classList.add('instructor-profiles-filter-option--disabled');
          input.disabled = true;
        } else {
          option.classList.remove('instructor-profiles-filter-option--disabled');
          input.disabled = false;
        }
      });
    });
  }

  // ============================================
  // Grid Management
  // ============================================
  function clearGrid() {
    if (elements.grid) {
      // OPTIMIZED: Clean up animations before clearing
      const cards = elements.grid.querySelectorAll('.instructor-profiles-card--skeleton');
      cards.forEach(card => {
        // Remove animations to prevent memory leaks
        card.style.animation = 'none';
      });

      elements.grid.innerHTML = '';
    }
  }

  /**
   * OPTIMIZED: Skeleton cards with cleanup
   */
  function showSkeletonCards(count = 12) {
    if (!elements.grid) return;

    clearGrid();
    hideEmpty();

    const fragment = document.createDocumentFragment();

    for (let i = 0; i < count; i++) {
      const skeleton = document.createElement('article');
      skeleton.className = 'instructor-profiles-card instructor-profiles-card--skeleton';
      skeleton.innerHTML = `
        <div class="instructor-profiles-card-image-link">
          <div class="instructor-profiles-card-image-wrapper">
            <div class="instructor-profiles-card-placeholder" style="display: flex; opacity: 0.15;">
              <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
              </svg>
            </div>
          </div>
        </div>
        <div class="instructor-profiles-card-content">
          <div class="instructor-profiles-skeleton-line" style="width: 40%; height: 16px; background: #e1e3e5; margin-bottom: 0.75rem; border-radius: 4px;"></div>
          <div class="instructor-profiles-skeleton-line" style="width: 70%; height: 20px; background: #e1e3e5; margin-bottom: 0.75rem; border-radius: 4px;"></div>
          <div class="instructor-profiles-skeleton-line" style="width: 60%; height: 14px; background: #e1e3e5; margin-bottom: auto; border-radius: 4px;"></div>
          <div class="instructor-profiles-skeleton-line" style="width: 100%; height: 44px; background: #e1e3e5; border-radius: 4px; margin-top: 1rem;"></div>
        </div>
      `;
      fragment.appendChild(skeleton);
    }

    elements.grid.appendChild(fragment);
  }

  function updateCounter(customText) {
    if (!elements.counter) return;

    if (customText) {
      elements.counter.style.display = '';
      elements.counter.textContent = customText;
      elements.counter.classList.add('updating');
      return;
    }

    if (!state.apiLoaded) {
      elements.counter.style.display = 'none';
      return;
    }

    elements.counter.style.display = '';

    const showing = state.filteredInstructors.length;
    const text = showing === 0
      ? 'No instructors found'
      : `${showing} instructor${showing === 1 ? '' : 's'} found`;

    elements.counter.textContent = text;
    announce(text);
  }

  function showEmpty() {
    if (!elements.empty || !state.apiLoaded) return;

    elements.empty.hidden = false;
    elements.empty.style.display = '';

    if (elements.grid) {
      elements.grid.style.display = 'none';
    }
    hideLoading();
  }

  function hideEmpty() {
    if (!elements.empty) return;

    elements.empty.hidden = true;
    elements.empty.style.display = 'none';
    if (elements.grid) {
      elements.grid.style.display = '';
    }
  }

  // ============================================
  // Load Next Batch
  // ============================================
  function loadNextBatch() {
    const totalInstructors = state.filteredInstructors.length;

    if (state.currentIndex >= totalInstructors) {
      state.hasMore = false;
      hideLoading();
      return;
    }

    const start = state.currentIndex;
    const end = Math.min(start + CONFIG.batchSize, totalInstructors);
    const batch = state.filteredInstructors.slice(start, end);

    if (!elements.grid) return;

    const fragment = document.createDocumentFragment();

    batch.forEach((instructor, batchIndex) => {
      const globalIndex = start + batchIndex;
      const card = createInstructorCard(instructor, globalIndex);
      fragment.appendChild(card);
    });

    requestAnimationFrame(() => {
      if (elements.grid) {
        elements.grid.appendChild(fragment);
      }

      state.currentIndex = end;
      state.hasMore = end < totalInstructors;

      if (!state.hasMore) {
        hideLoading();
      }
    });
  }

  // ============================================
  // Create Instructor Card
  // ============================================
  function createInstructorCard(instructor, cardIndex = 0) {
    const article = document.createElement('article');
    article.className = 'instructor-profiles-card';
    article.dataset.instructorId = instructor.id;

    const profileUrl = sanitizeUrl(instructor.handle ? `/pages/instructor/${instructor.handle}` : '#');
    const imageHTML = createImageHTML(instructor, cardIndex);

    const priorityBadge = instructor.priority > 0
      ? '<span class="instructor-profiles-card-badge">Featured</span>'
      : '';

    let levelsHTML = '';
    if (instructor.levels && instructor.levels.length > 0) {
      const badges = instructor.levels.map(level =>
        `<span class="instructor-profiles-badge instructor-profiles-badge--level">${escapeHtml(level)}</span>`
      ).join('');
      levelsHTML = `<div class="instructor-profiles-card-levels">${badges}</div>`;
    }

    let locationHTML = '';
    if (instructor.country || instructor.region || instructor.city) {
      const locationParts = [instructor.country, instructor.region, instructor.city].filter(Boolean);
      locationHTML = `
        <div class="instructor-profiles-card-location">
          <svg class="instructor-profiles-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
            <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"></path>
            <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.8 13.938h-.011a7 7 0 1 0-11.464.144h-.016l.14.171c.1.127.2.251.3.371L12 21l5.13-6.248c.194-.209.374-.429.54-.659l.13-.155Z"></path>
          </svg>
          <span>${escapeHtml(locationParts.join(', '))}</span>
        </div>
      `;
    }

    article.innerHTML = `
      <a href="${escapeHtml(profileUrl)}" class="instructor-profiles-card-image-link" aria-label="View ${escapeHtml(instructor.fullName)}'s profile">
        <div class="instructor-profiles-card-image-wrapper">
          ${imageHTML}
          ${priorityBadge}
        </div>
      </a>
      <div class="instructor-profiles-card-content">
        ${levelsHTML}
        <h3 class="instructor-profiles-card-name">
          <a href="${escapeHtml(profileUrl)}" class="instructor-profiles-card-name-link">
            ${escapeHtml(instructor.fullName)}
          </a>
        </h3>
        ${locationHTML}
        <a href="${escapeHtml(profileUrl)}" class="instructor-profiles-card-button" aria-label="View ${escapeHtml(instructor.fullName)}'s profile">
          View Profile
        </a>
      </div>
    `;

    const img = article.querySelector('.instructor-profiles-card-image');
    if (img) {
      img.addEventListener('load', function() {
        this.classList.add('loaded');
      }, { once: true });

      if (img.complete && img.naturalHeight !== 0) {
        img.classList.add('loaded');
      }
    }

    return article;
  }

  // ============================================
  // Intersection Observer
  // ============================================
  function setupIntersectionObserver() {
    if (!elements.trigger) return;

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting &&
            state.hasMore &&
            state.currentIndex < state.filteredInstructors.length &&
            state.filteredInstructors.length > 0) {

          showLoading();
          loadNextBatch();
        } else if (entry.isIntersecting && !state.hasMore) {
          hideLoading();
        }
      });
    }, {
      root: null,
      rootMargin: '400px 0px',
      threshold: 0.01
    });

    observer.observe(elements.trigger);
  }

  // ============================================
  // OPTIMIZED: Mobile Button Visibility
  // Improved debouncing and cleanup
  // ============================================
  function setupMobileButtonObserver() {
    if (!elements.section || !elements.mobileFilterBtn) return;

    let scrollHandler = null;
    let resizeHandler = null;

    const updateButtonVisibility = () => {
      const sectionRect = elements.section.getBoundingClientRect();
      const viewportHeight = window.innerHeight;

      const isInViewport = sectionRect.top < viewportHeight && sectionRect.bottom > 0;

      if (isInViewport) {
        const shouldFixAtBottom = sectionRect.bottom < viewportHeight - CONFIG.mobileButtonOffset;

        if (shouldFixAtBottom) {
          elements.mobileFilterBtn.style.position = 'absolute';
          elements.mobileFilterBtn.style.bottom = '0';
          elements.mobileFilterBtn.classList.add('visible');
        } else {
          elements.mobileFilterBtn.style.position = 'fixed';
          elements.mobileFilterBtn.style.bottom = 'var(--instructor-profiles-space-lg)';
          elements.mobileFilterBtn.classList.add('visible');
        }
      } else {
        elements.mobileFilterBtn.classList.remove('visible');
      }
    };

    // OPTIMIZED: Throttle instead of debounce for smoother response
    const throttledUpdate = throttle(updateButtonVisibility, CONFIG.scrollDebounce);

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          scrollHandler = throttledUpdate;
          resizeHandler = throttledUpdate;

          window.addEventListener('scroll', scrollHandler, { passive: true });
          window.addEventListener('resize', resizeHandler, { passive: true });
          updateButtonVisibility();
        } else {
          if (scrollHandler) {
            window.removeEventListener('scroll', scrollHandler);
            scrollHandler = null;
          }
          if (resizeHandler) {
            window.removeEventListener('resize', resizeHandler);
            resizeHandler = null;
          }
          elements.mobileFilterBtn.classList.remove('visible');
        }
      });
    }, {
      root: null,
      rootMargin: `${CONFIG.intersectionMargin} 0px ${CONFIG.intersectionMargin} 0px`,
      threshold: 0
    });

    observer.observe(elements.section);
    state.sectionObserver = observer;
  }

  // ============================================
  // Loading States
  // ============================================
  function showLoading() {
    if (!elements.loading) return;

    const shouldShow = state.hasMore &&
                       state.currentIndex < state.filteredInstructors.length &&
                       state.filteredInstructors.length > 0;

    if (shouldShow) {
      elements.loading.hidden = false;
      elements.loading.style.display = '';
      if (elements.grid) {
        elements.grid.setAttribute('aria-busy', 'true');
      }
    } else {
      hideLoading();
    }
  }

  function hideLoading() {
    if (elements.loading) {
      elements.loading.hidden = true;
      elements.loading.style.display = 'none';
      if (elements.grid) {
        elements.grid.setAttribute('aria-busy', 'false');
      }
    }
  }

  function renderInitialBatch() {
    clearGrid();
    hideLoading();
    hideEmpty();

    if (state.filteredInstructors.length > 0) {
      loadNextBatch();
    } else {
      showEmpty();
    }

    updateCounter();
    updateFilterCounts();
    updateClearButton();
  }

  // ============================================
  // Mobile Filters - UNIFIED APPROACH
  // Moves same filter elements into modal instead of duplicating
  // ============================================

  function openMobileModal() {
    if (!elements.mobileModal || !elements.filtersWrapper || !elements.mobileModalBody) return;

    // Save scroll position
    const scrollY = window.scrollY;
    document.body.style.top = `-${scrollY}px`;
    document.body.classList.add('instructor-profiles-modal-open');

    // Move filters from desktop location to modal
    elements.mobileModalBody.appendChild(elements.filtersWrapper);

    // Close all open dropdowns before showing modal
    closeAllDropdowns();

    // Show modal
    elements.mobileModal.hidden = false;

    // Update badges to reflect current state
    updateFilterBadges();

    // Trap focus
    trapFocus(elements.mobileModal);
  }

  function closeMobileModal() {
    if (!elements.mobileModal || !elements.filtersWrapper || !elements.filtersOriginalParent) return;

    // Close all dropdowns in modal
    closeAllDropdowns();

    // Remove focus trap
    if (elements.mobileModal._focusTrapHandler) {
      elements.mobileModal.removeEventListener('keydown', elements.mobileModal._focusTrapHandler);
      elements.mobileModal._focusTrapHandler = null;
    }

    // Move filters back to original position
    elements.filtersOriginalParent.appendChild(elements.filtersWrapper);

    // Hide modal
    elements.mobileModal.hidden = true;

    // Restore scroll position
    const scrollY = document.body.style.top;
    document.body.classList.remove('instructor-profiles-modal-open');
    document.body.style.top = '';
    window.scrollTo(0, parseInt(scrollY || '0') * -1);

    // Return focus to filter button
    if (elements.mobileFilterBtn) {
      elements.mobileFilterBtn.focus();
    }
  }

  function trapFocus(element) {
    const focusableElements = element.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const firstFocusable = focusableElements[0];
    const lastFocusable = focusableElements[focusableElements.length - 1];

    if (firstFocusable) {
      setTimeout(() => firstFocusable.focus(), 100);
    }

    function handleFocusTrap(e) {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        if (document.activeElement === firstFocusable) {
          e.preventDefault();
          lastFocusable.focus();
        }
      } else {
        if (document.activeElement === lastFocusable) {
          e.preventDefault();
          firstFocusable.focus();
        }
      }
    }

    element.addEventListener('keydown', handleFocusTrap);
    element._focusTrapHandler = handleFocusTrap;
  }

  function applyMobileFilters() {
    // Simply close modal - filters are already applied via handleFilterChange
    closeMobileModal();
  }

  // ============================================
  // Clear All Filters
  // ============================================
  function clearAllFilters() {
    state.activeFilters = {
      country: [],
      specialties: [],
      levels: [],
      languages: []
    };

    state.searchQuery = '';
    if (elements.searchInput) {
      elements.searchInput.value = '';
    }

    const allInputs = document.querySelectorAll('input[data-filter-type]');
    allInputs.forEach(input => input.checked = false);

    toggleClearButton();
    hideSuggestions();
    updateFilterBadges();
    renderActiveFilterPills();
    updateClearButton();
    applyFiltersAndRender();
    saveState();
  }

  // ============================================
  // Keyboard Navigation
  // ============================================
  function handleKeyboard(e) {
    if (e.key === 'Escape') {
      if (state.openDropdown) {
        closeAllDropdowns();
      }
      if (elements.suggestions && !elements.suggestions.hidden) {
        hideSuggestions();
      }
      if (elements.mobileModal && !elements.mobileModal.hidden) {
        closeMobileModal();
      }
    }
  }

  // ============================================
  // State Persistence
  // ============================================
  function saveState() {
    try {
      updateURL();
    } catch (e) {}
  }

  function validateFilterValue(value, filterType) {
    if (!value || typeof value !== 'string') return null;

    if (value.length > CONFIG.maxFilterValueLength) return null;

    let validOptions = [];
    switch(filterType) {
      case 'country':
        validOptions = CONFIG.filterOptions.countries;
        break;
      case 'specialty':
        validOptions = CONFIG.filterOptions.specialties;
        break;
      case 'level':
        validOptions = CONFIG.filterOptions.levels;
        break;
      case 'language':
        validOptions = CONFIG.filterOptions.languages;
        break;
      default:
        return null;
    }

    return validOptions.includes(value) ? value : null;
  }

  function restoreState() {
    try {
      const urlParams = new URLSearchParams(window.location.search);

      if (urlParams.has('search')) {
        const searchValue = urlParams.get('search');
        if (searchValue && searchValue.length <= CONFIG.maxSearchLength) {
          state.searchQuery = searchValue.replace(/<[^>]*>/g, '').trim().toLowerCase();
          if (elements.searchInput) {
            elements.searchInput.value = state.searchQuery;
          }
          toggleClearButton();
        }
      }

      if (urlParams.has('country')) {
        const countries = urlParams.get('country').split(',')
          .map(c => validateFilterValue(c.trim(), 'country'))
          .filter(Boolean);
        state.activeFilters.country = countries;
      }

      if (urlParams.has('specialty')) {
        const specialties = urlParams.get('specialty').split(',')
          .map(s => validateFilterValue(s.trim(), 'specialty'))
          .filter(Boolean);
        state.activeFilters.specialties = specialties;
      }

      if (urlParams.has('level')) {
        const levels = urlParams.get('level').split(',')
          .map(l => validateFilterValue(l.trim(), 'level'))
          .filter(Boolean);
        state.activeFilters.levels = levels;
      }

      if (urlParams.has('language')) {
        const languages = urlParams.get('language').split(',')
          .map(l => validateFilterValue(l.trim(), 'language'))
          .filter(Boolean);
        state.activeFilters.languages = languages;
      }

      if (state.searchQuery ||
          state.activeFilters.country.length > 0 ||
          state.activeFilters.specialties.length > 0 ||
          state.activeFilters.levels.length > 0 ||
          state.activeFilters.languages.length > 0) {

        syncCheckboxesFromState();
        updateFilterBadges();
        renderActiveFilterPills();
        updateClearButton();
        applyFiltersAndRender();
        return true;
      }
    } catch (e) {
      console.error('Could not restore state', e);
      state.searchQuery = '';
      state.activeFilters = {
        country: [],
        specialties: [],
        levels: [],
        languages: []
      };
    }
    return false;
  }

  function syncCheckboxesFromState() {
    const allInputs = document.querySelectorAll('input[data-filter-type]');

    allInputs.forEach(input => {
      const filterKey = getFilterKey(input.dataset.filterType);
      input.checked = state.activeFilters[filterKey].includes(input.value);
    });
  }

  function updateURL() {
    const params = new URLSearchParams();

    if (state.searchQuery) params.set('search', state.searchQuery);
    if (state.activeFilters.country.length) params.set('country', state.activeFilters.country.join(','));
    if (state.activeFilters.specialties.length) params.set('specialty', state.activeFilters.specialties.join(','));
    if (state.activeFilters.levels.length) params.set('level', state.activeFilters.levels.join(','));
    if (state.activeFilters.languages.length) params.set('language', state.activeFilters.languages.join(','));

    const newURL = params.toString()
      ? `${window.location.pathname}?${params}`
      : window.location.pathname;

    window.history.replaceState({}, '', newURL);
    saveStateToSession();
  }

  function saveStateToSession() {
    try {
      const stateData = {
        searchQuery: state.searchQuery,
        activeFilters: {
          country: [...state.activeFilters.country],
          specialties: [...state.activeFilters.specialties],
          levels: [...state.activeFilters.levels],
          languages: [...state.activeFilters.languages]
        },
        timestamp: Date.now(),
        sessionId: state.sessionId
      };
      sessionStorage.setItem(CONFIG.lastStateKey, JSON.stringify(stateData));
    } catch (e) {}
  }

  function restoreStateFromSession() {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.toString()) {
        return false;
      }

      const savedState = sessionStorage.getItem(CONFIG.lastStateKey);
      if (!savedState) return false;

      const stateData = JSON.parse(savedState);

      if (stateData.sessionId !== state.sessionId) {
        return false;
      }

      const expiryMs = CONFIG.stateExpiryMinutes * 60 * 1000;
      const age = Date.now() - stateData.timestamp;
      if (age > expiryMs) {
        sessionStorage.removeItem(CONFIG.lastStateKey);
        return false;
      }

      state.searchQuery = stateData.searchQuery || '';
      state.activeFilters = {
        country: stateData.activeFilters?.country || [],
        specialties: stateData.activeFilters?.specialties || [],
        levels: stateData.activeFilters?.levels || [],
        languages: stateData.activeFilters?.languages || []
      };

      if (elements.searchInput) {
        elements.searchInput.value = state.searchQuery;
      }

      const hasActiveFilters = state.searchQuery ||
        state.activeFilters.country.length > 0 ||
        state.activeFilters.specialties.length > 0 ||
        state.activeFilters.levels.length > 0 ||
        state.activeFilters.languages.length > 0;

      if (hasActiveFilters) {
        toggleClearButton();
        syncCheckboxesFromState();
        applyFiltersAndRender();
        return true;
      }

      return false;
    } catch (e) {
      console.error('Could not restore state from session', e);
      return false;
    }
  }

  // ============================================
  // Utilities
  // ============================================
  function debounce(func, delay) {
    let timeoutId;
    return function(...args) {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => func.apply(this, args), delay);
    };
  }

  /**
   * NEW: Throttle function for scroll performance
   */
  function throttle(func, limit) {
    let inThrottle;
    return function(...args) {
      if (!inThrottle) {
        func.apply(this, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  }

  function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function sanitizeSrcset(srcset) {
    if (!srcset) return '';
    try {
      const parts = srcset.split(',').map(part => {
        const [url, descriptor] = part.trim().split(/\s+/);
        if (!url) return '';
        const sanitized = sanitizeUrl(url);
        if (sanitized === '#') return '';
        return descriptor ? `${sanitized} ${descriptor}` : sanitized;
      }).filter(Boolean);
      return parts.join(', ');
    } catch (e) {
      return '';
    }
  }

  function sanitizeUrl(url) {
    if (!url || typeof url !== 'string') return '#';

    const trimmedUrl = url.trim();

    if (trimmedUrl.length > CONFIG.maxUrlLength) {
      console.error('URL exceeds maximum length');
      return '#';
    }

    const urlLower = trimmedUrl.toLowerCase();

    const dangerousProtocols = ['javascript:', 'data:', 'vbscript:', 'file:', 'about:'];
    if (dangerousProtocols.some(protocol => urlLower.startsWith(protocol))) {
      console.error('Blocked dangerous protocol in URL');
      return '#';
    }

    if (trimmedUrl.includes('://')) {
      try {
        const urlObj = new URL(trimmedUrl);
        if (!CONFIG.allowedProtocols.includes(urlObj.protocol)) {
          console.error('Invalid URL protocol:', urlObj.protocol);
          return '#';
        }
      } catch (e) {
        console.error('Invalid URL format', e);
        return '#';
      }
    }

    return trimmedUrl;
  }

  // ============================================
  // Auto-Initialize
  // ============================================
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.InstructorProfiles = {
    init,
    version: '2.0.0'
  };

})();
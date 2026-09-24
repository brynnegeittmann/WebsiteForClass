document.addEventListener('DOMContentLoaded', function () {
    const modalElement = document.getElementById('exampleModal');
    const modal = new bootstrap.Modal(modalElement);
    const modalTitle = document.getElementById('exampleModalLabel');
    const eventForm = document.getElementById('event_form');
    const saveEventBtn = document.getElementById('save_event_btn');

    const weekdayContainers = {
        'Sunday': document.getElementById('sunday_events'),
        'Monday': document.getElementById('monday_events'),
        'Tuesday': document.getElementById('tuesday_events'),
        'Wednesday': document.getElementById('wednesday_events'),
        'Thursday': document.getElementById('thursday_events'),
        'Friday': document.getElementById('friday_events'),
        'Saturday': document.getElementById('saturday_events'),
    };
    const weekdayNames = Object.keys(weekdayContainers);

    // Category -> colors (background, accent border, text)
    const categoryColors = {
        'Academic': { bg: '#dbeafe', border: '#2563eb', text: '#1e3a8a' },
        'Social':   { bg: '#dcfce7', border: '#16a34a', text: '#14532d' },
        'Work':     { bg: '#ffedd5', border: '#ea580c', text: '#7c2d12' },
        'Personal': { bg: '#f3e8ff', border: '#9333ea', text: '#581c87' },
    };
    const defaultColors = { bg: '#f1f5f9', border: '#64748b', text: '#1e293b' };

    // null = creating a new event; otherwise the id of the event being edited
    let editingId = null;

    // ---------- Modality fields ----------
    const modalitySelect = document.getElementById('event_modality');
    const locationGroup = document.getElementById('location_group');
    const remoteUrlGroup = document.getElementById('remote_url_group');

    function updateModalityFields() {
        if (modalitySelect.value === 'Remote') {
            locationGroup.style.display = 'none';
            remoteUrlGroup.style.display = 'block';
        } else {
            locationGroup.style.display = 'block';
            remoteUrlGroup.style.display = 'none';
        }
    }
    modalitySelect.addEventListener('change', updateModalityFields);

    // ---------- Storage helpers ----------
    function makeId() {
        return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    }

    function pad(n) { return String(n).padStart(2, '0'); }

    function toDateInputValue(d) {
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    }

    // Date (this week) for a weekday name, used for older events saved without a date
    function dateForWeekday(name) {
        const today = new Date();
        const diff = weekdayNames.indexOf(name) - today.getDay();
        return toDateInputValue(new Date(today.getFullYear(), today.getMonth(), today.getDate() + diff));
    }

    function getEvents() {
        try {
            return JSON.parse(localStorage.getItem('events')) || [];
        } catch (e) {
            return [];
        }
    }

    function setEvents(events) {
        localStorage.setItem('events', JSON.stringify(events));
    }

    // Give events saved by the previous version an id and a date
    function migrateEvents() {
        const events = getEvents();
        let changed = false;
        events.forEach(evt => {
            if (!evt.id) { evt.id = makeId(); changed = true; }
            if (!evt.date) { evt.date = dateForWeekday(evt.weekday); changed = true; }
        });
        if (changed) setEvents(events);
    }

    // ---------- Rendering ----------
    function escapeHtml(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function formatTime(time24) {
        const [h, m] = time24.split(':').map(Number);
        const suffix = h >= 12 ? 'PM' : 'AM';
        const hour12 = h % 12 || 12;
        return `${hour12}:${pad(m)} ${suffix}`;
    }

    function renderAllEvents() {
        Object.values(weekdayContainers).forEach(c => { if (c) c.innerHTML = ''; });

        getEvents()
            .sort((a, b) => a.time.localeCompare(b.time))
            .forEach(renderEvent);
    }

    function renderEvent(evt) {
        const container = weekdayContainers[evt.weekday];
        if (!container) return;

        const colors = categoryColors[evt.category] || defaultColors;

        const el = document.createElement('div');
        el.className = 'event p-2 mb-2 rounded';
        el.dataset.id = evt.id;
        el.dataset.category = evt.category;
        el.title = 'Click to edit';
        el.style.cursor = 'pointer';
        el.style.backgroundColor = colors.bg;
        el.style.color = colors.text;
        el.style.borderLeft = `4px solid ${colors.border}`;

        let safeUrl = null;
        if (evt.remoteUrl && /^https?:\/\//i.test(evt.remoteUrl)) {
            safeUrl = escapeHtml(evt.remoteUrl);
        }

        el.innerHTML = `
            <strong>${formatTime(evt.time)}</strong> - ${escapeHtml(evt.name)} (${escapeHtml(evt.category)})
            ${evt.location ? `<br><small>📍 ${escapeHtml(evt.location)}</small>` : ''}
            ${safeUrl ? `<br><small>🔗 <a href="${safeUrl}" target="_blank" rel="noopener noreferrer">Join</a></small>` : ''}
            ${evt.attendees ? `<br><small>👥 ${escapeHtml(evt.attendees)}</small>` : ''}
        `;

        // Click an event to edit it (clicking the "Join" link just follows the link)
        el.addEventListener('click', function (e) {
            if (e.target.closest('a')) return;
            openEditModal(evt.id);
        });

        container.appendChild(el);
    }

    // ---------- Edit mode ----------
    function openEditModal(id) {
        const evt = getEvents().find(x => x.id === id);
        if (!evt) return;

        editingId = id;
        modalTitle.textContent = 'Edit Event';
        saveEventBtn.textContent = 'Update event';

        document.getElementById('event_name').value = evt.name;
        document.getElementById('event_category').value = evt.category;
        document.getElementById('event_weekday').value = evt.date;
        document.getElementById('event_time').value = evt.time;
        modalitySelect.value = evt.modality;
        document.getElementById('event_location').value = evt.location || '';
        document.getElementById('event_remote_url').value = evt.remoteUrl || '';
        document.getElementById('event_attendees').value = evt.attendees || '';
        updateModalityFields();

        modal.show();
    }

    // Whenever the modal closes, go back to "create" mode with a clean form
    modalElement.addEventListener('hidden.bs.modal', function () {
        editingId = null;
        modalTitle.textContent = 'New Event';
        saveEventBtn.textContent = 'Save changes';
        eventForm.reset();
        updateModalityFields();
    });

    // ---------- Save / update handler ----------
    saveEventBtn.addEventListener('click', function (e) {
        e.preventDefault();

        const eventName = document.getElementById('event_name').value.trim();
        const eventCategory = document.getElementById('event_category').value;
        const eventDateInput = document.getElementById('event_weekday').value;
        const eventTime = document.getElementById('event_time').value;
        const eventModality = modalitySelect.value;
        const eventLocation = document.getElementById('event_location').value.trim() || null;
        const eventRemoteUrl = document.getElementById('event_remote_url').value.trim() || null;
        const eventAttendees = document.getElementById('event_attendees').value.trim() || null;

        if (!eventName || !eventCategory || !eventDateInput || !eventTime || !eventModality) {
            alert('Please fill in all required fields.');
            return;
        }

        // Parse as LOCAL time (new Date("YYYY-MM-DD") is UTC and shifts the weekday)
        const [year, month, day] = eventDateInput.split('-').map(Number);
        const eventWeekday = weekdayNames[new Date(year, month - 1, day).getDay()];

        const updated = {
            id: editingId || makeId(),
            name: eventName,
            category: eventCategory,
            date: eventDateInput,
            weekday: eventWeekday,
            time: eventTime,
            modality: eventModality,
            location: eventModality === 'In Person' ? eventLocation : null,
            remoteUrl: eventModality === 'Remote' ? eventRemoteUrl : null,
            attendees: eventAttendees,
        };

        const events = getEvents();
        if (editingId) {
            const idx = events.findIndex(x => x.id === editingId);
            if (idx !== -1) events[idx] = updated; else events.push(updated);
        } else {
            events.push(updated);
        }
        setEvents(events);
        renderAllEvents();

        modal.hide(); // the hidden.bs.modal handler resets the form and mode
    });

    // Load saved events on page load
    migrateEvents();
    renderAllEvents();
});

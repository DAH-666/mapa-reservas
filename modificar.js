// =====================================================================
// SCRIPT PARA LA PÁGINA DE MODIFICACIÓN DE RESERVAS
// =====================================================================

const GAS_WEBAPP_URL = 'https://script.google.com/macros/s/AKfycbxdo2VYgXk9dnPg0G1A3tp1K-b2EdK-kJBsTBcK8Gm6LJCBxdZPb613N-Ee8vXq4bnQ1w/exec';

document.addEventListener('DOMContentLoaded', () => {
    // --- OBTENER ELEMENTOS DEL DOM ---
    const loadingSection = document.getElementById('loadingSection');
    const modificationForm = document.getElementById('modificationForm');
    const statusMessage = document.getElementById('statusMessage');
    const submitBtn = document.getElementById('submitBtn');
    
    // Inputs del formulario
    const eventIdsInput = document.getElementById('eventIds');
    const artistNameInput = document.getElementById('artistName');
    const companySelect = document.getElementById('companySelect'); 
    const pmEmailInput = document.getElementById('pmEmail');
    const pmEmailContainer = document.getElementById('pmEmailContainer');
    const studioSelect = document.getElementById('studioSelect');
    const bookingDateInput = document.getElementById('bookingDate');
    const timeStartInput = document.getElementById('timeStart');
    const timeEndInput = document.getElementById('timeEnd');

    // --- 0. FUNCIÓN PARA CARGAR COMPAÑÍAS PERMITIDAS ---
    function filterCompaniesByEmail(email) {
        companySelect.innerHTML = '<option value="" disabled selected>Selecciona una compañía...</option>';

        const allCompanies = [
            { name: 'Rimas PR', group: '@rimasmusic' },
            { name: 'Rimas EU', group: '@rimasmusic' },
            { name: 'Rimas MX', group: '@rimasmusic' },
            { name: 'Sonar', group: '@rimasmusic' },
            { name: 'Melodías Internacional', group: '@melodias' },
            { name: 'Melodías España', group: '@melodias' },
            { name: 'Dale Play', group: 'all' }
        ];

        let allowed = [];
        const userEmail = (email || '').toLowerCase();
        
        if (userEmail.includes('@mapastudios')) {
            allowed = allCompanies; 
        } else if (userEmail.includes('@rimasmusic')) {
            allowed = allCompanies.filter(c => c.group === '@rimasmusic');
        } else if (userEmail.includes('@melodias')) {
            allowed = allCompanies.filter(c => c.group === '@melodias');
        } else {
            allowed = allCompanies; 
        }

        allowed.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c.name;
            opt.textContent = c.name;
            companySelect.appendChild(opt);
        });
    }

    pmEmailInput.addEventListener('change', (e) => {
        filterCompaniesByEmail(e.target.value);
    });

    // --- 1. CARGAR DATOS DEL EVENTO ---
    const urlParams = new URLSearchParams(window.location.search);
    const idsToModify = urlParams.get('ids') || urlParams.get('modify');
    const pmEmailParam = urlParams.get('pm');

    if (!idsToModify) {
        showError('No se ha especificado un ID de evento para modificar.');
        return;
    }

    let currentEmail = '';
    if (pmEmailParam) {
        pmEmailInput.value = pmEmailParam;
        currentEmail = pmEmailParam;
    } else {
        pmEmailContainer.classList.remove('hidden');
        pmEmailInput.required = true;
    }

    filterCompaniesByEmail(currentEmail);
    eventIdsInput.value = idsToModify;

    const fetchUrl = `${GAS_WEBAPP_URL}?action=getEventDetails&ids=${idsToModify}`;
    
    fetch(fetchUrl)
        .then(response => response.json())
        .then(data => {
            if (data.status === 'error') throw new Error(data.message);
            
            artistNameInput.value = data.artist || '';
            
            let optionExists = Array.from(companySelect.options).some(opt => opt.value === data.company);
            if (!optionExists && data.company) {
                const opt = document.createElement('option');
                opt.value = data.company;
                opt.textContent = data.company;
                companySelect.appendChild(opt);
            }
            companySelect.value = data.company || ''; 
            
            studioSelect.value = data.location || '';
            bookingDateInput.value = data.date || '';
            timeStartInput.value = data.timeStart || '';
            timeEndInput.value = data.timeEnd || '';
            
            loadingSection.classList.add('hidden');
            modificationForm.classList.remove('hidden');
        })
        .catch(error => {
            showError(`No se pudieron cargar los detalles: ${error.message}`);
        });

    // --- 2. MANEJAR EL ENVÍO DEL FORMULARIO ---
    modificationForm.addEventListener('submit', function(e) {
        e.preventDefault();

        submitBtn.disabled = true;
        submitBtn.innerHTML = `<span class="loader-spinner"></span> Guardando cambios...`;
        
        // LÓGICA INTELIGENTE DE MEDIANOCHE
        const startDateTimeObj = new Date(`${bookingDateInput.value}T${timeStartInput.value}:00`);
        const endDateTimeObj = new Date(`${bookingDateInput.value}T${timeEndInput.value}:00`);
        
        if (timeEndInput.value < timeStartInput.value) {
            endDateTimeObj.setDate(endDateTimeObj.getDate() + 1);
        }

        const newEventData = {
            summary: `${artistNameInput.value} - ${companySelect.value}`,
            location: studioSelect.value,
            // AQUÍ AÑADIMOS EL CORREO A LA DESCRIPCIÓN
            description: `(Reserva modificada desde StudioFlow por ${pmEmailInput.value})`,
            start: { dateTime: startDateTimeObj.toISOString() },
            end: { dateTime: endDateTimeObj.toISOString() }
        };

        const payload = {
            oldIds: eventIdsInput.value, 
            pmEmail: pmEmailInput.value, 
            events: [newEventData]      
        };

        fetch(GAS_WEBAPP_URL, {
            method: 'POST',
            mode: 'no-cors', 
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        })
        .then(() => {
            showStatus('success', '¡Reserva modificada con éxito! Se ha enviado un nuevo correo de confirmación.');
            submitBtn.innerHTML = '¡Cambios Guardados!';
            submitBtn.classList.replace('bg-indigo-600', 'bg-emerald-600');
        })
        .catch(error => {
            showStatus('error', `Ocurrió un error al guardar los cambios.`);
            submitBtn.disabled = false;
            submitBtn.innerHTML = 'Guardar Cambios';
        });
    });

    // --- FUNCIONES DE AYUDA ---
    function showError(message) {
        loadingSection.innerHTML = `
            <div class="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400">
                <h3 class="font-bold">Error</h3>
                <p>${message}</p>
                <a href="index.html" class="text-white underline mt-2 inline-block">Volver al portal</a>
            </div>`;
    }
    
    function showStatus(type, htmlContent) {
        statusMessage.classList.remove('hidden');
        statusMessage.className = 'rounded-lg p-4 text-sm font-medium text-center border'; 
        if (type === 'success') {
            statusMessage.classList.add('bg-emerald-500/10', 'text-emerald-400', 'border-emerald-500/20');
        } else { 
            statusMessage.classList.add('bg-red-500/10', 'text-red-400', 'border-red-500/20');
        }
        statusMessage.innerHTML = htmlContent;
    }
});

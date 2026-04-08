// =====================================================================
// SCRIPT PARA EL PORTAL DE APROBACIONES DEL ESTUDIO
// =====================================================================

const GAS_WEBAPP_URL = 'https://script.google.com/macros/s/AKfycbxdo2VYgXk9dnPg0G1A3tp1K-b2EdK-kJBsTBcK8Gm6LJCBxdZPb613N-Ee8vXq4bnQ1w/exec';

document.addEventListener('DOMContentLoaded', () => {
    // Referencias al DOM
    const loadingSection = document.getElementById('loadingSection');
    const approvalForm = document.getElementById('approvalForm');
    const statusMessage = document.getElementById('statusMessage');
    const approveBtn = document.getElementById('approveBtn');
    const rejectBtn = document.getElementById('rejectBtn');
    const actionButtons = document.getElementById('actionButtons');
    
    // Inputs del formulario
    const artistNameInput = document.getElementById('artistName');
    const companySelect = document.getElementById('companySelect'); 
    const studioSelect = document.getElementById('studioSelect');
    const bookingDateInput = document.getElementById('bookingDate');
    const timeStartInput = document.getElementById('timeStart');
    const timeEndInput = document.getElementById('timeEnd');
    const pmEmailInput = document.getElementById('pmEmail');

    // Extraer el token de seguridad de la URL
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');

    if (!token) {
        showError('No se ha encontrado el token de aprobación en la URL. El enlace puede estar roto o caducado.');
        return;
    }

    // --- 1. CARGAR DATOS PENDIENTES ---
    fetch(`${GAS_WEBAPP_URL}?action=getSessionData&token=${token}`)
        .then(response => response.json())
        .then(data => {
            if (data.status === 'error') throw new Error(data.message);
            
            // Rellenar formulario con los datos que pidió el PM
            artistNameInput.value = data.artistName || '';
            companySelect.value = data.company || ''; 
            studioSelect.value = data.studio || '';
            bookingDateInput.value = data.bookingDate || '';
            timeStartInput.value = data.timeStart || '';
            timeEndInput.value = data.timeEnd || '';
            pmEmailInput.value = data.pmEmail || '';
            
            // Mostrar interfaz
            loadingSection.classList.add('hidden');
            approvalForm.classList.remove('hidden');
        })
        .catch(error => {
            showError(`Aviso: ${error.message}`);
        });

    // --- 2. GESTIONAR CLICS EN BOTONES ---
    function sendStatusUpdate(statusAction) {
        // Bloquear botones
        approveBtn.disabled = true;
        rejectBtn.disabled = true;
        actionButtons.classList.add('opacity-50', 'pointer-events-none');

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
            description: `(Reserva solicitada por ${pmEmailInput.value} y aprobada vía StudioFlow)`,
            start: { dateTime: startDateTimeObj.toISOString() },
            end: { dateTime: endDateTimeObj.toISOString() }
        };

        const payload = {
            action: 'updateSessionStatus',
            token: token,
            status: statusAction, // 'approve' o 'reject'
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
            actionButtons.classList.add('hidden');
            if(statusAction === 'approve') {
                showStatus('success', '¡Aprobada! La sesión se ha añadido al calendario y el PM ha sido notificado.');
            } else {
                showStatus('success', 'Rechazada. La solicitud se ha eliminado y se ha notificado al PM.');
            }
        })
        .catch(error => {
            showStatus('error', 'Error de conexión. Intenta de nuevo.');
            actionButtons.classList.remove('opacity-50', 'pointer-events-none');
            approveBtn.disabled = false;
            rejectBtn.disabled = false;
        });
    }

    // Asignar eventos a los botones
    approveBtn.addEventListener('click', () => sendStatusUpdate('approve'));
    rejectBtn.addEventListener('click', () => sendStatusUpdate('reject'));

    // --- FUNCIONES DE AYUDA ---
    function showError(message) {
        loadingSection.innerHTML = `
            <div class="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg text-yellow-500">
                <i class="fa-solid fa-triangle-exclamation mb-2 text-2xl"></i>
                <p>${message}</p>
            </div>`;
    }
    
    function showStatus(type, htmlContent) {
        statusMessage.classList.remove('hidden');
        statusMessage.className = 'rounded-lg p-4 text-sm font-medium text-center border'; 
        if (type === 'success') {
            statusMessage.classList.add('bg-emerald-500/10', 'text-emerald-400', 'border-emerald-500/20');
            statusMessage.innerHTML = `<i class="fa-solid fa-check-circle mr-2"></i> ${htmlContent}`;
        } else { 
            statusMessage.classList.add('bg-red-500/10', 'text-red-400', 'border-red-500/20');
            statusMessage.innerHTML = `<i class="fa-solid fa-triangle-exclamation mr-2"></i> ${htmlContent}`;
        }
    }
});

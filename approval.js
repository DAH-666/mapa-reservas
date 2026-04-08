// =====================================================================
// SCRIPT PARA EL PORTAL DE APROBACIONES DEL ESTUDIO
// =====================================================================

const GAS_WEBAPP_URL = 'https://script.google.com/macros/s/AKfycbxdo2VYgXk9dnPg0G1A3tp1K-b2EdK-kJBsTBcK8Gm6LJCBxdZPb613N-Ee8vXq4bnQ1w/exec';

document.addEventListener('DOMContentLoaded', () => {
    const loadingSection = document.getElementById('loadingSection');
    const approvalForm = document.getElementById('approvalForm');
    const statusMessage = document.getElementById('statusMessage');
    const approveBtn = document.getElementById('approveBtn');
    const rejectBtn = document.getElementById('rejectBtn');
    const actionButtons = document.getElementById('actionButtons');
    
    const artistNameInput = document.getElementById('artistName');
    const companySelect = document.getElementById('companySelect'); 
    const studioSelect = document.getElementById('studioSelect');
    const bookingDateInput = document.getElementById('bookingDate');
    const timeStartInput = document.getElementById('timeStart');
    const timeEndInput = document.getElementById('timeEnd');
    const pmEmailInput = document.getElementById('pmEmail');

    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');

    if (!token) {
        showError('No se ha encontrado el token de aprobación en la URL. El enlace puede estar roto o caducado.');
        return;
    }

    fetch(`${GAS_WEBAPP_URL}?action=getSessionData&token=${token}`)
        .then(response => response.json())
        .then(data => {
            if (data.status === 'error') throw new Error(data.message);
            
            artistNameInput.value = data.artistName || '';
            companySelect.value = data.company || ''; 
            studioSelect.value = data.studio || '';
            bookingDateInput.value = data.bookingDate || '';
            timeStartInput.value = data.timeStart || '';
            timeEndInput.value = data.timeEnd || '';
            pmEmailInput.value = data.pmEmail || '';
            
            loadingSection.classList.add('hidden');
            approvalForm.classList.remove('hidden');
        })
        .catch(error => {
            showError(`Aviso: ${error.message}`);
        });

    function sendStatusUpdate(statusAction) {
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

    approveBtn.addEventListener('click', () => sendStatusUpdate('approve'));
    rejectBtn.addEventListener('click', () => sendStatusUpdate('reject'));

    function showError(message) {
        loadingSection.innerHTML = `
            <div class="p-4 bg-yellow-50 border border-yellow-300 rounded-lg text-yellow-700">
                <i class="fa-solid fa-triangle-exclamation mb-2 text-2xl"></i>
                <p>${message}</p>
            </div>`;
    }
    
    function showStatus(type, htmlContent) {
        statusMessage.classList.remove('hidden', 'bg-emerald-50', 'text-emerald-600', 'border-emerald-300', 'bg-red-50', 'text-red-600', 'border-red-300');
        statusMessage.className = 'rounded-lg p-4 text-sm font-bold text-center border'; 
        if (type === 'success') {
            statusMessage.classList.add('bg-emerald-50', 'text-emerald-600', 'border-emerald-300');
            statusMessage.innerHTML = `<i class="fa-solid fa-check-circle mr-2"></i> ${htmlContent}`;
        } else { 
            statusMessage.classList.add('bg-red-50', 'text-red-600', 'border-red-300');
            statusMessage.innerHTML = `<i class="fa-solid fa-triangle-exclamation mr-2"></i> ${htmlContent}`;
        }
    }
});

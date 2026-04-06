// =====================================================================
// SCRIPT PARA LA PÁGINA DE MODIFICACIÓN DE RESERVAS
// =====================================================================

// ⚠️ ¡ATENCIÓN! Reemplaza esta URL por la URL de tu Web App de Google Apps Script.
// Es la misma que usas en el script.js principal.
const GAS_WEBAPP_URL = 'https://script.google.com/macros/s/AKfycbzQmOhatLIpy7Ibnf0CUUEC6k9Xl0O-Y8A4_sbkPSOp0tmQ-NxaBNXcZ_jNbWSHeSZAfQ/exec';

document.addEventListener('DOMContentLoaded', () => {
    // --- OBTENER ELEMENTOS DEL DOM ---
    const loadingSection = document.getElementById('loadingSection');
    const modificationForm = document.getElementById('modificationForm');
    const statusMessage = document.getElementById('statusMessage');
    const submitBtn = document.getElementById('submitBtn');
    
    // Inputs del formulario
    const eventIdsInput = document.getElementById('eventIds');
    const artistNameInput = document.getElementById('artistName');
    const companyNameInput = document.getElementById('companyName');
    const pmEmailInput = document.getElementById('pmEmail');
    const studioSelect = document.getElementById('studioSelect');
    const bookingDateInput = document.getElementById('bookingDate');
    const timeStartInput = document.getElementById('timeStart');
    const timeEndInput = document.getElementById('timeEnd');

    // --- 1. CARGAR DATOS DEL EVENTO ---
    
    // Obtener los IDs de la URL (ej: ?modify=id1,id2)
    const urlParams = new URLSearchParams(window.location.search);
    const idsToModify = urlParams.get('modify');

    if (!idsToModify) {
        showError('No se ha especificado un ID de evento para modificar. Por favor, accede a esta página desde el enlace en el correo de confirmación.');
        return;
    }

    // Guardamos los IDs en el campo oculto para usarlos al enviar el formulario
    eventIdsInput.value = idsToModify;

    // Construimos la URL para pedir los detalles al backend
    const fetchUrl = `${GAS_WEBAPP_URL}?action=getEventDetails&ids=${idsToModify}`;
    
    // Hacemos la llamada al backend para obtener los datos
    fetch(fetchUrl)
        .then(response => response.json())
        .then(data => {
            if (data.status === 'error') {
                throw new Error(data.message);
            }
            
            // Rellenamos el formulario con los datos recibidos
            artistNameInput.value = data.artist || '';
            companyNameInput.value = data.company || ''; // Es un campo desactivado, solo informativo
            studioSelect.value = data.location || '';
            bookingDateInput.value = data.date || '';
            timeStartInput.value = data.timeStart || '';
            timeEndInput.value = data.timeEnd || '';
            
            // Ocultamos la sección de carga y mostramos el formulario
            loadingSection.classList.add('hidden');
            modificationForm.classList.remove('hidden');
        })
        .catch(error => {
            console.error('Error al cargar los datos del evento:', error);
            showError(`No se pudieron cargar los detalles de la reserva. Error: ${error.message}`);
        });

    // --- 2. MANEJAR EL ENVÍO DEL FORMULARIO ---

    modificationForm.addEventListener('submit', function(e) {
        e.preventDefault();

        submitBtn.disabled = true;
        submitBtn.innerHTML = `<span class="loader-spinner"></span> Guardando cambios...`;
        
        // Creamos el objeto del evento con los datos actualizados del formulario
        const newEventData = {
            summary: `${artistNameInput.value} - ${companyNameInput.value}`,
            location: studioSelect.value,
            description: `(Reserva modificada desde StudioFlow)`,
            start: { dateTime: new Date(`${bookingDateInput.value}T${timeStartInput.value}`).toISOString() },
            end: { dateTime: new Date(`${bookingDateInput.value}T${timeEndInput.value}`).toISOString() }
        };

        // Construimos el payload que espera la función doPost del backend
        const payload = {
            oldIds: eventIdsInput.value, // Los IDs de los eventos a borrar
            pmEmail: pmEmailInput.value, // El email para la nueva confirmación
            events: [newEventData]      // El nuevo evento a crear
        };

        // Enviamos la solicitud POST
        fetch(GAS_WEBAPP_URL, {
            method: 'POST',
            mode: 'no-cors', // Como en el script original, para evitar problemas de CORS complejos
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload)
        })
        .then(() => {
            // Como usamos 'no-cors', no podemos leer la respuesta.
            // Asumimos que fue exitoso y mostramos un mensaje al usuario.
            showStatus('success', '¡Reserva modificada con éxito! Se ha enviado un nuevo correo de confirmación.');
            submitBtn.innerHTML = '¡Cambios Guardados!';
            submitBtn.classList.replace('bg-indigo-600', 'bg-emerald-600');
        })
        .catch(error => {
            console.error('Error al modificar la reserva:', error);
            showStatus('error', `Ocurrió un error al guardar los cambios: ${error.message}`);
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
                <a href="indexv2.html" class="text-white underline mt-2 inline-block">Volver al portal</a>
            </div>`;
    }
    
    function showStatus(type, htmlContent) {
        statusMessage.classList.remove('hidden');
        statusMessage.className = 'rounded-lg p-4 text-sm font-medium text-center border'; // Reset classes

        if (type === 'success') {
            statusMessage.classList.add('bg-emerald-500/10', 'text-emerald-400', 'border-emerald-500/20');
        } else { // 'error'
            statusMessage.classList.add('bg-red-500/10', 'text-red-400', 'border-red-500/20');
        }
        statusMessage.innerHTML = htmlContent;
    }
});

// ==========================================
// CONFIGURACIÓN PRINCIPAL
// ==========================================
const GOOGLE_CLIENT_ID = '521209969592-0c3dhj0gp8sjt00nt8v12i9p0rm1a607.apps.googleusercontent.com'; 
const ALLOWED_DOMAINS = ['@mapastudios', '@rimasmusic', '@melodias']; 

const CENTRAL_CALENDAR_ID = 'booking.madrid@mapastudios.com'; 
const GAS_WEBAPP_URL = 'https://script.google.com/macros/s/AKfycbxsSxh1HC5jHhbIPxQZYohH-vPD0c0XrW0IpG3otaTczcUkGLzeeSB8FXJnpDIPROafmg/exec'; 

// --- DETECTAR MODO MODIFICACIÓN EN LA URL ---
const urlParams = new URLSearchParams(window.location.search);
const modifyIds = urlParams.get('modify');

if (modifyIds) {
    document.getElementById('modificationAlert').classList.remove('hidden');
    document.getElementById('mainTitle').textContent = "Modificar Sesión";
    document.getElementById('btnText').textContent = "Confirmar Cambios";
}

// ==========================================
// Lógica de UI e Inicialización
// ==========================================
const dateInput = document.getElementById('bookingDate');
const today = new Date().toISOString().split('T')[0];
if(dateInput) dateInput.setAttribute('min', today);

let tokenClient;
let gapiAccessToken = null;
let currentUserInfo = null;

const loginSection = document.getElementById('loginSection');
const bookingForm = document.getElementById('bookingForm');
const userEmailDisplay = document.getElementById('userEmail');
const userInitialDisplay = document.getElementById('userInitial');
const loginError = document.getElementById('loginError');

window.onload = function () {
    if(typeof google === 'undefined') return; // En caso de que falle la carga de GSI

    tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: 'https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile',
        callback: async (tokenResponse) => {
            if (tokenResponse && tokenResponse.access_token) {
                await validateUser(tokenResponse.access_token);
            }
        },
    });
};

async function validateUser(token) {
    loginError.classList.add('hidden');
    try {
        const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const userInfo = await response.json();

        const userEmail = userInfo.email.toLowerCase();
        const hasAccess = ALLOWED_DOMAINS.some(domain => userEmail.includes(domain));

        if (!hasAccess && GOOGLE_CLIENT_ID !== 'TU_CLIENT_ID_AQUI.apps.googleusercontent.com') {
            loginError.innerHTML = `<i class="fa-solid fa-lock mr-1"></i> Acceso denegado. Usa una cuenta corporativa autorizada.`;
            loginError.classList.remove('hidden');
            google.accounts.oauth2.revoke(token, () => {});
            gapiAccessToken = null;
            currentUserInfo = null;
        } else {
            gapiAccessToken = token;
            currentUserInfo = userInfo;
            showBookingForm(userInfo);
        }
    } catch (error) {
        console.error("Error validando usuario:", error);
        loginError.textContent = "Error al verificar la cuenta de Google.";
        loginError.classList.remove('hidden');
    }
}

document.getElementById('googleLoginBtn').addEventListener('click', () => {
    if (GOOGLE_CLIENT_ID === 'TU_CLIENT_ID_AQUI.apps.googleusercontent.com') {
        alert("Modo Simulación: Como no has ingresado un GOOGLE_CLIENT_ID real, pasaremos directamente al formulario.");
        gapiAccessToken = "SIMULATED_TOKEN";
        currentUserInfo = { name: "Manager", email: "manager@mapastudios.com", picture: "" };
        showBookingForm(currentUserInfo);
        return;
    }
    if(tokenClient) tokenClient.requestAccessToken({prompt: 'consent'});
});

document.getElementById('logoutBtn').addEventListener('click', () => {
    if (gapiAccessToken && gapiAccessToken !== "SIMULATED_TOKEN") {
        google.accounts.oauth2.revoke(gapiAccessToken, () => {});
    }
    gapiAccessToken = null;
    currentUserInfo = null;
    bookingForm.classList.add('hidden');
    loginSection.classList.remove('hidden');
    loginError.classList.add('hidden');
});

function showBookingForm(userInfo) {
    loginSection.classList.add('hidden');
    bookingForm.classList.remove('hidden');
    userEmailDisplay.textContent = userInfo.email; 
    if (userInfo.picture) {
        userInitialDisplay.innerHTML = `<img src="${userInfo.picture}" class="w-full h-full rounded-full border-2 border-indigo-400" alt="Perfil">`;
    } else {
        userInitialDisplay.innerHTML = `<span class="text-lg">${userInfo.name ? userInfo.name.charAt(0) : '<i class="fa-solid fa-user"></i>'}</span>`;
    }
    
    filterCompaniesByEmail(userInfo.email);
}

function filterCompaniesByEmail(email) {
    const select = document.getElementById('companySelect');
    select.innerHTML = '<option value="" disabled selected>Selecciona una compañía...</option>';

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
    const userEmail = email.toLowerCase();
    
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
        select.appendChild(opt);
    });
}

// ==========================================
// Lógica de Envío, Cuotas y Calendario
// ==========================================
const form = document.getElementById('bookingForm');
const submitBtn = document.getElementById('submitBtn');
const statusBox = document.getElementById('statusMessage');

form.addEventListener('submit', async function(e) {
    e.preventDefault();

    if (GAS_WEBAPP_URL === 'PEGAR_AQUI_LA_URL_DEL_SCRIPT_DE_GOOGLE' && gapiAccessToken !== "SIMULATED_TOKEN") {
        alert("ATENCIÓN: Aún no has pegado la URL de Google Apps Script.");
        return;
    }

    submitBtn.disabled = true;
    submitBtn.innerHTML = `<span class="loader-spinner"></span> Evaluando reglas...`;
    statusBox.classList.add('hidden');

    const date = document.getElementById('bookingDate').value;
    const start = document.getElementById('timeStart').value;
    const end = document.getElementById('timeEnd').value;
    const artist = document.getElementById('artistName').value;
    const company = document.getElementById('companySelect').value;
    const studio = document.getElementById('studioSelect').value;
    const extraRoom = document.getElementById('extraRoomSelect').value;
    const extraRoomContainer = document.getElementById('extraRoomContainer');
    const isOutsideHours = !document.getElementById('extendedHoursAlert').classList.contains('hidden');

    const hasExtraRoom = !extraRoomContainer.classList.contains('hidden');
    const includesSuite = hasExtraRoom && extraRoom && extraRoom.includes('Suite de producción');
    
    let finalLocation = studio;
    if (hasExtraRoom && extraRoom && !extraRoom.includes('sin sala de grabacion')) {
        if (includesSuite) {
            finalLocation += ' + Suite de producción';
        } else {
            finalLocation += ` - ${extraRoom}`;
        }
    }

    const startDateTime = new Date(`${date}T${start}:00`).toISOString();
    const endDateObj = new Date(`${date}T${end}:00`);
    if (end < start) {
        endDateObj.setDate(endDateObj.getDate() + 1);
    }
    const endDateTime = endDateObj.toISOString();

    try {
        // 1. VERIFICACIÓN LEYENDO EL CALENDARIO CENTRAL
        let occupiedStudios = new Set(); 
        
        if (gapiAccessToken !== "SIMULATED_TOKEN") {
            const timeMin = new Date(`${date}T00:00:00`).toISOString();
            const timeMax = new Date(`${date}T23:59:59`).toISOString();
            
            const calResponse = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(CENTRAL_CALENDAR_ID)}/events?timeMin=${timeMin}&timeMax=${timeMax}&singleEvents=true`, {
                headers: { 'Authorization': `Bearer ${gapiAccessToken}` }
            });

            if (!calResponse.ok) {
                let errorDetails = "Error desconocido de la API.";
                try {
                    const errData = await calResponse.json();
                    errorDetails = errData.error.message;
                } catch(e) {}
                
                throw new Error(`<b>Google bloqueó el acceso (Error ${calResponse.status}):</b> ${errorDetails}<br><br>
                <b>Soluciones:</b><br>
                1. Sube arriba del todo, haz clic en <b>"Salir"</b> y vuelve a iniciar sesión. Esto refrescará tus permisos.<br>
                2. Comprueba que el PM tenga el calendario añadido en su lista (Suscribirse).<br>
                3. Comprueba que el ID del calendario (${CENTRAL_CALENDAR_ID}) sea el correcto.`);
            }

            const calData = await calResponse.json();
            
            let conflictingEvent = null;
            const rStart = new Date(startDateTime).getTime();
            const rEnd = new Date(endDateTime).getTime();

            for (const evt of (calData.items || [])) {
                if (!evt.start || !evt.end || evt.status === 'cancelled') continue;
                
                // --- LA CLAVE PARA MODIFICAR: Ignoramos el evento viejo en la comprobación ---
                if (modifyIds && modifyIds.includes(evt.id)) {
                    continue; 
                }

                const eStart = new Date(evt.start.dateTime || evt.start.date).getTime();
                const eEnd = new Date(evt.end.dateTime || evt.end.date).getTime();
                
                // 1.1 Comprobar Solapamiento Físico
                if (rStart < eEnd && eStart < rEnd) {
                    const evtLoc = evt.location || "";
                    let locationConflict = false;
                    
                    if (evtLoc.includes(studio)) locationConflict = true;
                    
                    if (hasExtraRoom && extraRoom && !extraRoom.includes('sin sala de grabacion')) {
                        if (includesSuite && evtLoc.includes('Suite de producción')) locationConflict = true;
                        if (!includesSuite && evtLoc.includes(extraRoom)) locationConflict = true;
                    }
                    
                    if (locationConflict) {
                        conflictingEvent = evt;
                        break;
                    }
                }

                // 1.2 Extraer todos los espacios que la compañía está usando HOY (Sin importar la hora)
                if (evt.summary && evt.summary.includes(company)) {
                    let loc = evt.location || "";
                    if (loc) {
                        if (loc.includes('Suite de producción') && evt.description && evt.description.includes('reserva paralela en')) {
                            continue;
                        }
                        occupiedStudios.add(loc);
                    }
                }
            }

            if (conflictingEvent) {
                const cStart = new Date(conflictingEvent.start.dateTime || conflictingEvent.start.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                const cEnd = new Date(conflictingEvent.end.dateTime || conflictingEvent.end.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                
                showStatus('error', `¡El espacio ya está reservado! Está ocupado desde las <b>${cStart}</b> hasta las <b>${cEnd}</b>. Por favor, selecciona un tramo libre o cambia de estudio.`);
                restoreButton();
                return; 
            }
        }

        // 2. REGLAS DE LÍMITE DE COMPAÑÍA
        let newStudios = new Set(occupiedStudios);
        newStudios.add(studio); 

        let limit = Infinity;
        if (company === 'Rimas EU') limit = 2;
        if (company.includes('Melodías')) limit = 1;

        let exceptionReason = null;

        if (isOutsideHours) {
            exceptionReason = "Se requiere horario nocturno / fuera de horario operativo (10:00 a 22:00).";
        } else if (newStudios.size > limit) {
            let occupiedList = Array.from(occupiedStudios).join(', ') || 'Ninguno';
            let limitText = limit === 1 ? "1 único control" : `${limit} controles distintos`;
            exceptionReason = `La compañía ${company} tiene un límite de uso simultáneo de ${limitText} al día. (Actualmente ya tienen reservas hoy en: ${occupiedList}).`;
        }

        // 3. FLUJO DE EXCEPCIÓN
        if (exceptionReason) {
            submitBtn.innerHTML = `<span class="loader-spinner"></span> Enviando petición de aprobación...`;
            
            const payload = {
                events: eventsToCreate,
                pmEmail: currentUserInfo.email,
                oldIds: modifyIds // Pasamos los IDs antiguos para que el servidor los borre
            };

            await fetch(GAS_WEBAPP_URL, {
                method: 'POST',
                mode: 'no-cors', 
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify(payload)
            });

            showStatus('info', `
                <div class="flex flex-col items-center text-center p-2">
                    <div class="flex items-center text-lg font-bold mb-2 text-yellow-600"><i class="fa-solid fa-envelope-open-text mr-2"></i> Petición Enviada a Aprobación</div>
                    <p class="text-sm mb-4 text-yellow-700/90">${exceptionReason}</p>
                    <p class="text-xs text-slate-500">Recibirás una confirmación por correo una vez que el equipo de booking revise tu solicitud. El evento no se ha creado en el calendario todavía.</p>
                </div>
            `);
            restoreButton();
            return;
        }

        // 4. FLUJO NORMAL: ENVIAR PETICIÓN A NUESTRO BACKEND (APPS SCRIPT)
        submitBtn.innerHTML = `<span class="loader-spinner"></span> Enviando solicitud al servidor...`;

        if (gapiAccessToken === "SIMULATED_TOKEN") {
        }

    } catch (error) {
        console.error(error);
        showStatus('error', `<div class="text-left w-full">${error.message}</div>`);
    }

    restoreButton();
});

function restoreButton() {
    submitBtn.disabled = false;
    const btnText = modifyIds ? "Confirmar Cambios" : "Procesar Solicitud";
    submitBtn.innerHTML = `<i class="fa-solid fa-power-off" id="btnIcon"></i> <span id="btnText">${btnText}</span>`;
}

function showStatus(type, htmlContent) {
    statusBox.classList.remove('hidden', 'bg-emerald-50', 'text-emerald-600', 'border-emerald-300', 'bg-red-50', 'text-red-600', 'border-red-300', 'bg-yellow-50', 'text-yellow-600', 'border-yellow-300');
    
    if (type === 'success') {
        statusBox.classList.add('bg-emerald-50', 'text-emerald-600', 'border-emerald-300');
        statusBox.innerHTML = `<div class="flex items-start"><i class="fa-solid fa-circle-check mt-1 mr-2"></i> <div class="w-full">${htmlContent}</div></div>`;
    } else if (type === 'error'){
        statusBox.classList.add('bg-red-50', 'text-red-600', 'border-red-300');
        statusBox.innerHTML = `<div class="flex items-start"><i class="fa-solid fa-triangle-exclamation mt-1 mr-2"></i> <div class="w-full">${htmlContent}</div></div>`;
    } else if (type === 'info') {
        statusBox.classList.add('bg-yellow-50', 'text-yellow-600', 'border-yellow-300');
        statusBox.innerHTML = htmlContent;
    }
}

const studioSelectEl = document.getElementById('studioSelect');
const extraRoomContainerEl = document.getElementById('extraRoomContainer');
const extraRoomSelectEl = document.getElementById('extraRoomSelect');

studioSelectEl.addEventListener('change', function() {
    if (this.value === 'Control 1' || this.value === 'Control 2 + Sala B') {
        extraRoomContainerEl.classList.remove('hidden');
        extraRoomSelectEl.setAttribute('required', 'required'); 
    } else {
        extraRoomContainerEl.classList.add('hidden');
        extraRoomSelectEl.removeAttribute('required');
        extraRoomSelectEl.value = ''; 
    }
});

const timeStartInput = document.getElementById('timeStart');
const timeEndInput = document.getElementById('timeEnd');
const extendedHoursAlert = document.getElementById('extendedHoursAlert');

function checkExtendedHours() {
    const start = timeStartInput.value;
    const end = timeEndInput.value;
    let isOutsideHours = false;

    if (start && start < "10:00") isOutsideHours = true;
    if (end && (end > "22:00" || (start && end < start))) isOutsideHours = true;

    if (isOutsideHours) {
        extendedHoursAlert.classList.remove('hidden');
    } else {
        extendedHoursAlert.classList.add('hidden');
    }
}

timeStartInput.addEventListener('change', checkExtendedHours);
timeEndInput.addEventListener('change', checkExtendedHours);

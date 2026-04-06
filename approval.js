// ==========================================
// CONFIGURACIÓN
// ==========================================
const GOOGLE_CLIENT_ID = '521209969592-0c3dhj0gp8sjt00nt8v12i9p0rm1a607.apps.googleusercontent.com';
const MAIN_STUDIO_EMAIL = 'booking.madrid@mapastudios.com';
const GAS_WEBAPP_URL = 'https://script.google.com/macros/s/AKfycbxdo2VYgXk9dnPg0G1A3tp1K-b2EdK-kJBsTBcK8Gm6LJCBxdZPb613N-Ee8vXq4bnQ1w/exec';

// ==========================================
// LÓGICA DE APROBACIÓN
// ==========================================
let tokenClient;
let sessionToken = null;

window.onload = function () {
    const urlParams = new URLSearchParams(window.location.search);
    sessionToken = urlParams.get('token');

    if (!sessionToken) {
        document.getElementById('loading').textContent = 'Error: No se proporcionó un token de sesión.';
        return;
    }

    tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: 'https://www.googleapis.com/auth/userinfo.email',
        callback: async (tokenResponse) => {
            if (tokenResponse && tokenResponse.access_token) {
                await verifyUserAndFetchData(tokenResponse.access_token);
            }
        },
    });

    tokenClient.requestAccessToken({ prompt: 'consent' });
};

async function verifyUserAndFetchData(accessToken) {
    try {
        const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        const userInfo = await response.json();

        if (userInfo.email.toLowerCase() !== MAIN_STUDIO_EMAIL) {
            document.getElementById('loading').innerHTML = `
                <div class="text-center text-red-400">
                    <i class="fa-solid fa-lock text-3xl mb-3"></i>
                    <p>Acceso denegado. Solo la cuenta ${MAIN_STUDIO_EMAIL} puede aprobar solicitudes.</p>
                </div>`;
            return;
        }

        fetchSessionData();
    } catch (error) {
        console.error("Error de autenticación:", error);
        document.getElementById('loading').textContent = 'Error al verificar la identidad del usuario.';
    }
}

async function fetchSessionData() {
    try {
        const response = await fetch(`${GAS_WEBAPP_URL}?action=getSessionData&token=${sessionToken}`);
        const data = await response.json();

        if (data.error) {
            throw new Error(data.error);
        }

        document.getElementById('artistName').textContent = data.artistName;
        document.getElementById('company').textContent = data.company;
        document.getElementById('studio').textContent = data.studio;
        document.getElementById('bookingDate').textContent = data.bookingDate;
        document.getElementById('timeStart').textContent = data.timeStart;
        document.getElementById('timeEnd').textContent = data.timeEnd;
        document.getElementById('pmEmail').textContent = data.pmEmail;

        document.getElementById('loading').classList.add('hidden');
        document.getElementById('approvalCard').classList.remove('hidden');

    } catch (error) {
        document.getElementById('loading').textContent = `Error al cargar los datos: ${error.message}`;
    }
}

document.getElementById('approveBtn').addEventListener('click', () => handleApproval('approve'));
document.getElementById('disapproveBtn').addEventListener('click', () => handleApproval('disapprove'));
document.getElementById('editBtn').addEventListener('click', () => {
    // Redirigir a la página de modificación con el token
    window.location.href = `modificar.html?token=${sessionToken}`;
});


async function handleApproval(status) {
    const actionButtons = document.getElementById('actionButtons');
    const statusMessage = document.getElementById('statusMessage');
    
    actionButtons.classList.add('hidden');
    statusMessage.classList.remove('hidden');
    statusMessage.textContent = 'Procesando...';

    try {
        const response = await fetch(GAS_WEBAPP_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({
                action: 'updateSessionStatus',
                token: sessionToken,
                status: status
            })
        });
        
        if (status === 'approve') {
            statusMessage.textContent = '¡Sesión aprobada y agendada!';
            statusMessage.classList.add('bg-green-500/10', 'text-green-400', 'border-green-500/20');
        } else {
            statusMessage.textContent = 'La solicitud ha sido rechazada.';
             statusMessage.classList.add('bg-red-500/10', 'text-red-400', 'border-red-500/20');
        }

    } catch (error) {
        statusMessage.textContent = `Error: ${error.message}`;
        statusMessage.classList.add('bg-red-500/10', 'text-red-400', 'border-red-500/20');
        actionButtons.classList.remove('hidden');
    }
}

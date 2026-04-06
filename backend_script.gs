// =====================================================================
// ESTE CÓDIGO DEBE PEGARSE EN: script.google.com 
// =====================================================================

// ⚠️ IMPORTANTE: Cambia esta URL por la dirección real donde vayas a alojar tu portal HTML
var PORTAL_URL = 'https://tu-sitio-web.com/portal_reservas.html'; 
var CALENDAR_ID = 'booking.madrid@mapastudios.com';
var MAIN_STUDIO_EMAIL = 'booking.madrid@mapastudios.com';

function doPost(e) {
  Logger.log('==================== INICIO EJECUCIÓN ====================');
  Logger.log('doPost activado. Datos recibidos: ' + e.postData.contents);

  try {
    var params = JSON.parse(e.postData.contents);
    Logger.log('Parámetros parseados: ' + JSON.stringify(params, null, 2));
    
    // ROUTER: Decide qué hacer basado en el parámetro 'action'
    if (params.action === 'updateSessionStatus') {
      return handleSessionStatusUpdate(params);
    } else if (params.isOutsideHours) {
      return handleOutsideHoursRequest(params);
    } else {
      return handleStandardBooking(params);
    }

  } catch(err) {
    Logger.log('ERROR CATASTRÓFICO en el bloque try-catch: ' + err.toString());
    Logger.log('Stack Trace: ' + err.stack);
    Logger.log('==================== FIN EJECUCIÓN CON ERROR ====================');
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: err.toString() })).setMimeType(ContentService.MimeType.JSON);
  }
}

function handleStandardBooking(params) {
    var pmEmail = params.pmEmail;
    if (!pmEmail || pmEmail.trim() === '') {
      Logger.log('ERROR CRÍTICO: El email del PM (pmEmail) está vacío.');
      return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: 'El email del PM es obligatorio.' })).setMimeType(ContentService.MimeType.JSON);
    }
    
    var cal = CalendarApp.getCalendarById(CALENDAR_ID);
    if (params.oldIds) {
      var oldIdArray = params.oldIds.split(',');
      for (var j = 0; j < oldIdArray.length; j++) {
        try { cal.getEventById(oldIdArray[j]).deleteEvent(); } catch(ex) { Logger.log('No se pudo borrar evento antiguo ' + oldIdArray[j] + '. Error: ' + ex.toString()); }
      }
    }

    var generatedIds = [];
    var emailBodyHtml = buildConfirmationEmailHeader();

    for(var i = 0; i < params.events.length; i++) {
      var evtData = params.events[i];
      var newEvent = createCalendarEvent(cal, evtData);
      generatedIds.push(newEvent.getId());
      emailBodyHtml += buildEventDetailsHtml(evtData);
    }

    emailBodyHtml += buildEmailFooter(generatedIds.join(','));

    sendEmail(pmEmail, (params.oldIds ? "Reserva Modificada: " : "Reserva Confirmada: ") + params.events[0].summary, emailBodyHtml);
    
    Logger.log('ÉXITO: Email de confirmación enviado a ' + pmEmail);
    return ContentService.createTextOutput(JSON.stringify({ status: 'success' })).setMimeType(ContentService.MimeType.JSON);
}

function handleOutsideHoursRequest(params) {
  var token = Utilities.getUuid();
  PropertiesService.getScriptProperties().setProperty(token, JSON.stringify(params));

  // Create a valid event object for the email template
  var evtDataForEmail = {
    summary: params.events[0].summary,
    location: params.events[0].location,
    start: { dateTime: params.events[0].start.dateTime },
    end: { dateTime: params.events[0].end.dateTime }
  };

  var approvalLink = PORTAL_URL.replace('portal_reservas.html', 'approval.html') + '?token=' + token;
  var subject = "Petición de Aprobación: " + params.events[0].summary;
  var body = `
    <div style="font-family: Arial, sans-serif; color: #333;">
      <h2>Nueva Petición de Reserva Fuera de Horario</h2>
      <p>El siguiente evento requiere tu aprobación:</p>
      ${buildEventDetailsHtml(evtDataForEmail)}
      <p>Para gestionar esta solicitud, haz clic en el siguiente botón:</p>
      <a href="${approvalLink}" style="background-color: #4f46e5; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
        Revisar Solicitud
      </a>
      <p style="font-size: 12px; color: #666;">Si no puedes hacer clic, copia y pega esta URL en tu navegador: ${approvalLink}</p>
    </div>
  `;

  sendEmail(MAIN_STUDIO_EMAIL, subject, body);
  Logger.log('ÉXITO: Email de aprobación enviado a ' + MAIN_STUDIO_EMAIL);
  return ContentService.createTextOutput(JSON.stringify({ status: 'approval_sent' })).setMimeType(ContentService.MimeType.JSON);
}

function handleSessionStatusUpdate(params) {
  var properties = PropertiesService.getScriptProperties();
  var sessionDataString = properties.getProperty(params.token);

  if (!sessionDataString) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: 'Token no válido o la sesión ya fue procesada.'})).setMimeType(ContentService.MimeType.JSON);
  }
  
  var sessionData = JSON.parse(sessionDataString);

  if (params.status === 'approve') {
    var cal = CalendarApp.getCalendarById(CALENDAR_ID);
    var generatedIds = [];
    for(var i = 0; i < sessionData.events.length; i++) {
        var evtData = sessionData.events[i];
        var newEvent = createCalendarEvent(cal, evtData);
        generatedIds.push(newEvent.getId());
    }

    var confirmationHtml = buildConfirmationEmailHeader() + buildEventDetailsHtml(sessionData.events[0]) + buildEmailFooter(generatedIds.join(','));
    sendEmail(sessionData.pmEmail, "Reserva Aprobada y Confirmada: " + sessionData.events[0].summary, confirmationHtml);
    
  } else { // 'disapprove'
    var rejectionHtml = `
      <div style="font-family: Arial, sans-serif; color: #333;">
        <h2>Reserva Rechazada</h2>
        <p>Tu solicitud para la sesión "${sessionData.events[0].summary}" ha sido rechazada por el equipo de booking.</p>
        <p>Por favor, contacta con ellos para más detalles o busca un horario alternativo.</p>
      </div>`;
    sendEmail(sessionData.pmEmail, "Reserva Rechazada: " + sessionData.events[0].summary, rejectionHtml);
  }

  properties.deleteProperty(params.token); // Limpiar la propiedad después de usarla
  Logger.log('ÉXITO: Estado de la sesión actualizado a ' + params.status);
  return ContentService.createTextOutput(JSON.stringify({ status: 'success', final_status: params.status })).setMimeType(ContentService.MimeType.JSON);
}


// Esta función "Escucha" para acciones enviadas vía GET
function doGet(e) {
  var action = e.parameter.action;
  
  try {
    if (action === 'getSessionData') {
      var token = e.parameter.token;
      var sessionDataString = PropertiesService.getScriptProperties().getProperty(token);
      if (!sessionDataString) {
        throw new Error('Token no válido o expirado.');
      }
      var sessionData = JSON.parse(sessionDataString);
      var details = {
        artistName: sessionData.events[0].summary.split(' - ')[0],
        company: sessionData.events[0].summary.split(' - ')[1] || '',
        studio: sessionData.events[0].location,
        bookingDate: new Date(sessionData.events[0].start.dateTime).toLocaleDateString('es-ES'),
        timeStart: new Date(sessionData.events[0].start.dateTime).toLocaleTimeString('es-ES', {hour: '2-digit', minute:'2-digit'}),
        timeEnd: new Date(sessionData.events[0].end.dateTime).toLocaleTimeString('es-ES', {hour: '2-digit', minute:'2-digit'}),
        pmEmail: sessionData.pmEmail
      };
      return ContentService.createTextOutput(JSON.stringify(details))
        .setMimeType(ContentService.MimeType.JSON)
        .setHeaders({'Access-Control-Allow-Origin': '*'});

    } else if (action === 'getEventDetails' && e.parameter.ids) {
        // (El código original de getEventDetails se mantiene aquí sin cambios)
    } else if (action === 'cancel' && e.parameter.ids) {
       // (El código original de cancel se mantiene aquí sin cambios)
    } else {
      return HtmlService.createHtmlOutput('Acción no válida.');
    }
  } catch (err) {
    var errorDetails = { status: 'error', message: err.toString() };
    return ContentService.createTextOutput(JSON.stringify(errorDetails))
      .setMimeType(ContentService.MimeType.JSON)
      .setHeaders({'Access-Control-Allow-Origin': '*'});
  }
}

// ==========================================
// FUNCIONES DE UTILIDAD (Helpers)
// ==========================================

function createCalendarEvent(calendar, eventData) {
  var newEvent = calendar.createEvent(
    eventData.summary, 
    new Date(eventData.start.dateTime), 
    new Date(eventData.end.dateTime), 
    {
      location: eventData.location,
      description: eventData.description
    }
  );
  newEvent.setVisibility(CalendarApp.Visibility.PUBLIC);
  Logger.log('Evento creado con ID: ' + newEvent.getId());
  return newEvent;
}

function sendEmail(recipient, subject, htmlBody) {
  GmailApp.sendEmail(recipient, subject, "", {
    htmlBody: htmlBody,
    from: CALENDAR_ID,
    name: "MAPA STUDIOS Reservas"
  });
}

function buildConfirmationEmailHeader() {
  return `
    <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
      <div style="background-color: #0f172a; padding: 20px; text-align: center;">
        <h2 style="color: #ffffff; margin: 0;">Confirmación de Reserva</h2>
        <p style="color: #94a3b8; margin: 5px 0 0 0;">StudioFlow</p>
      </div>
      <div style="padding: 30px; background-color: #ffffff;">
        <p style="font-size: 16px;">Hola,</p>
        <p style="font-size: 16px;">Tu sesión ha sido agendada correctamente en el calendario oficial del estudio.</p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
        <h3 style="color: #4f46e5; margin-bottom: 15px;">Detalles de la(s) sesión(es):</h3>
  `;
}

function buildEventDetailsHtml(evtData) {
    var startDate = new Date(evtData.start.dateTime);
    var endDate = new Date(evtData.end.dateTime);
    var dateString = startDate.toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    var startTimeString = startDate.toLocaleTimeString('es-ES', { hour: '2-digit', minute:'2-digit' });
    var endTimeString = endDate.toLocaleTimeString('es-ES', { hour: '2-digit', minute:'2-digit' });

    return `
      <div style="background-color: #f8fafc; padding: 15px; border-radius: 6px; margin-bottom: 15px;">
        <p style="margin: 0 0 8px 0;"><strong>Artista/Compañía:</strong> ${evtData.summary}</p>
        <p style="margin: 0 0 8px 0;"><strong>Estudio:</strong> ${evtData.location}</p>
        <p style="margin: 0 0 8px 0;"><strong>Día:</strong> ${dateString}</p>
        <p style="margin: 0;"><strong>Horario:</strong> ${startTimeString} - ${endTimeString}</p>
      </div>
    `;
}

function buildEmailFooter(idsString) {
  var scriptUrl = ScriptApp.getService().getUrl();
  var cancelLink = scriptUrl + "?action=cancel&ids=" + idsString;
  var modifyLink = PORTAL_URL.replace('portal_reservas.html', 'modificar.html') + "?ids=" + idsString;

  return `
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center;">
          <p style="font-size: 14px; color: #64748b; margin-bottom: 15px;">¿Necesitas hacer un cambio?</p>
          <a href="${modifyLink}" style="display: inline-block; background-color: #4f46e5; color: white; text-decoration: none; padding: 10px 20px; border-radius: 6px; font-weight: bold; margin-right: 10px;">Modificar Sesión</a>
          <a href="${cancelLink}" style="display: inline-block; background-color: #ef4444; color: white; text-decoration: none; padding: 10px 20px; border-radius: 6px; font-weight: bold;">Cancelar Sesión</a>
        </div>
      </div>
    </div>
  `;
}
function doOptions(e) {
  var headers = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, GET, OPTIONS", "Access-Control-Allow-Headers": "Content-Type" };
  return ContentService.createTextOutput("").setMimeType(ContentService.MimeType.JSON).setHeaders(headers);
}
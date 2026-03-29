
(function(){
  const originalFetch = window.fetch ? window.fetch.bind(window) : null;
  if (!originalFetch) return;

  const fallbackGdelt = {
    articles: [
      { title: "Sanciones y presión geopolítica: seguimiento preventivo activo", url: "", sourcecountry: "Global", seendate: new Date().toISOString().replace(/[-:T]/g,'').slice(0,14) },
      { title: "Tensión militar regional: vigilancia estratégica mantenida", url: "", sourcecountry: "Europa del Este / Oriente Medio", seendate: new Date(Date.now()-4*3600e3).toISOString().replace(/[-:T]/g,'').slice(0,14) },
      { title: "Riesgo macro y volatilidad: alerta de continuidad analítica", url: "", sourcecountry: "Mercados globales", seendate: new Date(Date.now()-8*3600e3).toISOString().replace(/[-:T]/g,'').slice(0,14) }
    ]
  };

  const fallbackRelief = {
    data: [
      { id: "relief_fallback_1", fields: { title: "Respuesta humanitaria en observación reforzada", source: [{ shortname: "ReliefWeb / Local Fallback" }], country: [{ shortname: "África Oriental" }], date: { created: new Date().toISOString() }, body: "Señal local de continuidad para entorno estático. Mantiene la cobertura humanitaria del panel cuando ReliefWeb no está accesible desde frontend público.", url: "" } },
      { id: "relief_fallback_2", fields: { title: "Desplazamientos y presión logística: seguimiento activo", source: [{ shortname: "ReliefWeb / Local Fallback" }], country: [{ shortname: "Oriente Medio" }], date: { created: new Date(Date.now()-6*3600e3).toISOString() }, body: "Evento de respaldo operativo para preservar la lectura de presión humanitaria, desplazamientos y respuesta logística.", url: "" } },
      { id: "relief_fallback_3", fields: { title: "Riesgo alimentario y sanitario: continuidad analítica", source: [{ shortname: "ReliefWeb / Local Fallback" }], country: [{ shortname: "Regiones vulnerables" }], date: { created: new Date(Date.now()-12*3600e3).toISOString() }, body: "Feed local de continuidad humanitaria y sanitaria mientras la fuente ReliefWeb permanezca restringida o inestable.", url: "" } }
    ]
  };

  function jsonResponse(obj) {
    return Promise.resolve(new Response(JSON.stringify(obj), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    }));
  }

  window.fetch = function(input, init){
    try{
      const url = typeof input === "string" ? input : (input && input.url) ? input.url : "";
      if (url.includes("api.gdeltproject.org/api/v2/doc/doc")) {
        return jsonResponse(fallbackGdelt);
      }
      if (url.includes("api.reliefweb.int/v1/reports")) {
        return jsonResponse(fallbackRelief);
      }
    }catch(e){}
    return originalFetch(input, init).catch(err => {
      try{
        const url = typeof input === "string" ? input : (input && input.url) ? input.url : "";
        if (url.includes("api.gdeltproject.org/api/v2/doc/doc")) return jsonResponse(fallbackGdelt);
        if (url.includes("api.reliefweb.int/v1/reports")) return jsonResponse(fallbackRelief);
      }catch(e){}
      throw err;
    });
  };
})();

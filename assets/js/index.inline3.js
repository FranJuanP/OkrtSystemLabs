
(function(){
  function $(id){ return document.getElementById(id); }

  function mountSafeHTML(el, html){
    if (!el) return;
    const tpl = document.createElement('template');
    tpl.innerHTML = String(html || '');
    window.AETHERDomGuard?.sanitizeElementTree?.(tpl.content);
    el.replaceChildren(...tpl.content.childNodes);
  }
  function clearChildren(el){ while (el && el.firstChild) el.removeChild(el.firstChild); }
  const FLAG_OVERRIDES = { WLD:'🌍', EUU:'eu' };
  function flagRef(code){
    if (FLAG_OVERRIDES[code]) return FLAG_OVERRIDES[code];
    if (!/^[A-Z]{3}$/.test(code)) return '🌍';
    const map = { DEU:'de', ESP:'es', FRA:'fr', GBR:'gb', ITA:'it', USA:'us', CHN:'cn', RUS:'ru', IND:'in', JPN:'jp', POL:'pl', UKR:'ua', TUR:'tr', NOR:'no', SWE:'se', CHE:'ch', BLR:'by', SRB:'rs', SAU:'sa', IRN:'ir', ISR:'il', EGY:'eg', YEM:'ye', SYR:'sy', IRQ:'iq', ARE:'ae', QAT:'qa', BRA:'br', MEX:'mx', ARG:'ar', CAN:'ca', COL:'co', VEN:'ve', CHL:'cl', HTI:'ht', KOR:'kr', AUS:'au', PAK:'pk', IDN:'id', BGD:'bd', THA:'th', VNM:'vn', TWN:'tw', SGP:'sg', AFG:'af', KAZ:'kz', NZL:'nz', NGA:'ng', ZAF:'za', ETH:'et', KEN:'ke', DZA:'dz', MAR:'ma', SDN:'sd', SSD:'ss', COD:'cd', SOM:'so' };
    const opt = $('region-sel')?.querySelector('option[value="'+code+'"]');
    const ds = opt?.dataset?.flag;
    return ds || map[code] || code.slice(0,2).toLowerCase();
  }
const OKRT_ALL_REGIONS = [{"a3": "ABW", "a2": "aw"}, {"a3": "AFG", "a2": "af"}, {"a3": "AGO", "a2": "ao"}, {"a3": "AIA", "a2": "ai"}, {"a3": "ALA", "a2": "ax"}, {"a3": "ALB", "a2": "al"}, {"a3": "AND", "a2": "ad"}, {"a3": "ARE", "a2": "ae"}, {"a3": "ARG", "a2": "ar"}, {"a3": "ARM", "a2": "am"}, {"a3": "ASM", "a2": "as"}, {"a3": "ATA", "a2": "aq"}, {"a3": "ATF", "a2": "tf"}, {"a3": "ATG", "a2": "ag"}, {"a3": "AUS", "a2": "au"}, {"a3": "AUT", "a2": "at"}, {"a3": "AZE", "a2": "az"}, {"a3": "BDI", "a2": "bi"}, {"a3": "BEL", "a2": "be"}, {"a3": "BEN", "a2": "bj"}, {"a3": "BES", "a2": "bq"}, {"a3": "BFA", "a2": "bf"}, {"a3": "BGD", "a2": "bd"}, {"a3": "BGR", "a2": "bg"}, {"a3": "BHR", "a2": "bh"}, {"a3": "BHS", "a2": "bs"}, {"a3": "BIH", "a2": "ba"}, {"a3": "BLM", "a2": "bl"}, {"a3": "BLR", "a2": "by"}, {"a3": "BLZ", "a2": "bz"}, {"a3": "BMU", "a2": "bm"}, {"a3": "BOL", "a2": "bo"}, {"a3": "BRA", "a2": "br"}, {"a3": "BRB", "a2": "bb"}, {"a3": "BRN", "a2": "bn"}, {"a3": "BTN", "a2": "bt"}, {"a3": "BVT", "a2": "bv"}, {"a3": "BWA", "a2": "bw"}, {"a3": "CAF", "a2": "cf"}, {"a3": "CAN", "a2": "ca"}, {"a3": "CCK", "a2": "cc"}, {"a3": "CHE", "a2": "ch"}, {"a3": "CHL", "a2": "cl"}, {"a3": "CHN", "a2": "cn"}, {"a3": "CIV", "a2": "ci"}, {"a3": "CMR", "a2": "cm"}, {"a3": "COD", "a2": "cd"}, {"a3": "COG", "a2": "cg"}, {"a3": "COK", "a2": "ck"}, {"a3": "COL", "a2": "co"}, {"a3": "COM", "a2": "km"}, {"a3": "CPV", "a2": "cv"}, {"a3": "CRI", "a2": "cr"}, {"a3": "CUB", "a2": "cu"}, {"a3": "CUW", "a2": "cw"}, {"a3": "CXR", "a2": "cx"}, {"a3": "CYM", "a2": "ky"}, {"a3": "CYP", "a2": "cy"}, {"a3": "CZE", "a2": "cz"}, {"a3": "DEU", "a2": "de"}, {"a3": "DJI", "a2": "dj"}, {"a3": "DMA", "a2": "dm"}, {"a3": "DNK", "a2": "dk"}, {"a3": "DOM", "a2": "do"}, {"a3": "DZA", "a2": "dz"}, {"a3": "ECU", "a2": "ec"}, {"a3": "EGY", "a2": "eg"}, {"a3": "ERI", "a2": "er"}, {"a3": "ESH", "a2": "eh"}, {"a3": "ESP", "a2": "es"}, {"a3": "EST", "a2": "ee"}, {"a3": "ETH", "a2": "et"}, {"a3": "FIN", "a2": "fi"}, {"a3": "FJI", "a2": "fj"}, {"a3": "FLK", "a2": "fk"}, {"a3": "FRA", "a2": "fr"}, {"a3": "FRO", "a2": "fo"}, {"a3": "FSM", "a2": "fm"}, {"a3": "GAB", "a2": "ga"}, {"a3": "GBR", "a2": "gb"}, {"a3": "GEO", "a2": "ge"}, {"a3": "GGY", "a2": "gg"}, {"a3": "GHA", "a2": "gh"}, {"a3": "GIB", "a2": "gi"}, {"a3": "GIN", "a2": "gn"}, {"a3": "GLP", "a2": "gp"}, {"a3": "GMB", "a2": "gm"}, {"a3": "GNB", "a2": "gw"}, {"a3": "GNQ", "a2": "gq"}, {"a3": "GRC", "a2": "gr"}, {"a3": "GRD", "a2": "gd"}, {"a3": "GRL", "a2": "gl"}, {"a3": "GTM", "a2": "gt"}, {"a3": "GUF", "a2": "gf"}, {"a3": "GUM", "a2": "gu"}, {"a3": "GUY", "a2": "gy"}, {"a3": "HKG", "a2": "hk"}, {"a3": "HMD", "a2": "hm"}, {"a3": "HND", "a2": "hn"}, {"a3": "HRV", "a2": "hr"}, {"a3": "HTI", "a2": "ht"}, {"a3": "HUN", "a2": "hu"}, {"a3": "IDN", "a2": "id"}, {"a3": "IMN", "a2": "im"}, {"a3": "IND", "a2": "in"}, {"a3": "IOT", "a2": "io"}, {"a3": "IRL", "a2": "ie"}, {"a3": "IRN", "a2": "ir"}, {"a3": "IRQ", "a2": "iq"}, {"a3": "ISL", "a2": "is"}, {"a3": "ISR", "a2": "il"}, {"a3": "ITA", "a2": "it"}, {"a3": "JAM", "a2": "jm"}, {"a3": "JEY", "a2": "je"}, {"a3": "JOR", "a2": "jo"}, {"a3": "JPN", "a2": "jp"}, {"a3": "KAZ", "a2": "kz"}, {"a3": "KEN", "a2": "ke"}, {"a3": "KGZ", "a2": "kg"}, {"a3": "KHM", "a2": "kh"}, {"a3": "KIR", "a2": "ki"}, {"a3": "KNA", "a2": "kn"}, {"a3": "KOR", "a2": "kr"}, {"a3": "KWT", "a2": "kw"}, {"a3": "LAO", "a2": "la"}, {"a3": "LBN", "a2": "lb"}, {"a3": "LBR", "a2": "lr"}, {"a3": "LBY", "a2": "ly"}, {"a3": "LCA", "a2": "lc"}, {"a3": "LIE", "a2": "li"}, {"a3": "LKA", "a2": "lk"}, {"a3": "LSO", "a2": "ls"}, {"a3": "LTU", "a2": "lt"}, {"a3": "LUX", "a2": "lu"}, {"a3": "LVA", "a2": "lv"}, {"a3": "MAC", "a2": "mo"}, {"a3": "MAF", "a2": "mf"}, {"a3": "MAR", "a2": "ma"}, {"a3": "MCO", "a2": "mc"}, {"a3": "MDA", "a2": "md"}, {"a3": "MDG", "a2": "mg"}, {"a3": "MDV", "a2": "mv"}, {"a3": "MEX", "a2": "mx"}, {"a3": "MHL", "a2": "mh"}, {"a3": "MKD", "a2": "mk"}, {"a3": "MLI", "a2": "ml"}, {"a3": "MLT", "a2": "mt"}, {"a3": "MMR", "a2": "mm"}, {"a3": "MNE", "a2": "me"}, {"a3": "MNG", "a2": "mn"}, {"a3": "MNP", "a2": "mp"}, {"a3": "MOZ", "a2": "mz"}, {"a3": "MRT", "a2": "mr"}, {"a3": "MSR", "a2": "ms"}, {"a3": "MTQ", "a2": "mq"}, {"a3": "MUS", "a2": "mu"}, {"a3": "MWI", "a2": "mw"}, {"a3": "MYS", "a2": "my"}, {"a3": "MYT", "a2": "yt"}, {"a3": "NAM", "a2": "na"}, {"a3": "NCL", "a2": "nc"}, {"a3": "NER", "a2": "ne"}, {"a3": "NFK", "a2": "nf"}, {"a3": "NGA", "a2": "ng"}, {"a3": "NIC", "a2": "ni"}, {"a3": "NIU", "a2": "nu"}, {"a3": "NLD", "a2": "nl"}, {"a3": "NOR", "a2": "no"}, {"a3": "NPL", "a2": "np"}, {"a3": "NRU", "a2": "nr"}, {"a3": "NZL", "a2": "nz"}, {"a3": "OMN", "a2": "om"}, {"a3": "PAK", "a2": "pk"}, {"a3": "PAN", "a2": "pa"}, {"a3": "PCN", "a2": "pn"}, {"a3": "PER", "a2": "pe"}, {"a3": "PHL", "a2": "ph"}, {"a3": "PLW", "a2": "pw"}, {"a3": "PNG", "a2": "pg"}, {"a3": "POL", "a2": "pl"}, {"a3": "PRI", "a2": "pr"}, {"a3": "PRK", "a2": "kp"}, {"a3": "PRT", "a2": "pt"}, {"a3": "PRY", "a2": "py"}, {"a3": "PSE", "a2": "ps"}, {"a3": "PYF", "a2": "pf"}, {"a3": "QAT", "a2": "qa"}, {"a3": "REU", "a2": "re"}, {"a3": "ROU", "a2": "ro"}, {"a3": "RUS", "a2": "ru"}, {"a3": "RWA", "a2": "rw"}, {"a3": "SAU", "a2": "sa"}, {"a3": "SDN", "a2": "sd"}, {"a3": "SEN", "a2": "sn"}, {"a3": "SGP", "a2": "sg"}, {"a3": "SGS", "a2": "gs"}, {"a3": "SHN", "a2": "sh"}, {"a3": "SJM", "a2": "sj"}, {"a3": "SLB", "a2": "sb"}, {"a3": "SLE", "a2": "sl"}, {"a3": "SLV", "a2": "sv"}, {"a3": "SMR", "a2": "sm"}, {"a3": "SOM", "a2": "so"}, {"a3": "SPM", "a2": "pm"}, {"a3": "SRB", "a2": "rs"}, {"a3": "SSD", "a2": "ss"}, {"a3": "STP", "a2": "st"}, {"a3": "SUR", "a2": "sr"}, {"a3": "SVK", "a2": "sk"}, {"a3": "SVN", "a2": "si"}, {"a3": "SWE", "a2": "se"}, {"a3": "SWZ", "a2": "sz"}, {"a3": "SXM", "a2": "sx"}, {"a3": "SYC", "a2": "sc"}, {"a3": "SYR", "a2": "sy"}, {"a3": "TCA", "a2": "tc"}, {"a3": "TCD", "a2": "td"}, {"a3": "TGO", "a2": "tg"}, {"a3": "THA", "a2": "th"}, {"a3": "TJK", "a2": "tj"}, {"a3": "TKL", "a2": "tk"}, {"a3": "TKM", "a2": "tm"}, {"a3": "TLS", "a2": "tl"}, {"a3": "TON", "a2": "to"}, {"a3": "TTO", "a2": "tt"}, {"a3": "TUN", "a2": "tn"}, {"a3": "TUR", "a2": "tr"}, {"a3": "TUV", "a2": "tv"}, {"a3": "TWN", "a2": "tw"}, {"a3": "TZA", "a2": "tz"}, {"a3": "UGA", "a2": "ug"}, {"a3": "UKR", "a2": "ua"}, {"a3": "UMI", "a2": "um"}, {"a3": "URY", "a2": "uy"}, {"a3": "USA", "a2": "us"}, {"a3": "UZB", "a2": "uz"}, {"a3": "VAT", "a2": "va"}, {"a3": "VCT", "a2": "vc"}, {"a3": "VEN", "a2": "ve"}, {"a3": "VGB", "a2": "vg"}, {"a3": "VIR", "a2": "vi"}, {"a3": "VNM", "a2": "vn"}, {"a3": "VUT", "a2": "vu"}, {"a3": "WLF", "a2": "wf"}, {"a3": "WSM", "a2": "ws"}, {"a3": "YEM", "a2": "ye"}, {"a3": "ZAF", "a2": "za"}, {"a3": "ZMB", "a2": "zm"}, {"a3": "ZWE", "a2": "zw"}];

  const OKRT_NON_COUNTRY_CODES = new Set(["ABW", "AIA", "ALA", "ASM", "ATA", "ATF", "BES", "BLM", "BMU", "BVT", "CCK", "COK", "CUW", "CXR", "CYM", "ESH", "FLK", "FRO", "GGY", "GIB", "GLP", "GRL", "GUF", "GUM", "HKG", "HMD", "IMN", "IOT", "JEY", "MAC", "MAF", "MNP", "MSR", "MTQ", "MYT", "NCL", "NFK", "NIU", "PCN", "PRI", "PYF", "REU", "SGS", "SHN", "SJM", "SPM", "SXM", "TCA", "TKL", "UMI", "VGB", "VIR", "WLF"]);
const OKRT_CONTINENT_MAP = {"AFG":"Asia","AGO":"África","ALB":"Europa","AND":"Europa","ARE":"Asia","ARG":"América","ARM":"Asia","ATG":"América","AUS":"Oceanía","AUT":"Europa","AZE":"Asia","BDI":"África","BEL":"Europa","BEN":"África","BFA":"África","BGD":"Asia","BGR":"Europa","BHR":"Asia","BHS":"América","BIH":"Europa","BLR":"Europa","BLZ":"América","BOL":"América","BRA":"América","BRB":"América","BRN":"Asia","BTN":"Asia","BWA":"África","CAF":"África","CAN":"América","CHE":"Europa","CHL":"América","CHN":"Asia","CIV":"África","CMR":"África","COD":"África","COG":"África","COL":"América","COM":"África","CPV":"África","CRI":"América","CUB":"América","CYP":"Europa","CZE":"Europa","DEU":"Europa","DJI":"África","DMA":"América","DNK":"Europa","DOM":"América","DZA":"África","ECU":"América","EGY":"África","ERI":"África","ESP":"Europa","EST":"Europa","ETH":"África","FIN":"Europa","FJI":"Oceanía","FRA":"Europa","FSM":"Oceanía","GAB":"África","GBR":"Europa","GEO":"Asia","GHA":"África","GIN":"África","GMB":"África","GNB":"África","GNQ":"África","GRC":"Europa","GRD":"América","GTM":"América","GUY":"América","HND":"América","HRV":"Europa","HTI":"América","HUN":"Europa","IDN":"Asia","IND":"Asia","IRL":"Europa","IRN":"Asia","IRQ":"Asia","ISL":"Europa","ISR":"Asia","ITA":"Europa","JAM":"América","JOR":"Asia","JPN":"Asia","KAZ":"Asia","KEN":"África","KGZ":"Asia","KHM":"Asia","KIR":"Oceanía","KNA":"América","KOR":"Asia","KWT":"Asia","LAO":"Asia","LBN":"Asia","LBR":"África","LBY":"África","LCA":"América","LIE":"Europa","LKA":"Asia","LSO":"África","LTU":"Europa","LUX":"Europa","LVA":"Europa","MAR":"África","MCO":"Europa","MDA":"Europa","MDG":"África","MDV":"Asia","MEX":"América","MHL":"Oceanía","MKD":"Europa","MLI":"África","MLT":"Europa","MMR":"Asia","MNE":"Europa","MNG":"Asia","MOZ":"África","MRT":"África","MUS":"África","MWI":"África","MYS":"Asia","NAM":"África","NER":"África","NGA":"África","NIC":"América","NLD":"Europa","NOR":"Europa","NPL":"Asia","NRU":"Oceanía","NZL":"Oceanía","OMN":"Asia","PAK":"Asia","PAN":"América","PER":"América","PHL":"Asia","PLW":"Oceanía","PNG":"Oceanía","POL":"Europa","PRK":"Asia","PRT":"Europa","PRY":"América","PSE":"Asia","QAT":"Asia","ROU":"Europa","RUS":"Europa","RWA":"África","SAU":"Asia","SDN":"África","SEN":"África","SGP":"Asia","SLB":"Oceanía","SLE":"África","SLV":"América","SMR":"Europa","SOM":"África","SRB":"Europa","SSD":"África","STP":"África","SUR":"América","SVK":"Europa","SVN":"Europa","SWE":"Europa","SWZ":"África","SYC":"África","SYR":"Asia","TCD":"África","TGO":"África","THA":"Asia","TJK":"Asia","TKM":"Asia","TLS":"Asia","TON":"Oceanía","TTO":"América","TUN":"África","TUR":"Asia","TUV":"Oceanía","TWN":"Asia","TZA":"África","UGA":"África","UKR":"Europa","URY":"América","USA":"América","UZB":"Asia","VAT":"Europa","VCT":"América","VEN":"América","VNM":"Asia","VUT":"Oceanía","WSM":"Oceanía","YEM":"Asia","ZAF":"África","ZMB":"África","ZWE":"África"};
const OKRT_CONTINENT_ORDER = ['África','América','Asia','Europa','Oceanía'];

  function localizedCountryName(a2, a3){
    const names = {
      BHS:'Bahamas', BRN:'Brunéi', CPV:'Cabo Verde', CIV:'Costa de Marfil', CZE:'Chequia',
      COD:'República Democrática del Congo', COG:'República del Congo', KOR:'Corea del Sur',
      PRK:'Corea del Norte', LAO:'Laos', FSM:'Micronesia', MDA:'Moldavia', MKD:'Macedonia del Norte',
      MMR:'Myanmar', PSE:'Palestina', STP:'Santo Tomé y Príncipe', SWZ:'Esuatini',
      TLS:'Timor-Leste', TUR:'Turquía', VAT:'Ciudad del Vaticano', TWN:'Taiwán',
      USA:'Estados Unidos', GBR:'Reino Unido', RUS:'Rusia', IRN:'Irán', SYR:'Siria',
      TZA:'Tanzania', VEN:'Venezuela', VNM:'Vietnam', BOL:'Bolivia', GMB:'Gambia'
    };
    if (names[a3]) return names[a3];
    try {
      const dn = new Intl.DisplayNames(['es'], { type:'region' });
      const name = dn.of(String(a2 || '').toUpperCase());
      if (name && name !== String(a2 || '').toUpperCase()) return name;
    } catch {}
    return a3;
  }
  function buildGlobalCountryGroups(){
    const buckets = new Map(OKRT_CONTINENT_ORDER.map(label => [label, []]));
    OKRT_ALL_REGIONS.forEach(x => {
      if (!x || !x.a3 || x.a3 === 'WLD' || x.a3 === 'EUU' || OKRT_NON_COUNTRY_CODES.has(x.a3)) return;
      const continent = OKRT_CONTINENT_MAP[x.a3];
      if (!continent || !buckets.has(continent)) return;
      buckets.get(continent).push({
        value: x.a3,
        a2: x.a2,
        text: localizedCountryName(x.a2, x.a3)
      });
    });
    return OKRT_CONTINENT_ORDER
      .map(label => ({
        label: '── ' + label.toUpperCase() + ' ──',
        options: buckets.get(label).sort((a,b) => a.text.localeCompare(b.text, 'es', { sensitivity:'base' }))
      }))
      .filter(group => group.options.length);
  }
  function augmentRegionSelect(){
    const select = $('region-sel');
    if (!select || select.dataset.okrtExpanded === '1') return;
    select.dataset.okrtExpanded = '1';
    const current = select.value || 'WLD';
    const globalText = select.querySelector('option[value="WLD"]')?.textContent || 'Global';
    clearChildren(select);
    const globalOpt = document.createElement('option');
    globalOpt.value = 'WLD';
    globalOpt.textContent = globalText;
    select.appendChild(globalOpt);
    buildGlobalCountryGroups().forEach(group => {
      const grp = document.createElement('optgroup');
      grp.label = group.label;
      group.options.forEach(item => {
        const opt = document.createElement('option');
        opt.value = item.value;
        opt.textContent = item.text;
        opt.dataset.flag = item.a2;
        grp.appendChild(opt);
      });
      select.appendChild(grp);
    });
    if (select.querySelector('option[value="'+current+'"]')) select.value = current;
  }
  function cleanLabel(text){ return (text || '').replace(/^(?:[\u{1F1E6}-\u{1F1FF}]{2}|[\u{2600}-\u{27BF}\u{1F300}-\u{1FAFF}])\s*/u,'').trim(); }
  function buildFlag(code, alt){
    const ref = flagRef(code);
    if (ref === '🌍') return '<span class="okrt-flag okrt-globe" aria-hidden="true">🌍</span>';
    return '<img class="okrt-flag" src="https://flagcdn.com/w20/'+ref+'.png" srcset="https://flagcdn.com/w40/'+ref+'.png 2x" alt="'+(alt || code)+'" loading="lazy" referrerpolicy="no-referrer">';
  }
  function extractOptions(select){
    const groups = [];
    [...select.children].forEach(node => {
      if (node.tagName === 'OPTGROUP') {
        groups.push({ label: node.label || '', options: [...node.querySelectorAll('option')].map(o => ({ value:o.value, text: cleanLabel(o.textContent), raw:o.textContent || '' })) });
      } else if (node.tagName === 'OPTION') {
        groups.push({ label:'', options:[{ value:node.value, text: cleanLabel(node.textContent), raw:node.textContent || '' }] });
      }
    });
    return groups.filter(g => g.options.length);
  }
  function installFlagSelector(){
    const select = $('region-sel');
    if (!select || select.dataset.okrtFlagsReady === '1') return;
    select.dataset.okrtFlagsReady = '1';
    const shell = document.createElement('div');
    shell.className = 'okrt-region-shell';
    mountSafeHTML(shell, '<button type="button" class="okrt-region-btn" aria-haspopup="listbox" aria-expanded="false"><span class="okrt-region-left"></span><span class="okrt-region-chevron">▾</span></button><div class="okrt-region-menu" role="listbox"></div>');
    select.insertAdjacentElement('afterend', shell);
    const btn = shell.querySelector('.okrt-region-btn');
    const left = shell.querySelector('.okrt-region-left');
    const menu = shell.querySelector('.okrt-region-menu');
    const groups = extractOptions(select);
    mountSafeHTML(menu, groups.map(group => '<div class="okrt-region-group">'+(group.label ? '<div class="okrt-region-group-title">'+group.label.replace(/─/g,'').trim()+'</div>' : '') + group.options.map(opt => '<button type="button" class="okrt-region-item" data-value="'+opt.value+'">'+buildFlag(opt.value, opt.text)+'<span class="okrt-region-name">'+opt.text+'</span></button>').join('') + '</div>').join(''));
    function sync(){
      const current = select.value || 'WLD';
      const option = select.querySelector('option[value="'+current+'"]');
      const text = cleanLabel(option ? option.textContent : current);
      mountSafeHTML(left, buildFlag(current, text) + '<span class="okrt-region-name">'+text+'</span>');
      menu.querySelectorAll('.okrt-region-item').forEach(item => item.classList.toggle('active', item.dataset.value === current));
      btn.setAttribute('aria-expanded', shell.classList.contains('open') ? 'true' : 'false');
    }
    btn.addEventListener('click', (e) => { e.stopPropagation(); shell.classList.toggle('open'); sync(); });
    menu.addEventListener('click', (e) => {
      const item = e.target.closest('.okrt-region-item');
      if (!item) return;
      select.value = item.dataset.value;
      select.dispatchEvent(new Event('change', { bubbles:true }));
      if (typeof window.onRegionChange === 'function') window.onRegionChange();
      shell.classList.remove('open');
      sync();
    });
    document.addEventListener('click', (e) => { if (!shell.contains(e.target)) { shell.classList.remove('open'); btn.setAttribute('aria-expanded','false'); } });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { shell.classList.remove('open'); btn.setAttribute('aria-expanded','false'); } });
    select.addEventListener('change', sync);
    sync();
  }

  function categoryKeys(){ return Array.isArray(window.CAT_KEYS) && window.CAT_KEYS.length ? window.CAT_KEYS : ['eco','geo','health','climate','social','tech','food','mental','energy','demo','urban','science','justice','finance','ocean','bio']; }
  function regionName(){
    const sel = $('region-sel'); if (!sel) return 'Global';
    const opt = sel.options[sel.selectedIndex];
    return cleanLabel(opt ? opt.textContent : 'Global');
  }
  function readData(){
    const code = $('region-sel')?.value || 'WLD';
    const DATA = window.DATA || {};
    return { code, data: DATA[code] || DATA.WLD || {} };
  }
  function gauge(key){
    const raw = $('n-'+key)?.textContent || '';
    const m = raw.match(/-?\d+(?:\.\d+)?/);
    return m ? Math.round(Number(m[0])) : null;
  }
  function dominant(keys, data){
    const arr = keys.map(k => ({ key:k, score: gauge(k) ?? Math.round(Number(data?.[k]?.score || 0)) })).filter(x => Number.isFinite(x.score));
    arr.sort((a,b)=>b.score-a.score);
    return arr[0] || null;
  }
  function countFields(data){
    const entries = Object.entries(data || {});
    if (!entries.length) {
      return categoryKeys().filter(k => gauge(k) !== null || Number.isFinite(Number(data?.[k]?.score))).length || categoryKeys().length;
    }
    let total = 0;
    for (const [k,v] of entries) {
      if (k === 'name' || k === 'iso' || k === 'code') continue;
      if (v && typeof v === 'object' && !Array.isArray(v)) {
        const nested = Object.keys(v).filter(sub => v[sub] !== null && v[sub] !== undefined && v[sub] !== '').length;
        total += nested || 1;
      } else if (v !== null && v !== undefined && v !== '') {
        total += 1;
      }
    }
    return total || categoryKeys().filter(k => gauge(k) !== null).length || categoryKeys().length;
  }
  function getLabel(key){
    const map = {eco:'Económico',geo:'Geopolítico',health:'Sanitario',climate:'Climático',social:'Cohesión',tech:'Tecnológico',food:'Seg. alimentaria',mental:'Salud mental',energy:'Energético',demo:'Demográfico',urban:'Urbano',science:'Ciencia',justice:'Justicia',finance:'Financiero',ocean:'Océanos',bio:'Bioseguridad'};
    return map[key] || key;
  }
  function installDataBlock(){
    if ($('okrt-data-card')) return;
    const banner = $('gbanner'); if (!banner) return;
    const card = document.createElement('div');
    card.className = 'okrt-data-card';
    card.id = 'okrt-data-card';
    mountSafeHTML(card, '<div class="okrt-data-head"><div class="okrt-data-title">DATOS RECOGIDOS</div><div class="okrt-data-region" id="okrt-data-region">—</div></div><div class="okrt-data-grid">'
      + '<div class="okrt-data-pill"><div class="okrt-data-k">REGIÓN ACTIVA</div><div class="okrt-data-v" id="okrt-dr-region">—</div><div class="okrt-data-s">Selección sincronizada con el dashboard principal.</div></div>'
      + '<div class="okrt-data-pill"><div class="okrt-data-k">CATEGORÍAS</div><div class="okrt-data-v" id="okrt-dr-cats">16</div><div class="okrt-data-s">Bloques monitorizados por el motor analítico.</div></div>'
      + '<div class="okrt-data-pill"><div class="okrt-data-k">SCORE GLOBAL</div><div class="okrt-data-v" id="okrt-dr-score">—</div><div class="okrt-data-s">Valor agregado visible en el panel superior.</div></div>'
      + '<div class="okrt-data-pill"><div class="okrt-data-k">RIESGO DOMINANTE</div><div class="okrt-data-v" id="okrt-dr-dom">—</div><div class="okrt-data-s">Categoría con mayor presión en la lectura actual.</div></div>'
      + '<div class="okrt-data-pill"><div class="okrt-data-k">CAMPOS DEL DATASET</div><div class="okrt-data-v" id="okrt-dr-fields">—</div><div class="okrt-data-s">Campos estructurados detectados para la región.</div></div>'
      + '<div class="okrt-data-pill"><div class="okrt-data-k">SHOCKS ACTIVOS</div><div class="okrt-data-v" id="okrt-dr-shocks">—</div><div class="okrt-data-s">Escenarios manuales activos en esta sesión.</div></div>'
      + '</div>');
    banner.insertAdjacentElement('beforebegin', card);
  }
  function updateDataBlock(){
    if (!$('okrt-data-card')) return;
    const {code, data} = readData();
    const keys = categoryKeys();
    const name = regionName();
    const score = $('gnum')?.textContent?.trim() || '—';
    const dom = dominant(keys, data);
    const shocks = window.ShockSim?.shocks || {};
    const activeShocks = Object.values(shocks).filter(v => Math.abs(Number(v)||0) >= 1).length;
    $('okrt-data-region').textContent = code + ' · ' + name;
    $('okrt-dr-region').textContent = name;
    $('okrt-dr-cats').textContent = String(keys.length);
    $('okrt-dr-score').textContent = score && score !== '--' ? score + '/100' : '—';
    $('okrt-dr-dom').textContent = dom ? getLabel(dom.key) + ' · ' + dom.score : '—';
    $('okrt-dr-fields').textContent = String(countFields(data));
    $('okrt-dr-shocks').textContent = String(activeShocks);
  }
  function init(){
    augmentRegionSelect();
    installFlagSelector();
    installDataBlock();
    updateDataBlock();
    const sel = $('region-sel');
    if (sel && !sel.dataset.okrtDataBound) {
      sel.dataset.okrtDataBound = '1';
      sel.addEventListener('change', () => setTimeout(updateDataBlock, 120));
    }
    const analyze = $('analyze-btn');
    if (analyze && !analyze.dataset.okrtDataBound) {
      analyze.dataset.okrtDataBound = '1';
      analyze.addEventListener('click', () => setTimeout(updateDataBlock, 300));
    }
    const scenario = $('scenario-btn');
    if (scenario && !scenario.dataset.okrtDataBound) {
      scenario.dataset.okrtDataBound = '1';
      scenario.addEventListener('click', () => setTimeout(updateDataBlock, 300));
    }
    setTimeout(updateDataBlock, 600);
    setTimeout(updateDataBlock, 1400);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
  window.addEventListener('load', () => setTimeout(init, 150));
})();

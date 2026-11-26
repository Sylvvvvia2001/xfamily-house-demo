/* Read-only device cards. Values come solely from the scenario state timeline. */
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const human = value => String(value ?? '').replace(/^synthetic:\/\//, '').replace(/[_-]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
const clamp = value => Math.max(0, Math.min(100, value));
const number = value => typeof value === 'number' && Number.isFinite(value);
export const knownValue = entry => entry && typeof entry === 'object' && 'status' in entry ? (entry.status === 'known' ? entry.value : undefined) : entry;
const niceNumber = n => Number(n).toLocaleString('en-US', {maximumFractionDigits: 1});

const paths = {
  light: '<path d="M8.5 14c-1.6-1.2-2.5-2.8-2.5-4.6a6 6 0 0 1 12 0c0 1.8-.9 3.4-2.5 4.6l-1 2h-5l-1-2Z"/><path d="M9.5 19h5M10.5 22h3M12 0v1M2 9H0m24 0h-2M4 2l1.5 1.5M20 2l-1.5 1.5"/>',
  lamp: '<path d="m7 3-3 10h16L17 3ZM12 13v8M8 22h8"/>',
  tv: '<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8m-4-4v4"/>',
  speaker: '<rect x="5" y="2" width="14" height="20" rx="3"/><circle cx="12" cy="15" r="4"/><circle cx="12" cy="6" r="1"/>',
  camera: '<path d="M3 7h13v11H3zM16 11l5-3v10l-5-3M7 22h5m-2-4v4"/>',
  climate: '<rect x="2" y="3" width="20" height="10" rx="2"/><path d="M5 9h14M6 16v3m6-3v5m6-5v3"/>',
  robot: '<circle cx="12" cy="13" r="9"/><path d="M7 17h10M10 4V2h4v2"/><circle cx="12" cy="10" r="1"/>',
  curtain: '<path d="M2 3h20M4 3v18l6-3V3m10 0v18l-6-3V3M7 4v11m10-11v11"/>',
  blind: '<path d="M3 3h18M4 6h16M4 9h16M4 12h16M4 15h16M4 18h16M20 3v19"/>',
  plug: '<path d="M8 2v5m8-5v5M5 7h14v4a7 7 0 0 1-14 0V7Zm7 11v4"/>',
  sensor: '<circle cx="12" cy="12" r="2"/><path d="M8 6a7 7 0 0 0 0 12m8-12a7 7 0 0 1 0 12M5 3a11 11 0 0 0 0 18M19 3a11 11 0 0 1 0 18"/>',
  coffee: '<path d="M4 2h16v5H4zM6 7v10m12-10v10M3 21h18M7 13h9v4a4 4 0 0 1-8 0v-4m8 1h2a2 2 0 0 1 0 4h-2M12 7v3"/>',
  fridge: '<rect x="5" y="1" width="14" height="22" rx="2"/><path d="M5 9h14M8 4v2m0 6v4"/>',
  oven: '<rect x="2" y="3" width="20" height="18" rx="2"/><path d="M2 8h20M6 5.5h.1m3 0h.1M5 11h14v7H5z"/>',
  blender: '<path d="M7 2h10l-1 11H8L7 2Zm10 2h3v6h-3M9 13l-3 8h12l-3-8M11 17h2"/>',
  cooker: '<path d="M4 9h16v6a6 6 0 0 1-6 6h-4a6 6 0 0 1-6-6V9Zm0 0a8 8 0 0 1 16 0M10 2h4M1 12h3m16 0h3M10 17h4"/>',
  dishwasher: '<rect x="3" y="2" width="18" height="20" rx="2"/><path d="M3 7h18m-5-2h2M8 12a5 5 0 0 0 8 6M8 11v7m-2-7v3m4-3v3"/>',
  water: '<path d="M8 2h11v20H5v-4h10V8H8V2Zm1 6v3m-2 3h5v4H7zM17 4v11"/>',
  washer: '<rect x="3" y="2" width="18" height="20" rx="2"/><circle cx="12" cy="14" r="5"/><path d="M6 6h.1m3 0h.1M12 11a3 3 0 0 1 0 6"/>',
  purifier: '<rect x="5" y="2" width="14" height="20" rx="4"/><path d="M9 6h6M8 15h8m-8 3h8"/>',
  humidifier: '<path d="M6 11h12l2 9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2l2-9Zm6 7h.1M8 8c-3-3 3-4 0-7m4 7c-3-3 3-4 0-7m4 7c-3-3 3-4 0-7"/>',
  router: '<path d="M4 14h16v7H4zM6 14V8m12 6V8M8 18h.1m3 0h.1M8 5a6 6 0 0 1 8 0M5 2a10 10 0 0 1 14 0"/>',
  printer: '<path d="M6 8V2h12v6M6 17H3V8h18v9h-3M6 14h12v8H6zM17 11h1"/>',
  screen: '<path d="M2 3h20M4 4v13h16V4M12 17v5m-3 0h6"/>',
  projector: '<rect x="2" y="7" width="20" height="12" rx="2"/><circle cx="15" cy="13" r="4"/><path d="M5 10h2m-2 3h2m-2 3h2M6 19v3m12-3v3"/>',
  heater: '<rect x="3" y="4" width="18" height="15" rx="5"/><path d="M7 19v4m10-4v4M12 7v6m-2 1a2 2 0 1 0 4 0"/>',
  door: '<path d="M4 22V3l12-2v21M16 3h4v19M1 22h22M12 12h.1"/>',
  lock: '<rect x="5" y="10" width="14" height="12" rx="2"/><path d="M8 10V6a4 4 0 0 1 8 0v4M12 15v3"/>',
  bell: '<path d="M4 17h16l-2-3V9a6 6 0 0 0-12 0v5l-2 3Zm5 3a3 3 0 0 0 6 0M12 1v2"/>',
  sofa: '<path d="M5 11V5h14v6M3 10h3v6h12v-6h3v11H3V10Zm3 11v2m12-2v2"/>',
  dining: '<path d="M3 9h18M5 9v13m14-13v13M8 3v6m8-6v6M8 3h8"/>',
  kitchen: '<path d="M3 3h18v18H3zM3 9h18M7 6h.1m4 0h.1M7 12h10v6H7z"/>',
  study: '<path d="M2 12h20M4 12v10m16-10v10M6 3h12v7H6zM10 12v-2"/>',
  bed: '<path d="M3 4v17m18-9v9M3 17h18M6 8h5v5H6zM3 13h18v4M12 8h6l3 5"/>',
  bath: '<path d="M2 13h20v2a6 6 0 0 1-6 6H8a6 6 0 0 1-6-6v-2ZM5 13V4a3 3 0 0 1 6 0M7 21v2m10-2v2"/>',
  balcony: '<path d="M2 12h20M4 12v10m5-10v10m6-10v10m5-10v10M2 22h20M12 1v2m-7 1 2 2m12-2-2 2M6 10a6 6 0 0 1 12 0"/>',
  device: '<rect x="4" y="2" width="16" height="20" rx="3"/><path d="M9 5h6M11 19h2"/>'
};
const svg = key => `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round">${paths[key] || paths.device}</svg>`;
const roomIcon = {'Living room':'sofa','Dining room':'dining',Kitchen:'kitchen',Study:'study',Bedroom:'bed',Bathroom:'bath',Balcony:'balcony',Entry:'door'};

export function deviceKind(device) {
  const id = `${device.id} ${device.name}`.toLowerCase();
  for (const [pattern, kind] of [
    [/ceiling_light|downlight/,'light'], [/lamp/,'lamp'], [/projector_screen/,'screen'], [/projector_speaker|speaker/,'speaker'],
    [/smart_tv/,'tv'], [/projector/,'projector'], [/camera/,'camera'], [/air_conditioner/,'climate'], [/robot_vacuum/,'robot'],
    [/curtain/,'curtain'], [/blind/,'blind'], [/smart_plug/,'plug'], [/multisensor/,'sensor'], [/coffee_machine/,'coffee'],
    [/refrigerator/,'fridge'], [/microwave|oven/,'oven'], [/blender/,'blender'], [/rice_cooker/,'cooker'], [/dishwasher/,'dishwasher'],
    [/water_dispenser/,'water'], [/washing_machine|tumble_dryer/,'washer'], [/air_purifier/,'purifier'], [/humidifier/,'humidifier'],
    [/router/,'router'], [/printer/,'printer'], [/water_heater/,'heater'], [/door_sensor/,'door'], [/smart_lock/,'lock'], [/doorbell/,'bell']
  ]) if (pattern.test(id)) return kind;
  return 'device';
}

export function formatField(key, entry) {
  if (entry?.status && entry.status !== 'known') return entry.status === 'not_applicable' ? 'Not applicable' : 'Unknown';
  const value = knownValue(entry);
  if (value === undefined) return 'Unknown';
  if (value === null) return 'Not set';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (number(value)) {
    if (/_temperature_c$|^temperature_c$/.test(key)) return `${niceNumber(value)} °C`;
    if (key.endsWith('_k')) return `${niceNumber(value)} K`;
    if (key.includes('percent') || ['battery_level','volume'].includes(key)) return `${niceNumber(value)}%`;
    if (key.endsWith('_lux')) return `${niceNumber(value)} lx`;
    if (key.endsWith('_mbps')) return `${niceNumber(value)} Mbps`;
    if (key.endsWith('_ms')) return `${niceNumber(value)} ms`;
    if (key.endsWith('_s')) return value ? `${Math.floor(value / 60)}m ${Math.round(value % 60)}s` : '0s';
    return niceNumber(value);
  }
  if (typeof value === 'object') return JSON.stringify(value);
  if (key.endsWith('_url') || key.endsWith('_at')) return String(value);
  return human(value);
}

export function describeDevice(device, state = {}, initial = {}) {
  const value = key => knownValue(state[key]);
  const kind = deviceKind(device), power = value('is_on'), operating = value('operating_state'), playback = value('playback_state');
  let primary = power === false ? 'Off' : power === true ? 'On' : 'Unknown';
  let secondary = '', tone = 'neutral', bar = null;
  let active = power === true || (power !== false && typeof operating === 'string' && !['idle','off','completed'].includes(operating));
  const status = operating ?? playback;
  if (power !== false && status) primary = human(status);
  const field = key => formatField(key, state[key]);
  const temp = key => number(value(key)) ? `${niceNumber(value(key))}°C` : null;
  const compact = values => values.filter(v => v !== null && v !== undefined && v !== '').join(' · ');
  const meter = (label, amount, color = 'blue') => number(amount) ? {label, value:clamp(amount), color} : null;

  if (kind === 'light' || kind === 'lamp') {
    // Ceiling light schema uses 0–255; the other light schemas use percent.
    const raw = value('brightness'), max = /ceiling_light/.test(device.id) ? 255 : 100;
    const brightness = number(raw) ? Math.round(clamp(raw / max * 100)) : null;
    primary = power === false ? 'Off' : power === true ? (brightness === null ? 'On' : `On · ${brightness}%`) : 'Unknown';
    const kelvin=value('color_temperature_k');
    secondary = number(kelvin) ? `${kelvin} K · ${kelvin<=3500?'Warm white':kelvin<=4500?'Neutral white':'Cool white'}` : 'Room lighting';
    tone = power === true ? 'amber' : 'neutral';
    bar = brightness !== null ? {label:power === false ? `Saved brightness ${brightness}%` : `Brightness ${brightness}%`,value:power === false ? 0 : brightness,color:'amber'} : null;
  } else if (['curtain','blind','screen'].includes(kind)) {
    const open = value(kind === 'screen' ? 'extension_percent' : 'position_percent_open');
    const motion = value('motion_state');
    primary = number(open) ? (open === 0 ? (kind === 'screen' ? 'Retracted' : 'Closed') : open === 100 ? (kind === 'screen' ? 'Extended' : 'Open') : `${open}% ${kind === 'screen' ? 'extended' : 'open'}`) : 'Unknown position';
    secondary = motion === 'idle' ? 'Motor idle' : motion ? human(motion) : 'Motion unknown';
    active = number(open) && open > 0; tone = active ? 'violet' : 'neutral';
    bar = meter(kind === 'screen' ? 'Extension' : 'Open', open, 'violet');
  } else if (['tv','speaker','projector'].includes(kind)) {
    primary = power === false ? 'Off' : playback ? human(playback) : power === true ? 'On' : 'Unknown';
    secondary = compact([number(value('volume')) ? `Volume ${value('volume')}%` : null,value('media_url') ? human(value('media_url')) : null]);
    tone = active ? 'blue' : 'neutral';
    if (power !== false) bar = meter('Volume', value('volume'));
  } else if (kind === 'sensor') {
    primary = value('motion_state') === 'detected' ? 'Motion detected' : value('motion_state') === 'idle' ? 'No motion' : field('motion_state');
    secondary = compact([temp('temperature_c'),number(value('humidity_percent')) ? `${value('humidity_percent')}% humidity` : null,number(value('illuminance_lux')) ? `${value('illuminance_lux')} lx` : null]);
    active = value('motion_state') === 'detected'; tone = active ? 'blue' : 'neutral';
  } else if (kind === 'climate') {
    primary = power === false ? 'Off' : compact([human(value('mode')),temp('target_temperature_c')]);
    secondary = compact([temp('target_temperature_c') ? `Target ${temp('target_temperature_c')}` : null,value('profile') ? human(value('profile')) : null]);
    tone = active ? 'blue' : 'neutral';
  } else if (kind === 'fridge') {
    primary = power === false ? 'Off' : value('door_state') ? `Door ${String(value('door_state')).toLowerCase()}` : primary;
    secondary = compact([temp('refrigerator_temperature_c') ? `Fridge ${temp('refrigerator_temperature_c')}` : null,temp('freezer_temperature_c') ? `Freezer ${temp('freezer_temperature_c')}` : null]);
    tone = power===false?'neutral':value('door_state') === 'open' ? 'amber' : 'blue';
  } else if (kind === 'lock') {
    primary = value('lock_state') ? human(value('lock_state')) : 'Unknown'; active = value('lock_state') === 'unlocked';
    secondary = number(value('battery_level')) ? `Battery ${value('battery_level')}%` : '';
    tone = active ? 'amber' : 'green';
  } else if (kind === 'door') {
    primary = value('door_state') ? human(value('door_state')) : 'Unknown'; active = value('door_state') === 'open';
    secondary = 'Contact sensor'; tone = active ? 'blue' : 'neutral';
  } else if (kind === 'bell') {
    primary = value('chime_state') === 'idle' ? 'Quiet' : field('chime_state');
    secondary = value('recording_state') === 'recording' ? 'Recording visitor' : value('chime_state')==='idle' ? 'No active ring' : '';
    active = value('chime_state') !== 'idle' && value('chime_state') !== undefined; tone = active ? 'amber' : 'neutral';
  } else if (kind === 'camera') {
    primary = power === false ? 'Off' : value('recording_state') ? human(value('recording_state')) : primary;
    secondary = value('mode') ? `${human(value('mode'))} mode` : ''; tone = active ? 'blue' : 'neutral';
  } else if (kind === 'router') {
    primary = power === false ? 'Off' : value('internet_state') ? human(value('internet_state')) : primary;
    secondary = compact([number(value('connected_device_count')) ? `${value('connected_device_count')} devices` : null,number(value('current_download_rate_mbps')) ? `↓ ${value('current_download_rate_mbps')} Mbps` : null]);
    tone = active ? 'green' : 'neutral';
  } else if (kind === 'purifier') {
    secondary = compact([value('air_quality_level') ? `Air quality: ${String(value('air_quality_level')).toLowerCase()}` : null,value('mode') ? `${human(value('mode'))} mode` : null]); tone = active ? 'green' : 'neutral';
  } else if (kind === 'humidifier') {
    secondary = number(value('water_level_percent')) ? `Water level ${value('water_level_percent')}%` : '';
    bar = meter('Water level', value('water_level_percent')); tone = active ? 'blue' : 'neutral';
  } else if (kind === 'heater') {
    primary = power === false ? 'Off' : value('is_heating')===true ? 'Heating' : power===true ? 'Ready' : 'Unknown';
    secondary = compact([temp('current_water_temperature_c'),temp('target_water_temperature_c') ? `Target ${temp('target_water_temperature_c')}` : null]); tone = active ? 'amber' : 'neutral';
  } else if (kind === 'water') {
    secondary = compact([temp('hot_water_temperature_c') ? `Hot ${temp('hot_water_temperature_c')}` : null,temp('cold_water_temperature_c') ? `Cold ${temp('cold_water_temperature_c')}` : null]); tone = active ? 'blue' : 'neutral';
  } else {
    const mode = ['selected_beverage','cleaning_mode','wash_mode','dry_mode','cooking_mode','mode','power'].find(k => value(k) !== undefined && value(k) !== null);
    secondary = compact([mode ? human(value(mode)) : null,number(value('remaining_time_s')) && value('remaining_time_s') > 0 ? `${Math.ceil(value('remaining_time_s') / 60)} min remaining` : null,value('door_state') ? `Door ${value('door_state')}` : null]);
    tone = active ? (kind === 'coffee' || kind === 'cooker' || kind === 'oven' ? 'amber' : 'blue') : 'neutral';
    if (kind === 'robot') bar = meter('Battery', value('battery_level'), 'green');
  }
  return {id:device.id,name:device.name,room:device.room,kind,primary:primary || 'Unknown',secondary,tone,active:!!active,bar,
    changed:JSON.stringify(state) !== JSON.stringify(initial),
    fields:Object.entries(state).map(([key,entry])=>({key,label:human(key).replace(/ C$/, ' (°C)').replace(/ K$/, ' (K)').replace(/ S$/, ' (seconds)'),value:formatField(key,entry)}))};
}

function clock(time) {
  if (typeof time === 'string') return time;
  if (!number(time)) return '';
  const sec = Math.max(0, Math.floor(time));
  return `${String(Math.floor(sec/3600)).padStart(2,'0')}:${String(Math.floor(sec/60)%60).padStart(2,'0')}:${String(sec%60).padStart(2,'0')}`;
}

export function createDeviceDashboard({container,devices,initial = {}}) {
  if (!container) throw new Error('The device dashboard needs a container.');
  const byId = new Map(devices.map(device => [device.id,device]));
  if (byId.size !== devices.length) throw new Error('Duplicate device IDs in dashboard.');
  container.classList.add('device-dashboard');
  container.setAttribute('aria-label','Read-only device states at the selected time');
  container.innerHTML = '<div class="home-status-summary"></div><div class="home-status-rooms"></div>';
  const summary = container.querySelector('.home-status-summary'), roomContainer = container.querySelector('.home-status-rooms');
  const cardNodes = new Map(), roomNodes = new Map();
  const rooms = [...new Set(devices.map(device=>device.room))];
  for (const room of rooms) {
    const section = document.createElement('section'); section.className='device-room'; section.dataset.room=room;
    section.innerHTML = `<div class="device-room-heading"><h4>${svg(roomIcon[room])}<span>${escape(room)}</span></h4><div class="room-environment"></div></div><div class="device-card-grid"></div>`;
    roomContainer.append(section); roomNodes.set(room, section);
    const grid = section.querySelector('.device-card-grid');
    for (const device of devices.filter(d=>d.room===room)) {
      const card = document.createElement('details'); card.className='device-card'; card.dataset.deviceId=device.id;
      card.innerHTML = `<summary aria-label="${escape(device.name)}: show state details"><div class="device-card-main"><span class="device-icon">${svg(deviceKind(device))}</span><span class="device-copy"><strong>${escape(device.name)}</strong><span class="device-primary"></span><small class="device-secondary"></small></span><span class="device-expand" aria-hidden="true">⌄</span></div><div class="device-meter" hidden><span></span></div></summary><dl class="device-fields"></dl><div class="device-identity">${escape(device.id)}</div>`;
      grid.append(card); cardNodes.set(device.id,{card,signature:null});
    }
  }
  function render(states, filter='all', time) {
    const selected = devices.filter(d=>filter==='all'||d.room===filter);
    const models = new Map(devices.map(d=>[d.id,describeDevice(d,states?.[d.id] ?? initial[d.id] ?? {},initial[d.id] ?? {})]));
    const activeCount=selected.filter(d=>models.get(d.id).active).length;
    const summaryHTML=`<div><span class="home-status-dot"></span><strong>${selected.length} devices</strong><span>${activeCount} active</span></div><time>${escape(clock(time))}</time><span class="read-only-label">READ ONLY</span>`;
    if (summary.innerHTML!==summaryHTML) summary.innerHTML=summaryHTML;
    for (const [room,section] of roomNodes) {
      section.hidden=filter!=='all'&&room!==filter;
      const sensor=devices.find(d=>d.room===room&&deviceKind(d)==='sensor');
      const state=states?.[sensor?.id] ?? initial[sensor?.id] ?? {};
      const temp=knownValue(state.temperature_c), humidity=knownValue(state.humidity_percent);
      const env=section.querySelector('.room-environment');
      const envHTML=[number(temp)?`<span title="Recorded room temperature"><b class="temperature-mark">°</b>${niceNumber(temp)}°C</span>`:'',number(humidity)?`<span title="Recorded room humidity"><b class="humidity-mark">◈</b>${niceNumber(humidity)}%</span>`:''].join('');
      if(env.innerHTML!==envHTML)env.innerHTML=envHTML;
    }
    for (const device of selected) {
      const model=models.get(device.id), node=cardNodes.get(device.id), signature=JSON.stringify(model);
      if(node.signature===signature)continue;
      node.signature=signature; const card=node.card;
      card.dataset.tone=model.tone; card.dataset.active=String(model.active); card.dataset.changed=String(model.changed);
      card.querySelector('.device-primary').textContent=model.primary;
      card.querySelector('.device-secondary').textContent=model.secondary;
      card.querySelector('.device-secondary').hidden=!model.secondary;
      card.querySelector('summary').setAttribute('aria-label',`${device.name}: ${model.primary}. Show recorded state details.`);
      const meter=card.querySelector('.device-meter'); meter.hidden=!model.bar;
      if(model.bar){meter.dataset.tone=model.bar.color;meter.title=`${model.bar.label}${model.bar.label.includes('%')?'':` ${Math.round(model.bar.value)}%`}`;meter.setAttribute('role','meter');meter.setAttribute('aria-label',model.bar.label);meter.setAttribute('aria-valuenow',String(model.bar.value));meter.setAttribute('aria-valuemin','0');meter.setAttribute('aria-valuemax','100');meter.firstElementChild.style.width=`${model.bar.value}%`;}
      card.querySelector('.device-fields').innerHTML=model.fields.map(f=>`<div><dt>${escape(f.label)}</dt><dd>${escape(f.value)}</dd></div>`).join('')||'<div><dt>State</dt><dd>No recorded fields</dd></div>';
    }
    return {deviceCount:selected.length,activeCount,roomCount:[...roomNodes.values()].filter(n=>!n.hidden).length};
  }
  return {render};
}

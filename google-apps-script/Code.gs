const SHEET_HEADERS = {
  Users: ['id', 'email', 'full_name', 'role', 'active', 'password_salt', 'password_hash', 'must_change_password', 'created_at', 'last_login_at'],
  Clients: ['id', 'name', 'company', 'email', 'phone', 'emirate', 'vat_number', 'notes', 'photo_ref', 'created_at'],
  Bookings: ['id', 'client_id', 'session', 'studio', 'date', 'start', 'end', 'status', 'assigned_staff_email', 'package', 'requests', 'created_at'],
  Tasks: ['id', 'title', 'category', 'assignee_email', 'due_at', 'status', 'created_by_email', 'created_at', 'completed_at'],
  Equipment: ['id', 'name', 'category', 'serial', 'status', 'studio', 'assigned_to_email', 'photo_ref', 'created_at'],
  Episodes: ['id', 'name', 'show', 'client_id', 'editor_email', 'date', 'status', 'created_at'],
  Payments: ['id', 'invoice', 'client_id', 'amount', 'method', 'status', 'created_at', 'payment_link', 'receipt_ref'],
  Memberships: ['id', 'client_id', 'plan', 'start', 'renewal', 'included_hours', 'used_hours', 'status'],
};

function doPost(event) {
  try {
    const request = JSON.parse(event.postData.contents || '{}');
    if (!constantTimeEquals_(request.apiSecret, PropertiesService.getScriptProperties().getProperty('API_SHARED_SECRET') || '')) {
      return json_({ ok: false, error: 'Unauthorized integration request.' });
    }
    return json_({ ok: true, data: dispatch_(request) });
  } catch (error) {
    return json_({ ok: false, error: String(error && error.message || error) });
  }
}

function bootstrapAdmin() {
  const properties = PropertiesService.getScriptProperties();
  const spreadsheetId = properties.getProperty('SPREADSHEET_ID');
  const email = (properties.getProperty('INITIAL_ADMIN_EMAIL') || '').trim().toLowerCase();
  const password = properties.getProperty('INITIAL_ADMIN_PASSWORD') || '';
  if (!spreadsheetId || !email || password.length < 12) throw new Error('Set SPREADSHEET_ID, INITIAL_ADMIN_EMAIL, and a 12+ character INITIAL_ADMIN_PASSWORD in Script Properties first.');
  const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
  Object.keys(SHEET_HEADERS).forEach(function (name) {
    let sheet = spreadsheet.getSheetByName(name);
    if (!sheet) sheet = spreadsheet.insertSheet(name);
    const expected = SHEET_HEADERS[name];
    const current = sheet.getRange(1, 1, 1, expected.length).getValues()[0];
    if (current.map(String).join('\u001f') !== expected.join('\u001f')) sheet.getRange(1, 1, 1, expected.length).setValues([expected]);
  });
  const users = readRows_('Users');
  if (users.some(function (user) { return user.email.toLowerCase() === email; })) throw new Error('That admin account already exists.');
  const salt = Utilities.getUuid() + Utilities.getUuid();
  appendRow_('Users', { id: Utilities.getUuid(), email: email, full_name: email.split('@')[0], role: 'admin', active: true, password_salt: salt, password_hash: passwordHash_(password, salt), must_change_password: false, created_at: new Date().toISOString(), last_login_at: '' });
  properties.deleteProperty('INITIAL_ADMIN_PASSWORD');
  Logger.log('Admin account created for ' + email + '. The initial password was removed from Script Properties.');
}

function dispatch_(request) {
  const action = String(request.action || '');
  const payload = request.payload || {};
  if (action === 'login') return login_(payload);
  if (action === 'changePassword') return changePassword_(payload);
  const actor = payload.actor;
  if (!actor || !actor.email || !actor.role) throw new Error('A verified app session is required.');
  if (action === 'listStaff') {
    requireRole_(actor, ['admin']);
    return readRows_('Users').filter(function (user) { return String(user.active).toLowerCase() !== 'false'; }).map(publicUser_);
  }
  if (action === 'createStaff') {
    requireRole_(actor, ['admin']);
    const email = String(payload.email || '').trim().toLowerCase();
    const name = String(payload.fullName || '').trim();
    const role = String(payload.role || '');
    if (!/^\S+@\S+\.\S+$/.test(email) || name.length < 2 || !['manager', 'reception', 'editor', 'finance'].includes(role)) throw new Error('Enter a valid email, name, and staff role.');
    const users = readRows_('Users');
    if (users.some(function (user) { return user.email.toLowerCase() === email; })) throw new Error('That email already has an account.');
    const temporaryPassword = randomPassword_();
    const salt = Utilities.getUuid() + Utilities.getUuid();
    const now = new Date().toISOString();
    const user = { id: Utilities.getUuid(), email: email, full_name: name, role: role, active: true, password_salt: salt, password_hash: passwordHash_(temporaryPassword, salt), must_change_password: true, created_at: now, last_login_at: '' };
    appendRow_('Users', user);
    return { user: publicUser_(user), temporaryPassword: temporaryPassword };
  }
  if (action === 'listTasks') {
    const rows = readRows_('Tasks');
    return (actor.role === 'admin' ? rows : rows.filter(function (task) { return task.assignee_email.toLowerCase() === actor.email.toLowerCase() || task.created_by_email.toLowerCase() === actor.email.toLowerCase(); })).reverse();
  }
  if (action === 'createTask') {
    requireRole_(actor, ['admin', 'manager']);
    const title = String(payload.title || '').trim();
    const assignee = String(payload.assigneeEmail || '').trim().toLowerCase();
    const user = readRows_('Users').find(function (item) { return item.email.toLowerCase() === assignee && String(item.active).toLowerCase() !== 'false'; });
    if (title.length < 2 || !user) throw new Error('Enter a task title and choose an active staff account.');
    const row = { id: Utilities.getUuid(), title: title, category: String(payload.category || 'operations'), assignee_email: user.email, due_at: String(payload.dueAt || ''), status: 'open', created_by_email: actor.email, created_at: new Date().toISOString(), completed_at: '' };
    appendRow_('Tasks', row);
    return row;
  }
  if (action === 'updateTask') {
    const id = String(payload.id || '');
    const rows = readRows_('Tasks');
    const task = rows.find(function (item) { return item.id === id; });
    if (!task) throw new Error('Task not found.');
    if (actor.role !== 'admin' && task.assignee_email.toLowerCase() !== actor.email.toLowerCase() && task.created_by_email.toLowerCase() !== actor.email.toLowerCase()) throw new Error('You cannot change this task.');
    const complete = Boolean(payload.done);
    updateRow_('Tasks', id, { status: complete ? 'complete' : 'open', completed_at: complete ? new Date().toISOString() : '' });
    return { id: id, done: complete };
  }
  throw new Error('Unknown action.');
}

function login_(payload) {
  const email = String(payload.email || '').trim().toLowerCase();
  const password = String(payload.password || '');
  const cache = CacheService.getScriptCache();
  const attemptsKey = 'login-attempts:' + Utilities.base64EncodeWebSafe(email);
  if (Number(cache.get(attemptsKey) || 0) >= 5) throw new Error('Too many sign-in attempts. Wait 15 minutes and try again.');
  const user = readRows_('Users').find(function (row) { return row.email.toLowerCase() === email; });
  if (!user || String(user.active).toLowerCase() === 'false' || passwordHash_(password, user.password_salt) !== user.password_hash) {
    cache.put(attemptsKey, String(Number(cache.get(attemptsKey) || 0) + 1), 900);
    throw new Error('Email or password is incorrect.');
  }
  cache.remove(attemptsKey);
  updateRow_('Users', user.id, { last_login_at: new Date().toISOString() });
  return { id: user.id, email: user.email, fullName: user.full_name, role: user.role, mustChangePassword: String(user.must_change_password).toLowerCase() === 'true' };
}

function changePassword_(payload) {
  const user = readRows_('Users').find(function (row) { return row.id === String(payload.userId || ''); });
  if (!user || String(user.active).toLowerCase() === 'false' || passwordHash_(String(payload.currentPassword || ''), user.password_salt) !== user.password_hash) throw new Error('Current password is incorrect.');
  const nextPassword = String(payload.newPassword || '');
  if (nextPassword.length < 12) throw new Error('Use a password with at least 12 characters.');
  const salt = Utilities.getUuid() + Utilities.getUuid();
  updateRow_('Users', user.id, { password_salt: salt, password_hash: passwordHash_(nextPassword, salt), must_change_password: false });
  return { changed: true };
}

function passwordHash_(password, salt) {
  let bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, salt + password, Utilities.Charset.UTF_8);
  for (let index = 0; index < 20000; index++) bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, bytes.concat(Utilities.newBlob(salt).getBytes()), Utilities.Charset.UTF_8);
  return bytes.map(function (byte) { return ('0' + ((byte + 256) % 256).toString(16)).slice(-2); }).join('');
}

function randomPassword_() {
  return Utilities.getUuid().replace(/-/g, '') + 'aA7!';
}

function requireRole_(actor, roles) {
  if (!roles.includes(actor.role)) throw new Error('This action requires an administrator or manager role.');
}

function readRows_(name) {
  const spreadsheetId = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  const sheet = SpreadsheetApp.openById(spreadsheetId).getSheetByName(name);
  if (!sheet || sheet.getLastRow() < 2) return [];
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String);
  return sheet.getRange(2, 1, sheet.getLastRow() - 1, headers.length).getValues().map(function (values) {
    const row = {};
    headers.forEach(function (header, index) { row[header] = values[index] instanceof Date ? values[index].toISOString() : values[index]; });
    return row;
  });
}

function appendRow_(name, row) {
  const sheet = SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID')).getSheetByName(name);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String);
  sheet.appendRow(headers.map(function (header) { return row[header] === undefined ? '' : row[header]; }));
}

function updateRow_(name, id, changes) {
  const sheet = SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID')).getSheetByName(name);
  const values = sheet.getDataRange().getValues();
  const headers = values[0].map(String);
  const idColumn = headers.indexOf('id');
  for (let index = 1; index < values.length; index++) {
    if (String(values[index][idColumn]) !== String(id)) continue;
    Object.keys(changes).forEach(function (key) { const column = headers.indexOf(key); if (column >= 0) sheet.getRange(index + 1, column + 1).setValue(changes[key]); });
    return;
  }
  throw new Error('Record not found.');
}

function publicUser_(user) {
  return { id: user.id, email: user.email, fullName: user.full_name, role: user.role, active: String(user.active).toLowerCase() !== 'false' };
}

function constantTimeEquals_(a, b) {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let index = 0; index < a.length; index++) difference |= a.charCodeAt(index) ^ b.charCodeAt(index);
  return difference === 0;
}

function json_(body) {
  return ContentService.createTextOutput(JSON.stringify(body)).setMimeType(ContentService.MimeType.JSON);
}

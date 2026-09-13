const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization,content-type',
  'access-control-allow-methods': 'GET,POST,OPTIONS',
};

export function preflight(event) {
  if ((event.httpMethod || '').toUpperCase() === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: { ...CORS, 'access-control-max-age': '86400' },
      body: '',
    };
  }
  return null;
}

export function json(body, status = 200, headers = {}) {
  return {
    statusCode: status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...CORS, ...headers },
    body: JSON.stringify(body),
  };
}

export function redirect(location, headers = {}) {
  return { statusCode: 302, headers: { location, ...CORS, ...headers }, body: '' };
}

export function method(event, allowed) {
  if (event.httpMethod && !allowed.includes(event.httpMethod.toUpperCase())) {
    return json({ error: 'method_not_allowed' }, 405, { allow: allowed.join(', ') });
  }
  return null;
}

export function safeError(error) {
  return error instanceof Error ? error.message : String(error || 'Unknown error');
}

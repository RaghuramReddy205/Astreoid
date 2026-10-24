// Timezone helpers shared by the server and the browser (no dependencies).
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else { root.AST = root.AST || {}; root.AST.tz = api; }
})(this, function () {
  var pad = function (n) { return String(n).padStart(2, '0'); };
  var WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  var cache = {};
  function fmt(tz) {
    if (!cache[tz]) cache[tz] = new Intl.DateTimeFormat('en-CA', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', weekday: 'short' });
    return cache[tz];
  }
  function parts(ms, tz) {
    var o = {};
    fmt(tz).formatToParts(new Date(ms)).forEach(function (p) { o[p.type] = p.value; });
    return { y: +o.year, mo: +o.month, d: +o.day, h: (+o.hour) % 24, mi: +o.minute, s: +o.second, wd: WD.indexOf(o.weekday) };
  }
  function offset(ms, tz) {
    var p = parts(ms, tz);
    return Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi, p.s) - Math.floor(ms / 1000) * 1000;
  }
  // Wall-clock time in tz -> UTC milliseconds
  function zoned(y, mo, d, h, mi, tz) {
    var guess = Date.UTC(y, mo - 1, d, h, mi);
    var t = guess - offset(guess, tz);
    return guess - offset(t, tz);
  }
  function dayKey(ms, tz) { var p = parts(ms, tz); return p.y + '-' + pad(p.mo) + '-' + pad(p.d); }
  function addDays(key, n) {
    var a = key.split('-').map(Number);
    return new Date(Date.UTC(a[0], a[1] - 1, a[2] + n)).toISOString().slice(0, 10);
  }
  function weekday(key) { var a = key.split('-').map(Number); return new Date(Date.UTC(a[0], a[1] - 1, a[2])).getUTCDay(); }
  function at(key, hhmm, tz) {
    var a = key.split('-').map(Number), b = String(hhmm || '00:00').split(':').map(Number);
    return zoned(a[0], a[1], a[2], b[0] || 0, b[1] || 0, tz);
  }
  function toInput(iso, tz) {
    if (!iso) return '';
    var t = Date.parse(iso); if (isNaN(t)) return '';
    var p = parts(t, tz);
    return p.y + '-' + pad(p.mo) + '-' + pad(p.d) + 'T' + pad(p.h) + ':' + pad(p.mi);
  }
  function fromInput(str, tz) {
    var m = /^(\d{4})-(\d\d)-(\d\d)T(\d\d):(\d\d)$/.exec(str || '');
    if (!m) return undefined;
    return new Date(zoned(+m[1], +m[2], +m[3], +m[4], +m[5], tz)).toISOString();
  }
  function minutes(hhmm) { var b = String(hhmm || '0:0').split(':').map(Number); return (b[0] || 0) * 60 + (b[1] || 0); }
  function isValid(tz) { try { new Intl.DateTimeFormat('en', { timeZone: tz }); return true; } catch (e) { return false; } }
  return { parts: parts, zoned: zoned, dayKey: dayKey, addDays: addDays, weekday: weekday, at: at, toInput: toInput, fromInput: fromInput, minutes: minutes, isValid: isValid, pad: pad };
});

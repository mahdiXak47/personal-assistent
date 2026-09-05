// منشی — «صندوق‌ها»: بازدهیِ صندوق‌های قابل معامله در بازه‌های مختلف.
//
// اینجا برخلاف کارتِ سهام، قاعدهٔ market.js سرِ جایش می‌ماند: فهرستِ صندوق‌ها
// محلی و کوتاه است، پس **نام از جدولِ خودمان می‌آید و فقط عدد از سرور**.
// نمادِ برگشتی از سرور فقط برای تطبیق به کار می‌رود، نه برای نمایش.
//
// بازدهی خودمان از تاریخچهٔ قیمتِ پایانی حساب می‌شود، نه از سرور — همان کاری
// که market.js با ارز و bourse.js با سهام می‌کند.
const Funds = (() => {
  const SEARCH_URL = 'https://cdn.tsetmc.com/api/Instrument/GetInstrumentSearch/';
  const HISTORY_URL = 'https://cdn.tsetmc.com/api/ClosingPrice/GetClosingPriceDailyList/';

  // جست‌وجوی «کمند» سه نتیجه می‌دهد و فقط یکی صندوق است؛ آن دوتای دیگر سهمِ
  // «گسترش قطعه سازي کمند» هستند. پس گروهِ ابزار شرطِ لازم است.
  const FUND_GROUP = 'صندوق';

  // فهرستِ کوتاه و دستی. هر ردیف: نمادِ جست‌وجو، نامی که نشان می‌دهیم، و نوع.
  // کوتاه بودنش عمدی است: هر صندوق یک درخواستِ تاریخچه لازم دارد.
  const FUNDS = [
    { q: 'کمند',  name: 'کمند',   kind: 'fixed' },
    { q: 'پارند', name: 'پارند',  kind: 'fixed' },
    { q: 'افران', name: 'افران',  kind: 'fixed' },
    { q: 'اعتماد', name: 'اعتماد', kind: 'fixed' },
    { q: 'یاقوت', name: 'یاقوت',  kind: 'fixed' },
    { q: 'اهرم',  name: 'اهرم',   kind: 'equity' },
    { q: 'توان',  name: 'توان',   kind: 'equity' },
    { q: 'آگاس',  name: 'آگاس',   kind: 'equity' }
  ];

  const KINDS = [
    { key: 'fixed',  label: 'درآمد ثابت' },
    { key: 'equity', label: 'سهامی و اهرمی' }
  ];

  // بازه‌ها بر حسبِ روزِ تقویمی، نه روزِ معاملاتی — «یک ماه» برای آدم یعنی
  // سی روزِ گذشته، نه سی جلسهٔ معاملاتی.
  const PERIODS = [
    { key: 'd1',  label: 'روزانه', days: 1 },
    { key: 'w1',  label: 'هفته',   days: 7 },
    { key: 'm1',  label: 'ماه',    days: 30 },
    { key: 'm3',  label: '۳ ماه',  days: 90 },
    { key: 'y1',  label: 'سال',    days: 365 }
  ];

  const num = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };

  const searchUrl = (q) => SEARCH_URL + encodeURIComponent(String(q || ''));
  const historyUrl = (insCode) => HISTORY_URL + encodeURIComponent(String(insCode || '')) + '/0';

  // از نتایجِ جست‌وجو فقط ردیفی که واقعاً صندوق است. تطبیقِ نماد هم لازم است،
  // وگرنه جست‌وجوی «اهرم» صندوقِ دیگری را برمی‌گرداند.
  function pickFund(raw, symbol) {
    let d = raw;
    if (typeof raw === 'string') {
      try { d = JSON.parse(raw); } catch (_) { return ''; }
    }
    const list = Array.isArray(d) ? d : (Array.isArray(d?.instrumentSearch) ? d.instrumentSearch : []);
    const want = String(symbol || '').trim();
    for (const r of list) {
      if (!r || typeof r !== 'object') continue;
      const group = String(r.cgrValCotTitle || '');
      if (!group.includes(FUND_GROUP)) continue;
      const sym = String(r.lVal18AFC || '').trim();
      if (want && sym !== want) continue;
      const code = String(r.insCode || '');
      if (/^[0-9]{1,25}$/.test(code)) return code;
    }
    return '';
  }

  // تاریخچهٔ قیمتِ پایانی. پاسخ نزولی می‌آید ولی به آن تکیه نمی‌کنیم.
  function parseHistory(raw) {
    let d = raw;
    if (typeof raw === 'string') {
      try { d = JSON.parse(raw); } catch (_) { return []; }
    }
    const list = Array.isArray(d) ? d : (Array.isArray(d?.closingPriceDaily) ? d.closingPriceDaily : []);
    const out = [];
    for (const r of list) {
      if (!r || typeof r !== 'object') continue;
      const date = Math.trunc(num(r.dEven));
      const close = num(r.pClosing);
      if (date < 10000101 || close <= 0) continue;
      out.push({ date, close });
    }
    out.sort((a, b) => b.date - a.date);
    return out;
  }

  // ۲۰۲۶۰۹۰۲ منهای n روز → ۲۰۲۶۰۸۲۳. از خودِ Date استفاده می‌کنیم تا ماهِ ۳۱ روزه
  // و سالِ کبیسه دستی حساب نشود.
  function shiftDate(yyyymmdd, days) {
    const n = Math.trunc(num(yyyymmdd));
    const y = Math.floor(n / 10000), m = Math.floor(n / 100) % 100, d = n % 100;
    const t = new Date(Date.UTC(y, m - 1, d));
    if (Number.isNaN(t.getTime())) return 0;
    t.setUTCDate(t.getUTCDate() - Math.trunc(days));
    return t.getUTCFullYear() * 10000 + (t.getUTCMonth() + 1) * 100 + t.getUTCDate();
  }

  // بازدهیِ n روزِ گذشته. مبنا نزدیک‌ترین جلسهٔ معاملاتیِ **قبل یا مساویِ** آن
  // تاریخ است؛ روزِ تعطیل که داده ندارد نباید بازه را بی‌جواب بگذارد.
  function returnOver(history, days) {
    const h = history || [];
    if (h.length < 2) return null;
    const latest = h[0];
    const target = shiftDate(latest.date, days);
    if (!target) return null;
    const base = h.find(x => x.date <= target);
    // تاریخچه به آن بازه نمی‌رسد — «نداریم» با «صفر» یکی نیست
    if (!base || base.close <= 0 || base.date === latest.date) return null;
    return ((latest.close - base.close) / base.close) * 100;
  }

  function returnsOf(history) {
    const out = {};
    for (const p of PERIODS) out[p.key] = returnOver(history, p.days);
    return out;
  }

  // صندوق‌های یک نوع، مرتب بر اساس بازدهیِ بازهٔ انتخابی. آن‌هایی که برای این
  // بازه داده ندارند ته فهرست می‌روند، نه اینکه صفر حساب شوند.
  function rank(rows, kind, periodKey) {
    const list = (rows || []).filter(r => r && r.kind === kind);
    list.sort((a, b) => {
      const x = a.returns?.[periodKey], y = b.returns?.[periodKey];
      if (x == null && y == null) return 0;
      if (x == null) return 1;
      if (y == null) return -1;
      return y - x;
    });
    return list;
  }

  const api = {
    SEARCH_URL, HISTORY_URL, FUND_GROUP, FUNDS, KINDS, PERIODS,
    searchUrl, historyUrl, pickFund, parseHistory, shiftDate, returnOver, returnsOf, rank
  };
  if (typeof globalThis !== 'undefined') globalThis.Funds = api;
  return api;
})();

if (typeof module !== 'undefined') module.exports = Funds;

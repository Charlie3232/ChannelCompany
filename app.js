/* ============================================================
   乾隆化工貿易 · app.js
   ============================================================ */

const GAS_URL = 'https://script.google.com/macros/s/AKfycbxceKXY0MSj7z6_7hWxa25S90fPbNTd_jZ_c2qzZtSpiqII5En44qJ12OGiOp6fNJCFUQ/exec';

const REQ_COMMON = [
  {id:'f_shipDate',    label:'出貨日期'},
  {id:'f_orderDate',   label:'訂單日期'},
  {id:'f_orderNo',     label:'訂單號碼'},
  {id:'f_orderStatus', label:'訂單進度'},
  {id:'f_clientName',  label:'客戶名稱'},
];

const STATUS_CFG = {
  '待確認':     {color:'#8A8A8A', cls:'',    badge:'待確認'},
  '已確認':     {color:'#1A4A28', cls:'s-c', badge:'已確認'},
  '備貨中':     {color:'#B08840', cls:'',    badge:'備貨中'},
  '出貨中':     {color:'#B08840', cls:'',    badge:'出貨中'},
  '已出貨':     {color:'#152840', cls:'s-s', badge:'已出貨'},
  '已收款入帳': {color:'#B08840', cls:'s-p', badge:'已收款'},
  '取消':       {color:'#C8102E', cls:'s-x', badge:'已取消'},
};

let rowCount = 0;
let productOptions = [];

/* ================================================================
   INIT
   ================================================================ */
document.addEventListener('DOMContentLoaded', () => {
  setToday();
  genOrderId();
  loadDropdowns();
  bindCommonBlur();
  addProductRow();
});

function setToday() {
  document.getElementById('f_orderDate').value = new Date().toISOString().split('T')[0];
}

function genOrderId() {
  const n = new Date(), pad = (v,l=2) => String(v).padStart(l,'0');
  const id = `QL-${n.getFullYear()}${pad(n.getMonth()+1)}${pad(n.getDate())}-${pad(n.getMilliseconds(),3)}`;
  document.getElementById('pageOrderId').textContent = 'ORDER ID — ' + id;
}

/* ================================================================
   LOAD DROPDOWNS — 全部從 GAS 讀，不用備用資料
   ================================================================ */
async function loadDropdowns() {
  setSel('f_orderStatus', [], '連線中…');
  setSel('f_clientName',  [], '連線中…');

  try {
    const res  = await fetch(GAS_URL + '?action=getDropdowns');

    // 先檢查 HTTP 狀態
    if (!res.ok) throw new Error('HTTP ' + res.status);

    const data = await res.json();

    // GAS 回傳 error 欄位
    if (data.error) throw new Error(data.error);

    // 訂單進度
    if (data.statuses && data.statuses.length) {
      fillSel('f_orderStatus', data.statuses, '— 選擇訂單進度 —');
    } else {
      setSel('f_orderStatus', [], '⚠ 巨集 H4:H10 無資料');
    }

    // 客戶名稱
    if (data.clients && data.clients.length) {
      fillSel('f_clientName', data.clients, '— 選擇客戶名稱 —');
    } else {
      setSel('f_clientName', [], '⚠ 巨集 E4:E7513 無資料');
    }

    // 品項
    productOptions = (data.products || []).filter(Boolean);
    if (productOptions.length) {
      refreshAllProductSelects();
    } else {
      document.querySelectorAll('.prod-sel').forEach(s => {
        s.innerHTML = '<option value="">⚠ 巨集 J12:J28 無資料</option>';
      });
    }

  } catch(e) {
    // 顯示完整錯誤，方便排查
    const msg = '✕ 清單載入失敗：' + e.message;
    console.error(msg);
    showToast(msg, '', 10000);
    setSel('f_orderStatus', [], '⚠ 載入失敗，請重新整理');
    setSel('f_clientName',  [], '⚠ 載入失敗，請重新整理');
    document.querySelectorAll('.prod-sel').forEach(s => {
      s.innerHTML = '<option value="">⚠ 載入失敗，請重新整理</option>';
    });
  }
}

// 設單一 option（用於狀態訊息）
function setSel(id, items, msg) {
  const el = document.getElementById(id);
  if (!el) return;
  el.innerHTML = `<option value="">${msg}</option>`;
}

function fillSel(id, items, ph) {
  const el = document.getElementById(id);
  if (!el) return;
  el.innerHTML = `<option value="">${ph}</option>`;
  items.forEach(v => {
    v = String(v).trim();
    if (!v) return;
    const o = document.createElement('option');
    o.value = v; o.textContent = v;
    el.appendChild(o);
  });
}

function refreshAllProductSelects() {
  document.querySelectorAll('.prod-sel').forEach(sel => {
    const cur = sel.value;
    sel.innerHTML = '<option value="">— 選擇品項 —</option>';
    productOptions.forEach(v => {
      const o = document.createElement('option');
      o.value = v; o.textContent = v;
      if (v === cur) o.selected = true;
      sel.appendChild(o);
    });
  });
}

/* ================================================================
   PRODUCT ROWS
   ================================================================ */
function addProductRow() {
  rowCount++;
  const idx  = rowCount;
  const wrap = document.getElementById('productList');
  const div  = document.createElement('div');
  div.className = 'product-item';
  div.id = 'prod-' + idx;

  div.innerHTML = `
    <div class="product-item-head">
      <span class="product-item-num">#${String(idx).padStart(2,'0')}</span>
      <span class="product-item-lbl">品項明細</span>
      ${idx > 1 ? `<button class="del-btn" onclick="removeProductRow(${idx})" type="button" title="刪除此筆">×</button>` : ''}
    </div>
    <div class="fw">
      <label class="fl">品項 <b class="tag-r">必填</b></label>
      <select class="fi fi-sel prod-sel" id="pr_product_${idx}" onchange="calcRow(${idx})">
        <option value="">— 選擇品項 —</option>
      </select>
      <span class="fe" id="pre_product_${idx}"></span>
    </div>
    <div class="r2">
      <div class="fw">
        <label class="fl">生產批簽 <b class="tag-r">必填</b></label>
        <input type="text" class="fi" id="pr_batchNo_${idx}" placeholder="e.g. B2026-04-001"/>
        <span class="fe" id="pre_batchNo_${idx}"></span>
      </div>
      <div class="fw">
        <label class="fl">品項單價（NT$/kg）<b class="tag-r">必填</b></label>
        <input type="number" class="fi" id="pr_unitPrice_${idx}" placeholder="0" min="0" step="0.01" oninput="calcRow(${idx})"/>
        <span class="fe" id="pre_unitPrice_${idx}"></span>
      </div>
    </div>
    <div class="fw">
      <label class="fl">數量（公斤）<b class="tag-r">必填</b></label>
      <input type="number" class="fi" id="pr_qty_${idx}" placeholder="0.000" min="0" step="0.001" oninput="calcRow(${idx})"/>
      <span class="fe" id="pre_qty_${idx}"></span>
    </div>
    <div class="item-sub" id="pr_sub_${idx}">
      <span class="item-sub-lbl">本筆小計（含稅）</span>
      <span class="item-sub-val" id="pr_subval_${idx}">NT$ 0</span>
    </div>
  `;

  wrap.appendChild(div);

  // 填入現有品項選單
  const sel = div.querySelector('.prod-sel');
  productOptions.forEach(v => {
    const o = document.createElement('option');
    o.value = v; o.textContent = v;
    sel.appendChild(o);
  });
}

function removeProductRow(idx) {
  const el = document.getElementById('prod-' + idx);
  if (el) el.remove();
  calcTotals();
}

/* ================================================================
   CALCULATIONS
   ================================================================ */
function calcRow(idx) {
  const K = parseFloat(getVal('pr_unitPrice_'+idx)) || 0;
  const L = parseFloat(getVal('pr_qty_'+idx))       || 0;
  const el = document.getElementById('pr_subval_'+idx);
  if (el) el.textContent = 'NT$ ' + Math.round(K*L*1.05).toLocaleString('zh-TW');
  calcTotals();
}

function calcTotals() {
  let sumO=0, sumM=0, sumN=0, sumP=0;
  getAllRowIds().forEach(idx => {
    const K = parseFloat(getVal('pr_unitPrice_'+idx)) || 0;
    const L = parseFloat(getVal('pr_qty_'+idx))       || 0;
    const O = K*L, M = O*0.05;
    sumO += O; sumM += M; sumN += O+M; sumP += O*1.05;
  });
  setTxt('c_tax',     'NT$ '+Math.round(sumM).toLocaleString('zh-TW'));
  setTxt('c_itemTax', 'NT$ '+Math.round(sumN).toLocaleString('zh-TW'));
  setTxt('c_preTax',  'NT$ '+Math.round(sumO).toLocaleString('zh-TW'));
  setTxt('c_total',   'NT$ '+Math.round(sumP).toLocaleString('zh-TW'));
}

function getAllRowIds() {
  return Array.from(document.querySelectorAll('.product-item'))
    .map(el => parseInt(el.id.replace('prod-','')));
}

/* ================================================================
   CLIENT CHANGE
   ================================================================ */
async function onClientChange() {
  const name   = getVal('f_clientName');
  const addrEl = document.getElementById('f_deliveryAddr');
  addrEl.value = '';
  clearE('f_clientName');
  if (!name) return;
  try {
    const res  = await fetch(`${GAS_URL}?action=getAddress&client=${encodeURIComponent(name)}`);
    const data = await res.json();
    addrEl.value = data.address || '';
  } catch(e) {
    console.warn('地址查詢失敗:', e.message);
  }
}

/* ================================================================
   STATUS CHANGE
   ================================================================ */
function onStatusChange() {
  const val  = getVal('f_orderStatus');
  const cfg  = STATUS_CFG[val];
  clearE('f_orderStatus');

  const strip = document.getElementById('statusStrip');
  const dot   = document.getElementById('sDot');
  const lbl   = document.getElementById('sLbl');
  const badge = document.getElementById('topBadge');

  if (cfg) {
    dot.style.background    = cfg.color;
    lbl.textContent         = val;
    lbl.style.color         = cfg.color;
    strip.className         = 'ss ' + cfg.cls;
    badge.textContent       = cfg.badge;
    badge.style.borderColor = cfg.color;
    badge.style.color       = cfg.color;
  } else {
    dot.style.background = '';
    lbl.textContent      = '請選擇訂單進度';
    lbl.style.color      = '';
    strip.className      = 'ss';
    badge.textContent    = '草稿';
    badge.style.borderColor = '';
    badge.style.color    = '';
  }

  const isPaid = val === '已收款入帳';
  const incEl  = document.getElementById('f_incomeAmt');
  const incTag = document.getElementById('incomeTag');
  incEl.disabled = !isPaid;
  if (!isPaid) incEl.value = '';
  incTag.textContent = isPaid ? '已收款入帳 · 請填寫金額' : '須選「已收款入帳」才可填寫';
  incTag.className   = 'income-tag' + (isPaid ? ' ok' : '');
}

/* ================================================================
   VALIDATION
   ================================================================ */
function validate() {
  let ok = true;

  REQ_COMMON.forEach(({id, label}) => {
    const el = document.getElementById(id);
    if (!el) return;
    if (!String(el.value).trim()) {
      el.classList.add('invalid'); el.classList.remove('valid');
      setErrText(id, `▲ ${label} 為必填`);
      ok = false;
    } else {
      el.classList.remove('invalid'); el.classList.add('valid');
      clearE(id);
    }
  });

  getAllRowIds().forEach(idx => {
    ['product','batchNo','unitPrice','qty'].forEach(f => {
      const id  = `pr_${f}_${idx}`;
      const el  = document.getElementById(id);
      if (!el) return;
      if (!String(el.value).trim()) {
        el.classList.add('invalid');
        const names = {product:'品項',batchNo:'生產批簽',unitPrice:'品項單價',qty:'數量'};
        const errEl = document.getElementById(`pre_${f}_${idx}`);
        if (errEl) errEl.textContent = `▲ ${names[f]} 為必填`;
        ok = false;
      } else {
        el.classList.remove('invalid'); el.classList.add('valid');
        const errEl = document.getElementById(`pre_${f}_${idx}`);
        if (errEl) errEl.textContent = '';
      }
    });
  });

  return ok;
}

/* ================================================================
   COLLECT DATA
   ================================================================ */
function collectData() {
  let sumO=0, sumP=0;
  const rows = getAllRowIds().map(idx => {
    const K = parseFloat(getVal('pr_unitPrice_'+idx)) || 0;
    const L = parseFloat(getVal('pr_qty_'+idx))       || 0;
    const O = +(K*L).toFixed(2);
    const M = +(O*0.05).toFixed(2);
    const N = +(O+M).toFixed(2);
    const P = +(O*1.05).toFixed(2);
    sumO += O; sumP += P;
    return { product: getVal('pr_product_'+idx), batchNo: getVal('pr_batchNo_'+idx),
             unitPrice: K, qty: L, taxAmt: M, itemWithTax: N, preTax: O, totalWithTax: P };
  });
  const incRaw = getVal('f_incomeAmt');
  return {
    shipDate:     getVal('f_shipDate'),
    orderDate:    getVal('f_orderDate'),
    orderNo:      getVal('f_orderNo'),
    orderStatus:  getVal('f_orderStatus'),
    clientName:   getVal('f_clientName'),
    deliveryAddr: getVal('f_deliveryAddr'),
    remark:       getVal('f_remark'),
    incomeAmt:    incRaw !== '' ? +parseFloat(incRaw).toFixed(2) : '',
    totalPreTax:  +sumO.toFixed(2),
    totalWithTax: +sumP.toFixed(2),
    rows,
  };
}

/* ================================================================
   VALIDATE → SUBMIT
   ================================================================ */
function validateAndSubmit() {
  if (!validate()) {
    showToast('⚠ 請填寫所有必填欄位','');
    const first = document.querySelector('.fi.invalid');
    if (first) first.scrollIntoView({behavior:'smooth', block:'center'});
    return;
  }
  const d   = collectData();
  const msg =
    `訂單號碼：${d.orderNo}\n` +
    `客戶：${d.clientName}\n` +
    `品項數：${d.rows.length} 筆\n` +
    `銷貨含稅總額：NT$${d.totalWithTax.toLocaleString()}\n\n確認提交並寫入試算表？`;
  if (confirm(msg)) doSubmit(d);
}

/* ================================================================
   SUBMIT — fetch GET
   ================================================================ */
async function doSubmit(data) {
  showOverlay('寫入試算表中…');
  document.getElementById('btnSub').disabled = true;

  try {
    const payload = encodeURIComponent(JSON.stringify(data));
    const res     = await fetch(`${GAS_URL}?action=appendOrder&data=${payload}`);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const result  = await res.json();

    if (result && result.success) {
      hideOverlay();
      showToast(`✓ 已寫入試算表（第 ${result.firstRow}~${result.lastRow} 行）`, 'ok', 5000);
      const badge = document.getElementById('topBadge');
      badge.textContent       = '已提交';
      badge.style.borderColor = '#1A4A28';
      badge.style.color       = '#1A4A28';
    } else {
      throw new Error(result ? result.error : '未知錯誤');
    }
  } catch(err) {
    hideOverlay();
    showToast('✕ 寫入失敗：' + err.message, '', 8000);
    document.getElementById('btnSub').disabled = false;
  }
}

/* ================================================================
   HELPERS
   ================================================================ */
function getVal(id) {
  const el = document.getElementById(id);
  return el ? el.value.trim() : '';
}
function setTxt(id, v) {
  const el = document.getElementById(id);
  if (el) el.textContent = v;
}
function setErrText(id, msg) {
  const el = document.getElementById('e_' + id.replace('f_',''));
  if (el) el.textContent = msg;
}
function clearE(id) { setErrText(id, ''); }

function bindCommonBlur() {
  REQ_COMMON.forEach(({id}) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('blur', () => {
      if (!String(el.value).trim()) el.classList.add('invalid');
      else { el.classList.remove('invalid'); el.classList.add('valid'); clearE(id); }
    });
  });
}

let _tid;
function showToast(msg, type='', dur=4000) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className   = 'toast ' + type + ' show';
  clearTimeout(_tid);
  _tid = setTimeout(() => el.classList.remove('show'), dur);
}
function showOverlay(msg='處理中…') {
  document.getElementById('overlayTxt').textContent = msg;
  document.getElementById('overlay').classList.add('show');
}
function hideOverlay() {
  document.getElementById('overlay').classList.remove('show');
}

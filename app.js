/* ============================================================
   乾隆化工貿易 · app.js
   ============================================================ */

var GAS_URL = 'https://script.google.com/macros/s/AKfycbyxMBptplXG-kk2P6ganMUOFMISjor4gXCKqvu19uvbKYF4Xxg3lhrONPZ3uX1G2dB0zQ/exec';

var REQ_ORDER = [
  {id:'f_shipDate',    label:'出貨日期'},
  {id:'f_orderDate',   label:'訂單日期'},
  {id:'f_orderNo',     label:'訂單號碼'},
  {id:'f_orderStatus', label:'訂單進度'},
  {id:'f_clientName',  label:'客戶名稱'},
];

var STATUS_CFG = {
  '待確認':     {color:'#8A8A8A', cls:'',    badge:'待確認'},
  '已確認':     {color:'#1A4A28', cls:'s-c', badge:'已確認'},
  '備貨中':     {color:'#B08840', cls:'',    badge:'備貨中'},
  '出貨中':     {color:'#B08840', cls:'',    badge:'出貨中'},
  '已出貨':     {color:'#152840', cls:'s-s', badge:'已出貨'},
  '已收款入帳': {color:'#B08840', cls:'s-p', badge:'已收款'},
  '取消':       {color:'#C8102E', cls:'s-x', badge:'已取消'},
};

var rowCount = 0;
var productOptions = [];

/* ================================================================
   INIT
   ================================================================ */
document.addEventListener('DOMContentLoaded', function() {
  // 日期顯示
  var d = new Date();
  var dateEl = document.getElementById('homeDate');
  if (dateEl) dateEl.textContent = d.getFullYear() + '/' +
    String(d.getMonth()+1).padStart(2,'0') + '/' +
    String(d.getDate()).padStart(2,'0');

  // 主畫面狀態
  var statusEl = document.getElementById('homeStatus');
  if (statusEl) { statusEl.textContent = '就緒'; statusEl.style.color = '#555'; }
});

/* ================================================================
   HOME / PAGE NAVIGATION
   ================================================================ */
function goHome() {
  document.getElementById('site-shell').style.display = 'none';
  document.getElementById('page-home').style.display  = 'flex';
  // 重設 badge
  var badge = document.getElementById('topBadge');
  if (badge) { badge.textContent='DRAFT'; badge.style.borderColor=''; badge.style.color=''; }
}

function goPage(page) {
  document.getElementById('page-home').style.display  = 'none';
  document.getElementById('site-shell').style.display = '';
  switchPage(page);
}

function switchPage(page) {
  ['order','cost','stats'].forEach(function(p) {
    var el  = document.getElementById('page-' + p);
    var tab = document.getElementById('tab-'  + p);
    if (el)  el.style.display = (p === page) ? '' : 'none';
    if (tab) tab.classList.toggle('active', p === page);
  });
  if (page === 'order') initOrderPage();
  if (page === 'cost')  initCostPage();
  if (page === 'stats' && !window._statsInit) { window._statsInit = true; loadStats(); }
}

/* ================================================================
   LOAD ORDER DROPDOWNS（進入訂單頁時呼叫）
   ================================================================ */
async function loadOrderDropdowns() {
  sel('f_orderStatus', '載入中…');
  sel('f_clientName',  '載入中…');
  document.querySelectorAll('.prod-sel').forEach(function(s){ s.innerHTML='<option value="">載入中…</option>'; });
  try {
    var res  = await fetch(GAS_URL + '?action=getDropdowns');
    if (!res.ok) throw new Error('HTTP ' + res.status);
    var data = await res.json();
    if (data.error) throw new Error(data.error);

    if (data.statuses && data.statuses.length) fillSel('f_orderStatus', data.statuses, '— 選擇訂單進度 —');
    else sel('f_orderStatus', '⚠ 無資料');

    if (data.clients && data.clients.length) fillSel('f_clientName', data.clients, '— 選擇客戶名稱 —');
    else sel('f_clientName', '⚠ 無資料');

    productOptions = (data.products || []).filter(Boolean);
    refreshProdSelects();

    // 更新主畫面狀態
    var statusEl = document.getElementById('homeStatus');
    if (statusEl) { statusEl.textContent = '✓ 系統就緒'; statusEl.style.color = '#2a7a2a'; }

  } catch(e) {
    console.warn('清單載入失敗:', e.message);
    sel('f_orderStatus', '⚠ ' + e.message);
    sel('f_clientName',  '⚠ 載入失敗');
    document.querySelectorAll('.prod-sel').forEach(function(s){ s.innerHTML='<option value="">⚠ 載入失敗</option>'; });
  }
}

/* ================================================================
   LOAD COST CATEGORIES（進入成本頁時呼叫）
   ================================================================ */
async function loadCostCategories() {
  sel('c_category', '載入中…');
  try {
    var res  = await fetch(GAS_URL + '?action=getCostCategories');
    if (!res.ok) throw new Error('HTTP ' + res.status);
    var data = await res.json();
    if (data.error) throw new Error(data.error);
    if (data.categories && data.categories.length) fillSel('c_category', data.categories, '— 選擇項目類別 —');
    else sel('c_category', '⚠ 無資料');
  } catch(e) {
    sel('c_category', '⚠ 載入失敗：' + e.message);
  }
}

/* ================================================================
   INIT ORDER PAGE
   ================================================================ */
var _orderInited = false;
function initOrderPage() {
  // 每次進入都重新初始化（刷新後 _orderInited 已重置）
  if (!_orderInited) {
    _orderInited = true;

    var today = new Date().toISOString().split('T')[0];
    var od = document.getElementById('f_orderDate');
    if (od) od.value = today;

    var n = new Date(), pad = function(v){ return String(v).padStart(2,'0'); };
    var id = 'QL-' + n.getFullYear() + pad(n.getMonth()+1) + pad(n.getDate()) + '-' + pad(n.getMilliseconds());
    var oid = document.getElementById('pageOrderId');
    if (oid) oid.textContent = 'ORDER ID — ' + id;

    // 清空品項列表，確保只有一筆預設
    var list = document.getElementById('productList');
    if (list) list.innerHTML = '';
    rowCount = 0;
    addProductRow(); // 預設第一筆

    bindBlur();
  }
  // 每次進入都重新載入清單
  loadOrderDropdowns();
}

/* ================================================================
   INIT COST PAGE
   ================================================================ */
var _costInited = false;
function initCostPage() {
  if (!_costInited) {
    _costInited = true;
    var cd = document.getElementById('c_date');
    if (cd && !cd.value) cd.value = new Date().toISOString().split('T')[0];
  }
  // 每次進入都重新載入成本類別
  loadCostCategories();
}

/* ================================================================
   SELECT HELPERS
   ================================================================ */
function sel(id, msg) {
  var el = document.getElementById(id);
  if (el) el.innerHTML = '<option value="">' + msg + '</option>';
}
function fillSel(id, items, ph) {
  var el = document.getElementById(id); if (!el) return;
  var cur = el.value;
  el.innerHTML = '<option value="">' + ph + '</option>';
  items.forEach(function(v) {
    v = String(v).trim(); if (!v) return;
    var o = document.createElement('option');
    o.value = v; o.textContent = v;
    if (v === cur) o.selected = true;
    el.appendChild(o);
  });
}
function refreshProdSelects() {
  document.querySelectorAll('.prod-sel').forEach(function(s) {
    var cur = s.value;
    s.innerHTML = '<option value="">— 選擇品項 —</option>';
    productOptions.forEach(function(v) {
      var o = document.createElement('option');
      o.value = v; o.textContent = v;
      if (v === cur) o.selected = true;
      s.appendChild(o);
    });
  });
}

/* ================================================================
   LOAD STATS
   ================================================================ */
async function loadStats() {
  var loading = document.getElementById('statsLoading');
  var errDiv  = document.getElementById('statsError');
  var grid    = document.getElementById('summaryGrid');
  var area    = document.getElementById('chartsArea');
  if (loading) loading.style.display = 'flex';
  if (errDiv)  errDiv.style.display  = 'none';
  if (grid)    grid.style.display    = 'none';
  if (area)    area.style.display    = 'none';

  // 動態載入 Chart.js（只在需要時才載，不阻擋主頁面）
  if (typeof Chart === 'undefined') {
    await new Promise(function(resolve, reject) {
      var s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js';
      s.onload  = resolve;
      s.onerror = function() { reject(new Error('Chart.js 載入失敗')); };
      document.head.appendChild(s);
    });
  }

  try {
    var res  = await fetch(GAS_URL + '?action=getStats');
    if (!res.ok) throw new Error('HTTP ' + res.status);
    var data = await res.json();
    if (data.error) throw new Error(data.error);
    if (loading) loading.style.display = 'none';
    if (grid)    grid.style.display    = '';
    if (area)    area.style.display    = '';
    renderSummary(data);
    renderCharts(data);
  } catch(e) {
    if (loading) loading.style.display = 'none';
    if (errDiv)  errDiv.style.display  = 'flex';
    var et = document.getElementById('statsErrorTxt');
    if (et) et.textContent = '載入失敗：' + e.message;
  }
}

function renderSummary(data) {
  var months = data.months || [];
  var totalRev    = months.reduce(function(s,m){ return s+(m.revenue||0); }, 0);
  var totalCost   = months.reduce(function(s,m){ return s+(m.cost||0); }, 0);
  var totalProfit = totalRev - totalCost;
  var avgMargin   = totalRev > 0 ? (totalProfit / totalRev * 100) : 0;
  function fmt(n){ return 'NT$ ' + Math.round(n).toLocaleString('zh-TW'); }
  setText('sum_revenue', fmt(totalRev));
  setText('sum_cost',    fmt(totalCost));
  setText('sum_profit',  fmt(totalProfit));
  setText('sum_margin',  avgMargin.toFixed(1) + '%');
}

function renderCharts(data) {
  var months = data.months || [];
  var rawLabels = data.labels || [];
  var labels = rawLabels.length === 12
    ? rawLabels.map(function(l){ return String(l).trim(); })
    : ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];

  var revenues = months.map(function(m){ return m.revenue||0; });
  var costs    = months.map(function(m){ return m.cost||0; });
  var profits  = months.map(function(m){ return m.profit||0; });
  var margins  = months.map(function(m){
    var v = m.margin||0;
    if (typeof v === 'string') v = parseFloat(v.replace('%',''))||0;
    if (Math.abs(v) <= 1 && v !== 0) v = v * 100;
    return +v.toFixed(2);
  });

  function moneyFmt(v){ return 'NT$ ' + Math.round(v).toLocaleString('zh-TW'); }

  var baseOpts = {
    responsive: true,
    plugins: {
      legend: { display: false },
      tooltip: { callbacks: { label: function(ctx){ return ' ' + moneyFmt(ctx.parsed.y); } } }
    },
    scales: {
      x: { grid:{color:'#f0f0f0'}, ticks:{font:{family:'Space Mono',size:11}} },
      y: { grid:{color:'#f0f0f0'}, ticks:{font:{family:'Space Mono',size:11},
           callback: function(v){
             if (Math.abs(v) >= 10000) return (v/10000).toFixed(1)+'萬';
             if (Math.abs(v) >= 1000)  return (v/1000).toFixed(0)+'K';
             return v;
           }}}
    }
  };
  var marginOpts = {
    responsive: true,
    plugins: {
      legend: { display: false },
      tooltip: { callbacks: { label: function(ctx){ return ' ' + ctx.parsed.y.toFixed(2) + '%'; } } }
    },
    scales: {
      x: { grid:{color:'#f0f0f0'}, ticks:{font:{family:'Space Mono',size:11}} },
      y: { grid:{color:'#f0f0f0'}, ticks:{font:{family:'Space Mono',size:11},
           callback: function(v){ return v + '%'; }}}
    }
  };

  makeChart('chartRevenue', labels, revenues, '#E2001A', baseOpts);
  makeChart('chartCost',    labels, costs,    '#111111', baseOpts);
  makeChart('chartProfit',  labels, profits,  '#1A5C2A', baseOpts);
  makeChart('chartMargin',  labels, margins,  '#C8A040', marginOpts);
}

function makeChart(id, labels, values, color, opts) {
  var canvas = document.getElementById(id); if (!canvas) return;
  if (window._charts && window._charts[id]) window._charts[id].destroy();
  if (!window._charts) window._charts = {};
  window._charts[id] = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        data: values,
        backgroundColor: values.map(function(v){ return v < 0 ? 'rgba(226,0,26,0.15)' : color + '22'; }),
        borderColor:     values.map(function(v){ return v < 0 ? '#E2001A' : color; }),
        borderWidth: 2, borderRadius: 2,
      }]
    },
    options: opts
  });
}

/* ================================================================
   PRODUCT ROWS
   ================================================================ */
function addProductRow() {
  rowCount++;
  var idx  = rowCount;
  var wrap = document.getElementById('productList'); if (!wrap) return;
  var div  = document.createElement('div');
  div.className = 'product-item'; div.id = 'prod-' + idx;
  div.innerHTML =
    '<div class="product-item-head">' +
      '<span class="product-item-num">#' + String(idx).padStart(2,'0') + '</span>' +
      '<span class="product-item-lbl">品項明細</span>' +
      (idx>1 ? '<button class="del-btn" onclick="removeProductRow('+idx+')" type="button">×</button>' : '') +
    '</div>' +
    '<div class="fw"><label class="fl">品項 <b class="tag-r">必填</b></label>' +
      '<select class="fi fi-sel prod-sel" id="pr_product_'+idx+'" onchange="calcRow('+idx+')"><option value="">— 選擇品項 —</option></select>' +
      '<span class="fe" id="pre_product_'+idx+'"></span></div>' +
    '<div class="r2">' +
      '<div class="fw"><label class="fl">生產批簽 <b class="tag-r">必填</b></label>' +
        '<input type="text" class="fi" id="pr_batchNo_'+idx+'" placeholder="e.g. B2026-04-001"/>' +
        '<span class="fe" id="pre_batchNo_'+idx+'"></span></div>' +
      '<div class="fw"><label class="fl">品項單價（NT$/kg）<b class="tag-r">必填</b></label>' +
        '<input type="number" class="fi" id="pr_unitPrice_'+idx+'" placeholder="0" min="0" step="0.01" oninput="calcRow('+idx+')"/>' +
        '<span class="fe" id="pre_unitPrice_'+idx+'"></span></div>' +
    '</div>' +
    '<div class="fw"><label class="fl">數量（公斤）<b class="tag-r">必填</b></label>' +
      '<input type="number" class="fi" id="pr_qty_'+idx+'" placeholder="0.000" min="0" step="0.001" oninput="calcRow('+idx+')"/>' +
      '<span class="fe" id="pre_qty_'+idx+'"></span></div>' +
    '<div class="item-sub">' +
      '<div class="item-sub-row"><span class="item-sub-lbl">本筆小計（未稅）</span><span class="item-sub-val item-sub-pre" id="pr_preval_'+idx+'">NT$ 0</span></div>' +
      '<div class="item-sub-row"><span class="item-sub-lbl">本筆小計（含稅）</span><span class="item-sub-val" id="pr_subval_'+idx+'">NT$ 0</span></div>' +
    '</div>';
  wrap.appendChild(div);
  var s = div.querySelector('.prod-sel');
  productOptions.forEach(function(v){ var o=document.createElement('option');o.value=v;o.textContent=v;s.appendChild(o); });
}

function removeProductRow(idx) {
  var el = document.getElementById('prod-' + idx); if (el) el.remove(); calcTotals();
}

/* ================================================================
   CALCULATIONS
   ================================================================ */
function calcRow(idx) {
  var K = parseFloat(gv('pr_unitPrice_'+idx))||0, L = parseFloat(gv('pr_qty_'+idx))||0;
  setText('pr_preval_'+idx, 'NT$ '+Math.round(K*L).toLocaleString('zh-TW'));
  setText('pr_subval_'+idx, 'NT$ '+Math.round(K*L*1.05).toLocaleString('zh-TW'));
  calcTotals();
}
function calcTotals() {
  var sumO=0,sumM=0,sumN=0,sumP=0;
  getRowIds().forEach(function(idx){
    var K=parseFloat(gv('pr_unitPrice_'+idx))||0, L=parseFloat(gv('pr_qty_'+idx))||0;
    var O=K*L, M=O*.05; sumO+=O;sumM+=M;sumN+=O+M;sumP+=O*1.05;
  });
  setText('c_preTax',  'NT$ '+Math.round(sumO).toLocaleString('zh-TW'));
  setText('c_tax',     'NT$ '+Math.round(sumM).toLocaleString('zh-TW'));
  setText('c_total',   'NT$ '+Math.round(sumP).toLocaleString('zh-TW'));
  setText('c_itemTax', 'NT$ '+Math.round(sumN).toLocaleString('zh-TW'));
}
function getRowIds() {
  return Array.from(document.querySelectorAll('.product-item')).map(function(el){ return parseInt(el.id.replace('prod-','')); });
}

/* ================================================================
   CLIENT / STATUS CHANGE
   ================================================================ */
async function onClientChange() {
  var name = gv('f_clientName');
  var ae   = document.getElementById('f_deliveryAddr');
  if (ae) ae.value = ''; clearE('f_clientName');
  if (!name) return;
  try {
    var res = await fetch(GAS_URL+'?action=getAddress&client='+encodeURIComponent(name));
    var d   = await res.json();
    if (ae) ae.value = d.address||'';
  } catch(e){}
}

function onStatusChange() {
  var val = gv('f_orderStatus'), cfg = STATUS_CFG[val];
  clearE('f_orderStatus');
  var strip=document.getElementById('statusStrip'), dot=document.getElementById('sDot'),
      lbl=document.getElementById('sLbl'), badge=document.getElementById('topBadge');
  if (cfg) {
    if(dot)  dot.style.background=cfg.color;
    if(lbl)  {lbl.textContent=val;lbl.style.color=cfg.color;}
    if(strip)strip.className='ss '+cfg.cls;
    if(badge){badge.textContent=cfg.badge;badge.style.borderColor=cfg.color;badge.style.color=cfg.color;}
  } else {
    if(dot)  dot.style.background='';
    if(lbl)  {lbl.textContent='';lbl.style.color='';}
    if(strip)strip.className='ss';
    if(badge){badge.textContent='DRAFT';badge.style.borderColor='';badge.style.color='';}
  }
  var paid=val==='已收款入帳';
  var inc=document.getElementById('f_incomeAmt'), tag=document.getElementById('incomeTag');
  if(inc){inc.disabled=!paid;if(!paid)inc.value='';}
  if(tag){tag.textContent=paid?'已收款入帳 · 請填寫金額':'須選「已收款入帳」才可填寫';tag.className='income-tag'+(paid?' ok':'');}
}

/* ================================================================
   VALIDATE & SUBMIT 訂單
   ================================================================ */
function validateAndSubmitOrder() {
  var ok = true;
  REQ_ORDER.forEach(function(f){
    var el=document.getElementById(f.id); if(!el)return;
    if(!String(el.value).trim()){el.classList.add('invalid');el.classList.remove('valid');setErr(f.id,'▲ '+f.label+' 為必填');ok=false;}
    else{el.classList.remove('invalid');el.classList.add('valid');clearE(f.id);}
  });
  getRowIds().forEach(function(idx){
    ['product','batchNo','unitPrice','qty'].forEach(function(f){
      var el=document.getElementById('pr_'+f+'_'+idx); if(!el)return;
      var nm={product:'品項',batchNo:'生產批簽',unitPrice:'品項單價',qty:'數量'};
      if(!String(el.value).trim()){el.classList.add('invalid');var ee=document.getElementById('pre_'+f+'_'+idx);if(ee)ee.textContent='▲ '+nm[f]+' 為必填';ok=false;}
      else{el.classList.remove('invalid');el.classList.add('valid');var ee=document.getElementById('pre_'+f+'_'+idx);if(ee)ee.textContent='';}
    });
  });
  if (!ok){toast('⚠ 請填寫所有必填欄位','');var fi=document.querySelector('.fi.invalid');if(fi)fi.scrollIntoView({behavior:'smooth',block:'center'});return;}

  var rows=getRowIds().map(function(idx){
    var K=parseFloat(gv('pr_unitPrice_'+idx))||0,L=parseFloat(gv('pr_qty_'+idx))||0;
    var O=+(K*L).toFixed(2),M=+(O*.05).toFixed(2);
    return{product:gv('pr_product_'+idx),batchNo:gv('pr_batchNo_'+idx),unitPrice:K,qty:L,
           taxAmt:M,itemWithTax:+(O+M).toFixed(2),preTax:O,totalWithTax:+(O*1.05).toFixed(2)};
  });
  var sumP=rows.reduce(function(s,r){return s+r.totalWithTax;},0);
  var inc=gv('f_incomeAmt');
  var d={shipDate:gv('f_shipDate'),orderDate:gv('f_orderDate'),orderNo:gv('f_orderNo'),
         orderStatus:gv('f_orderStatus'),clientName:gv('f_clientName'),
         deliveryAddr:gv('f_deliveryAddr'),remark:gv('f_remark'),
         incomeAmt:inc?+parseFloat(inc).toFixed(2):'',
         totalWithTax:+sumP.toFixed(2),rows:rows};

  if(confirm('訂單號碼：'+d.orderNo+'\n客戶：'+d.clientName+'\n品項：'+d.rows.length+' 筆\n含稅總額：NT$'+d.totalWithTax.toLocaleString()+'\n\n確認提交？'))
    submitToGAS('appendOrder', d, 'btnSub');
}

/* ================================================================
   VALIDATE & SUBMIT 成本
   ================================================================ */
function validateAndSubmitCost() {
  var reqs=[{id:'c_date',label:'日期'},{id:'c_category',label:'項目類別'},{id:'c_amount',label:'金額'}];
  var ok=true;
  reqs.forEach(function(f){
    var el=document.getElementById(f.id); if(!el)return;
    var key=f.id.replace('c_','');
    if(!String(el.value).trim()){el.classList.add('invalid');var ee=document.getElementById('ce_'+key);if(ee)ee.textContent='▲ '+f.label+' 為必填';ok=false;}
    else{el.classList.remove('invalid');el.classList.add('valid');var ee=document.getElementById('ce_'+key);if(ee)ee.textContent='';}
  });
  if (!ok){toast('⚠ 請填寫所有必填欄位','');return;}

  var d={date:document.getElementById('c_date').value,
         category:document.getElementById('c_category').value,
         amount:parseFloat(document.getElementById('c_amount').value)||0,
         note:gv('c_note')};
  if(confirm('項目類別：'+d.category+'\n金額：NT$'+d.amount.toLocaleString()+'\n\n確認提交成本記錄？'))
    submitToGAS('appendCost', d, 'btnCost');
}

/* ================================================================
   SUBMIT — no-cors GET（最可靠跨域方式）
   送出後等 2.5 秒回到主畫面
   ================================================================ */
function submitToGAS(action, data, btnId) {
  showOverlay('寫入試算表中…');
  var btn = document.getElementById(btnId); if(btn) btn.disabled = true;

  try {
    var payload = encodeURIComponent(JSON.stringify(data));
    fetch(GAS_URL + '?action=' + action + '&data=' + payload, { method:'GET', mode:'no-cors' });
  } catch(e) {}

  // 等 GAS 寫完後刷新頁面（回到主畫面）
  setTimeout(function() {
    hideOverlay();
    toast('✓ 已提交', 'ok', 800);
    setTimeout(function() {
      // 刷新頁面，自然回到主畫面
      window.location.reload();
    }, 800);
  }, 2500);
}

/* ================================================================
   VALIDATION HELPERS
   ================================================================ */
function setErr(id, msg) {
  var el = document.getElementById('e_' + id.replace('f_','')); if(el) el.textContent = msg;
}
function clearE(id) { setErr(id, ''); }

function bindBlur() {
  REQ_ORDER.forEach(function(f){
    var el = document.getElementById(f.id); if(!el)return;
    el.addEventListener('blur', function(){
      if(!String(el.value).trim()) el.classList.add('invalid');
      else { el.classList.remove('invalid'); el.classList.add('valid'); clearE(f.id); }
    });
  });
}

/* ================================================================
   HELPERS
   ================================================================ */
function gv(id){ var el=document.getElementById(id); return el?el.value.trim():''; }
function setText(id,v){ var el=document.getElementById(id); if(el) el.textContent=v; }

var _tid;
function toast(msg, type, dur){
  var el=document.getElementById('toast');
  el.textContent=msg; el.className='toast '+(type||'')+' show';
  clearTimeout(_tid); _tid=setTimeout(function(){el.classList.remove('show');},dur||4000);
}
function showOverlay(msg){
  var t=document.getElementById('overlayTxt'); if(t) t.textContent=msg||'處理中…';
  var o=document.getElementById('overlay');    if(o) o.classList.add('show');
}
function hideOverlay(){ var o=document.getElementById('overlay'); if(o) o.classList.remove('show'); }

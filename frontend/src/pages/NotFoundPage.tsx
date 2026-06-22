import { useNavigate } from 'react-router-dom'

// Styles ported from 404_preview.html, scoped under `.nf404` so the global
// reset (`*`) and generic class names don't leak into the rest of the app.
const css = `
.nf404 *{box-sizing:border-box;margin:0;padding:0}
.nf404 .root{
  min-height:100vh;
  background:linear-gradient(160deg,#fff 0%,#edf2f9 50%,#e0e8f5 100%);
  display:flex;align-items:center;justify-content:center;
  padding:24px 16px;
  font-family:'Be Vietnam Pro',sans-serif;
  position:relative;overflow:hidden;
}
.nf404 .blob1{position:absolute;top:-80px;right:-80px;width:300px;height:300px;
  background:radial-gradient(circle,rgba(79,142,247,.12) 0%,transparent 70%);
  border-radius:50%;pointer-events:none;}
.nf404 .blob2{position:absolute;bottom:-60px;left:-60px;width:260px;height:260px;
  background:radial-gradient(circle,rgba(155,109,232,.10) 0%,transparent 70%);
  border-radius:50%;pointer-events:none;}
.nf404 .card{
  position:relative;z-index:1;
  background:rgba(255,255,255,.76);
  border:1px solid rgba(255,255,255,.9);
  border-radius:28px;
  box-shadow:0 8px 32px rgba(79,142,247,.10),0 2px 8px rgba(0,0,0,.06),inset 0 1px 0 rgba(255,255,255,.9);
  padding:44px 44px 40px;max-width:480px;width:100%;text-align:center;
  animation:nf404CardIn .65s cubic-bezier(.34,1.56,.64,1) both;
}
@keyframes nf404CardIn{from{opacity:0;transform:translateY(28px) scale(.96)}to{opacity:1;transform:none}}
.nf404 .badge{
  display:inline-flex;align-items:center;gap:6px;
  background:rgba(79,142,247,.09);border:1px solid rgba(79,142,247,.20);
  border-radius:99px;padding:4px 14px;
  font-size:12px;color:#4f8ef7;font-family:'Courier New',monospace;font-weight:700;
  margin-bottom:18px;animation:nf404FadeUp .5s ease .1s both;
}
@keyframes nf404FadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
.nf404 .dot{width:6px;height:6px;background:#4f8ef7;border-radius:50%;animation:nf404Pulse 1.8s ease-in-out infinite;}
@keyframes nf404Pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.4;transform:scale(.7)}}
.nf404 .num{
  font-size:clamp(76px,16vw,110px);font-weight:900;line-height:1;letter-spacing:-3px;
  background:linear-gradient(135deg,#4f8ef7 0%,#9b6de8 100%);
  -webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;
  margin-bottom:2px;animation:nf404NumPop .8s cubic-bezier(.34,1.56,.64,1) .15s both;
  display:inline-block;position:relative;overflow:hidden;
}
@keyframes nf404NumPop{from{opacity:0;transform:scale(.6)}to{opacity:1;transform:scale(1)}}
.nf404 .num::after{
  content:'';position:absolute;top:0;left:-120%;width:60%;height:100%;
  background:linear-gradient(90deg,transparent,rgba(255,255,255,.45),transparent);
  animation:nf404Shimmer 3.2s ease 1.5s infinite;
}
@keyframes nf404Shimmer{0%{left:-120%;opacity:0}40%{opacity:1}100%{left:160%;opacity:0}}
.nf404 .illo{margin:6px auto 18px;max-width:220px;animation:nf404Float 4s ease-in-out .5s infinite;}
@keyframes nf404Float{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}
.nf404 .divider{width:52px;height:3px;background:linear-gradient(90deg,#4f8ef7,#9b6de8);
  border-radius:99px;margin:0 auto 16px;animation:nf404FadeUp .5s ease .35s both;}
.nf404 h1{font-size:20px;font-weight:700;color:#1a2440;margin:0 0 9px;letter-spacing:-.3px;animation:nf404FadeUp .5s ease .4s both;}
.nf404 p{font-size:14px;color:#5a6a8a;line-height:1.65;margin:0 0 28px;animation:nf404FadeUp .5s ease .48s both;}
.nf404 .actions{display:flex;gap:10px;justify-content:center;flex-wrap:wrap;animation:nf404FadeUp .5s ease .55s both;}
.nf404 .btn-primary{
  background:linear-gradient(135deg,#4f8ef7 0%,#9b6de8 100%);color:#fff;
  border:none;height:42px;padding:0 22px;font-size:14px;font-weight:600;
  font-family:'Be Vietnam Pro',sans-serif;border-radius:10px;cursor:pointer;
  box-shadow:0 4px 16px rgba(79,142,247,.35);
  transition:transform .15s ease,box-shadow .15s ease;display:inline-flex;align-items:center;gap:7px;
}
.nf404 .btn-primary:hover{transform:translateY(-2px);box-shadow:0 8px 24px rgba(79,142,247,.45);}
.nf404 .btn-outline{
  background:transparent;color:#4f8ef7;border:1.5px solid #4f8ef7;
  height:42px;padding:0 20px;font-size:14px;font-weight:600;
  font-family:'Be Vietnam Pro',sans-serif;border-radius:10px;cursor:pointer;
  transition:transform .15s ease,background .15s ease;display:inline-flex;align-items:center;gap:7px;
}
.nf404 .btn-outline:hover{background:rgba(79,142,247,.07);transform:translateY(-2px);}
`

// Robot illustration kept as raw SVG markup (no interactivity needed) to avoid
// hand-converting dozens of kebab-case SVG attributes to JSX.
const robotSvg = `
<svg viewBox="0 0 320 260" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto">
  <defs>
    <linearGradient id="nfBG" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#e8edf5"/><stop offset="100%" stop-color="#c8d4e8"/></linearGradient>
    <linearGradient id="nfHG" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#dce6f5"/><stop offset="100%" stop-color="#b8ccec"/></linearGradient>
    <linearGradient id="nfSG" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#1a1a3e"/><stop offset="100%" stop-color="#0f0f2d"/></linearGradient>
    <linearGradient id="nfGB" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stop-color="#4f8ef7"/><stop offset="100%" stop-color="#9b6de8"/></linearGradient>
    <filter id="nfFw"><feDropShadow dx="0" dy="3" stdDeviation="5" flood-color="#4f8ef7" flood-opacity=".18"/></filter>
    <filter id="nfGw"><feGaussianBlur stdDeviation="2.5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  </defs>
  <ellipse cx="160" cy="248" rx="88" ry="9" fill="#b8c8e0" opacity=".35"/>
  <rect x="100" y="145" width="120" height="90" rx="14" fill="url(#nfBG)" filter="url(#nfFw)"/>
  <rect x="122" y="166" width="76" height="44" rx="5" fill="url(#nfSG)"/>
  <line x1="122" y1="179" x2="198" y2="179" stroke="#4f8ef7" stroke-width="1" opacity=".4"/>
  <line x1="122" y1="188" x2="198" y2="188" stroke="#9b6de8" stroke-width="1" opacity=".3"/>
  <text x="160" y="194" text-anchor="middle" font-family="monospace" font-weight="bold" font-size="15" fill="url(#nfGB)" filter="url(#nfGw)">404</text>
  <rect x="108" y="80" width="104" height="74" rx="16" fill="url(#nfHG)" filter="url(#nfFw)"/>
  <line x1="160" y1="80" x2="160" y2="58" stroke="#94a8cc" stroke-width="3" stroke-linecap="round"/>
  <circle cx="160" cy="52" r="7" fill="url(#nfGB)" filter="url(#nfGw)"/>
  <circle cx="160" cy="52" r="3.5" fill="white" opacity=".85"/>
  <rect x="121" y="96" width="32" height="24" rx="6" fill="url(#nfSG)"/>
  <circle cx="137" cy="108" r="7" fill="none" stroke="#4f8ef7" stroke-width="2"/>
  <circle cx="137" cy="108" r="3" fill="#4f8ef7" filter="url(#nfGw)"/>
  <rect x="167" y="96" width="32" height="24" rx="6" fill="url(#nfSG)"/>
  <path d="M 185 100 Q 192 105 185 109 Q 178 113 185 117" fill="none" stroke="#9b6de8" stroke-width="2" stroke-linecap="round" filter="url(#nfGw)"/>
  <circle cx="185" cy="117" r="1.5" fill="#9b6de8"/>
  <path d="M 138 126 Q 144 122 150 126 Q 156 130 162 126 Q 168 122 174 126" fill="none" stroke="#94a8cc" stroke-width="2.5" stroke-linecap="round"/>
  <rect x="115" y="232" width="28" height="18" rx="7" fill="#b0c4de"/>
  <rect x="177" y="232" width="28" height="18" rx="7" fill="#b0c4de"/>
  <rect x="110" y="246" width="36" height="10" rx="5" fill="#94a8cc"/>
  <rect x="174" y="246" width="36" height="10" rx="5" fill="#94a8cc"/>
  <rect x="68" y="150" width="36" height="16" rx="8" fill="url(#nfBG)" transform="rotate(-18 86 158)"/>
  <circle cx="63" cy="163" r="10" fill="url(#nfHG)" stroke="#b0c4de" stroke-width="2"/>
  <rect x="216" y="150" width="36" height="16" rx="8" fill="url(#nfBG)" transform="rotate(14 234 158)"/>
  <circle cx="258" cy="163" r="10" fill="url(#nfHG)" stroke="#b0c4de" stroke-width="2"/>
  <text x="42" y="116" font-family="Georgia,serif" font-size="22" fill="#9b6de8" opacity=".7" font-weight="bold" filter="url(#nfGw)">?</text>
  <text x="268" y="102" font-family="Georgia,serif" font-size="18" fill="#4f8ef7" opacity=".65" font-weight="bold" filter="url(#nfGw)">?</text>
  <text x="56" y="72" font-family="Georgia,serif" font-size="12" fill="#9b6de8" opacity=".45" font-weight="bold">?</text>
  <line x1="285" y1="180" x2="285" y2="248" stroke="#94a8cc" stroke-width="3" stroke-linecap="round"/>
  <rect x="262" y="183" width="48" height="20" rx="4" fill="#4f8ef7" opacity=".85"/>
  <text x="286" y="197" text-anchor="middle" font-family="monospace" font-size="8.5" fill="white" font-weight="bold">DASHBOARD</text>
  <rect x="258" y="208" width="52" height="20" rx="4" fill="#e85d8a" opacity=".75" transform="rotate(-7 284 218)"/>
  <text x="284" y="222" text-anchor="middle" font-family="monospace" font-size="8.5" fill="white" font-weight="bold" transform="rotate(-7 284 222)">???</text>
  <circle cx="92" cy="142" r="2" fill="#4f8ef7" opacity=".55"/>
  <circle cx="242" cy="136" r="2.2" fill="#9b6de8" opacity=".5"/>
  <circle cx="80" cy="200" r="1.5" fill="#4f8ef7" opacity=".4"/>
</svg>`

export function NotFoundPage() {
  const navigate = useNavigate()

  return (
    <div className="nf404">
      <style>{css}</style>
      <div className="root">
        <div className="blob1" />
        <div className="blob2" />
        <div className="card">
          <div className="badge"><span className="dot" />HTTP 404 · Not Found</div>
          <div className="num">404</div>
          <div className="illo" dangerouslySetInnerHTML={{ __html: robotSvg }} />
          <div className="divider" />
          <h1>Trang không tồn tại</h1>
          <p>
            Đường dẫn bạn truy cập không tồn tại hoặc đã bị xóa.<br />
            Hãy quay lại trang chủ hoặc kiểm tra lại đường dẫn.
          </p>
          <div className="actions">
            <button className="btn-primary" onClick={() => navigate('/projects')}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
              Về Dashboard
            </button>
            <button className="btn-outline" onClick={() => navigate(-1)}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="19" y1="12" x2="5" y2="12" />
                <polyline points="12 19 5 12 12 5" />
              </svg>
              Quay lại
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

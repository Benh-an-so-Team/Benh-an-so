import React, { useEffect } from 'react'

const FLOATING_PICS = [
  // 9 far
  { id: 'f1', cls: 'far', icon: 'cross', left: '8%', top: '15%', size: 24, depth: 6, dur: '5.2s', delay: '-1.4s' },
  { id: 'f2', cls: 'far', icon: 'pill', left: '22%', top: '75%', size: 26, depth: 7, dur: '6.1s', delay: '-3.2s' },
  { id: 'f3', cls: 'far', icon: 'syringe', left: '88%', top: '22%', size: 28, depth: 5, dur: '7.0s', delay: '-2.1s' },
  { id: 'f4', cls: 'far', icon: 'heart', left: '82%', top: '68%', size: 25, depth: 8, dur: '5.8s', delay: '-4.0s' },
  { id: 'f5', cls: 'far', icon: 'steth', left: '14%', top: '42%', size: 29, depth: 6, dur: '6.4s', delay: '-0.8s' },
  { id: 'f6', cls: 'far', icon: 'dna', left: '76%', top: '85%', size: 23, depth: 5, dur: '7.5s', delay: '-2.6s' },
  { id: 'f7', cls: 'far', icon: 'thermo', left: '32%', top: '88%', size: 27, depth: 7, dur: '5.5s', delay: '-1.9s' },
  { id: 'f8', cls: 'far', icon: 'clip', left: '92%', top: '48%', size: 22, depth: 6, dur: '6.8s', delay: '-3.5s' },
  { id: 'f9', cls: 'far', icon: 'pulse', left: '6%', top: '60%', size: 26, depth: 8, dur: '4.9s', delay: '-2.8s' },
  // 7 mid
  { id: 'm1', cls: 'mid', icon: 'shield', left: '12%', top: '26%', size: 38, depth: 14, dur: '5.9s', delay: '-2.4s' },
  { id: 'm2', cls: 'mid', icon: 'globe', left: '85%', top: '35%', size: 42, depth: 16, dur: '6.7s', delay: '-1.1s' },
  { id: 'm3', cls: 'mid', icon: 'cross', left: '18%', top: '82%', size: 36, depth: 12, dur: '7.2s', delay: '-3.7s' },
  { id: 'm4', cls: 'mid', icon: 'pill', left: '78%', top: '78%', size: 40, depth: 15, dur: '5.4s', delay: '-0.5s' },
  { id: 'm5', cls: 'mid', icon: 'syringe', left: '90%', top: '10%', size: 35, depth: 13, dur: '6.3s', delay: '-4.2s' },
  { id: 'm6', cls: 'mid', icon: 'heart', left: '5%', top: '72%', size: 44, depth: 17, dur: '7.8s', delay: '-1.8s' },
  { id: 'm7', cls: 'mid', icon: 'steth', left: '80%', top: '55%', size: 37, depth: 11, dur: '5.1s', delay: '-3.0s' },
  // 5 near
  { id: 'n1', cls: 'near', icon: 'dna', left: '2%', top: '38%', size: 52, depth: 24, dur: '6.5s', delay: '-1.5s' },
  { id: 'n2', cls: 'near', icon: 'pulse', left: '93%', top: '72%', size: 48, depth: 28, dur: '7.4s', delay: '-3.3s' },
  { id: 'n3', cls: 'near', icon: 'shield', left: '15%', top: '6%', size: 56, depth: 22, dur: '5.7s', delay: '-0.7s' },
  { id: 'n4', cls: 'near', icon: 'pill', left: '86%', top: '90%', size: 50, depth: 26, dur: '6.9s', delay: '-2.9s' },
  { id: 'n5', cls: 'near', icon: 'thermo', left: '28%', top: '12%', size: 46, depth: 20, dur: '7.1s', delay: '-4.1s' },
]

const SPARKS = [
  { id: 's1', left: '4%', sz: 3.2, dur: '10.5s', delay: '-2s', op: 0.65 },
  { id: 's2', left: '11%', sz: 2.4, dur: '14.2s', delay: '-7s', op: 0.5 },
  { id: 's3', left: '18%', sz: 4.0, dur: '9.8s', delay: '-4s', op: 0.8 },
  { id: 's4', left: '25%', sz: 2.8, dur: '12.6s', delay: '-11s', op: 0.45 },
  { id: 's5', left: '31%', sz: 3.5, dur: '11.0s', delay: '-1s', op: 0.7 },
  { id: 's6', left: '38%', sz: 2.2, dur: '16.5s', delay: '-8s', op: 0.4 },
  { id: 's7', left: '44%', sz: 4.2, dur: '8.9s', delay: '-5s', op: 0.85 },
  { id: 's8', left: '50%', sz: 3.0, dur: '13.1s', delay: '-12s', op: 0.6 },
  { id: 's9', left: '57%', sz: 2.5, dur: '15.0s', delay: '-3s', op: 0.55 },
  { id: 's10', left: '63%', sz: 3.8, dur: '10.2s', delay: '-9s', op: 0.75 },
  { id: 's11', left: '69%', sz: 2.6, dur: '12.4s', delay: '-6s', op: 0.5 },
  { id: 's12', left: '76%', sz: 4.5, dur: '9.4s', delay: '-13s', op: 0.9 },
  { id: 's13', left: '82%', sz: 2.9, dur: '14.8s', delay: '-2s', op: 0.6 },
  { id: 's14', left: '89%', sz: 3.6, dur: '11.5s', delay: '-10s', op: 0.7 },
  { id: 's15', left: '95%', sz: 2.3, dur: '16.0s', delay: '-4s', op: 0.45 },
  { id: 's16', left: '8%', sz: 3.4, dur: '13.5s', delay: '-8s', op: 0.6 },
  { id: 's17', left: '15%', sz: 2.7, dur: '10.8s', delay: '-1s', op: 0.5 },
  { id: 's18', left: '22%', sz: 4.1, dur: '12.0s', delay: '-11s', op: 0.8 },
  { id: 's19', left: '35%', sz: 2.6, dur: '15.2s', delay: '-5s', op: 0.55 },
  { id: 's20', left: '48%', sz: 3.9, dur: '9.6s', delay: '-9s', op: 0.75 },
  { id: 's21', left: '59%', sz: 2.8, dur: '14.0s', delay: '-3s', op: 0.6 },
  { id: 's22', left: '67%', sz: 4.4, dur: '8.5s', delay: '-7s', op: 0.85 },
  { id: 's23', left: '73%', sz: 3.1, dur: '11.8s', delay: '-13s', op: 0.65 },
  { id: 's24', left: '85%', sz: 2.4, dur: '16.2s', delay: '-6s', op: 0.4 },
  { id: 's25', left: '92%', sz: 3.7, dur: '10.5s', delay: '-2s', op: 0.7 },
  { id: 's26', left: '28%', sz: 3.3, dur: '13.0s', delay: '-10s', op: 0.65 },
]

function PortalCyberBackground() {
  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced) return

    const handleMouseMove = (e) => {
      const x = e.clientX / window.innerWidth - 0.5
      const y = e.clientY / window.innerHeight - 0.5
      const elements = document.querySelectorAll(
        '.portal-cyber-login-page .hud, .portal-cyber-login-page .pic'
      )
      elements.forEach((el) => {
        const d = Number(el.dataset.depth) || 10
        el.style.marginLeft = `${-x * d}px`
        el.style.marginTop = `${-y * d}px`
      })
    }

    window.addEventListener('mousemove', handleMouseMove, { passive: true })
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
    }
  }, [])

  return (
    <>
      {/* SVG Symbol Definitions */}
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
        <symbol id="cross" viewBox="0 0 24 24"><path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6z" /></symbol>
        <symbol id="steth" viewBox="0 0 24 24"><path d="M5 3v6a4 4 0 008 0V3M9 13v2a5 5 0 0010 0v-1" /><circle cx="19" cy="12" r="2" /></symbol>
        <symbol id="heart" viewBox="0 0 24 24"><path d="M12 21s-8-5-8-11a4.5 4.5 0 018-3 4.5 4.5 0 018 3c0 6-8 11-8 11z" /><path d="M7 12h3l1.5-3 2 6 1.5-3h2" /></symbol>
        <symbol id="globe" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" /></symbol>
        <symbol id="shield" viewBox="0 0 24 24"><path d="M12 3l7 3v6c0 5-3.5 7.5-7 9-3.5-1.5-7-4-7-9V6z" /><path d="M9 12l2 2 4-4" /></symbol>
        <symbol id="phone" viewBox="0 0 24 24"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2z" /></symbol>
        <symbol id="lock" viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 018 0v3" /></symbol>
        <symbol id="key" viewBox="0 0 24 24"><circle cx="8" cy="8" r="4" /><path d="M11 11l9 9m-4-2l2 2m-4 0l2 2" /></symbol>
        <symbol id="eye" viewBox="0 0 24 24"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></symbol>
        <symbol id="search" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></symbol>
        <symbol id="user" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4" /><path d="M4 21c1-4 4-6 8-6s7 2 8 6" /></symbol>
        <symbol id="folder" viewBox="0 0 24 24"><path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2z" /></symbol>
        <symbol id="pill" viewBox="0 0 24 24"><path d="M10.5 20.5a5 5 0 01-7-7l10-10a5 5 0 017 7z" /><path d="M8.5 8.5l7 7" /></symbol>
        <symbol id="syringe" viewBox="0 0 24 24"><path d="M17 3l4 4M19 5l-3 3M14 6l4 4-8 8-4-4zM9 15l-2-2M6 18l-3 3" /></symbol>
        <symbol id="dna" viewBox="0 0 24 24"><path d="M7 3c0 6 10 12 10 18M17 3c0 6-10 12-10 18M8 7h8M8 17h8M6.5 12h11" /></symbol>
        <symbol id="thermo" viewBox="0 0 24 24"><path d="M14 14.5V5a2 2 0 00-4 0v9.5a4 4 0 104 0z" /><path d="M12 9v7" /></symbol>
        <symbol id="clip" viewBox="0 0 24 24"><rect x="5" y="4" width="14" height="17" rx="2" /><path d="M9 4V3a1 1 0 011-1h4a1 1 0 011 1v1M9 11h6M9 15h6" /></symbol>
        <symbol id="pulse" viewBox="0 0 24 24"><path d="M3 12h4l2-5 4 10 2-5h6" /></symbol>
        <symbol id="mail" viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 6 9-6" /></symbol>
        <symbol id="idcard" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="9" cy="10" r="2" /><path d="M15 8h2m-2 4h2M6 16c0-1.5 1.5-2 3-2s3 .5 3 2m3 0h2" /></symbol>
      </svg>

      {/* Background Ambience */}
      <div className="cyber-glow glow-a" aria-hidden="true" />
      <div className="cyber-glow glow-b" aria-hidden="true" />
      <div className="cyber-grid" aria-hidden="true" />
      <div className="cyber-scan" aria-hidden="true" />

      {/* Holographic HUD Floating Panels */}
      <div className="hud h1" id="h1" data-depth="12">
        <div className="hud-row">
          <svg className="ic"><use href="#globe" /></svg>
          <b>MEDICAL NETWORK</b>
        </div>
        <small>Kết nối hồ sơ toàn quốc</small>
      </div>

      <div className="hud h2" id="h2" data-depth="14">
        <div className="hud-row">
          <svg className="ic"><use href="#heart" /></svg>
          <b>NHỊP TIM</b>
        </div>
        <div className="mini-ecg">
          <svg viewBox="0 0 100 24" preserveAspectRatio="none">
            <path pathLength="1" d="M0 12h20l4-8 5 16 4-16 3 8h64" />
          </svg>
        </div>
      </div>

      <div className="hud h3" id="h3" data-depth="10">
        <div className="hud-row">
          <svg className="ic"><use href="#steth" /></svg>
          <b>KHÁM TRỰC TUYẾN</b>
        </div>
        <small>Bác sĩ đang sẵn sàng</small>
      </div>

      <div className="hud h4" id="h4" data-depth="15">
        <div className="hud-row">
          <svg className="ic"><use href="#shield" /></svg>
          <b>BẢO MẬT</b>
        </div>
        <small>Mã hóa đầu cuối</small>
      </div>

      {/* Floating Depth Medical Icons */}
      <div id="picwrap" aria-hidden="true">
        {FLOATING_PICS.map((item) => (
          <div
            key={item.id}
            className={`pic ${item.cls}`}
            data-depth={item.depth}
            style={{
              left: item.left,
              top: item.top,
              width: `${item.size}px`,
              height: `${item.size}px`,
              '--d': item.dur,
              animationDelay: item.delay,
            }}
          >
            <svg className="ic"><use href={`#${item.icon}`} /></svg>
          </div>
        ))}
      </div>

      {/* Rising Sparks */}
      <div id="sparkwrap" aria-hidden="true">
        {SPARKS.map((spark) => (
          <div
            key={spark.id}
            className="spark"
            style={{
              left: spark.left,
              width: `${spark.sz}px`,
              height: `${spark.sz}px`,
              animationDuration: spark.dur,
              animationDelay: spark.delay,
              opacity: spark.op,
            }}
          />
        ))}
      </div>
    </>
  )
}

export default PortalCyberBackground

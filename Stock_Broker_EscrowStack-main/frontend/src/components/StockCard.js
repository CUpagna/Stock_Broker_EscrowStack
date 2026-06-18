import React, { useEffect, useRef, useState } from 'react';
import './StockCard.css';

export default function StockCard({ ticker, company, price, history = [], held = 0, avgPrice = null, onBuy, onSell, onUnsubscribe }) {
  const canvasRef = useRef(null);
  const [flashClass, setFlashClass] = useState('');

  const prevPrice = history.length > 1 ? history[history.length - 2] : price;
  const delta     = price && prevPrice ? price - prevPrice : 0;
  const pct       = prevPrice ? ((delta / prevPrice) * 100).toFixed(2) : 0;
  const isUp      = delta >= 0;
  const dir       = isUp ? 'up' : 'down';
  const arrow     = isUp ? '▲' : '▼';

  const pnl = held > 0 && avgPrice && price
    ? ((price - avgPrice) * held)
    : null;
  const pnlPct = held > 0 && avgPrice && price
    ? (((price - avgPrice) / avgPrice) * 100).toFixed(2)
    : null;

  useEffect(() => {
    if (history.length > 1) {
      setFlashClass('');
      setTimeout(() => setFlashClass(isUp ? 'flash-up' : 'flash-down'), 10);
    }
  }, [price, isUp]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || history.length === 0) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.offsetWidth || 200;
    const H = 48;
    canvas.width = W;
    canvas.height = H;

    const min = Math.min(...history);
    const max = Math.max(...history);
    const range = max - min || 1;
    const color = isUp ? '#3fb950' : '#f85149';

    ctx.clearRect(0, 0, W, H);
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, color + '44');
    grad.addColorStop(1, color + '00');

    ctx.beginPath();
    history.forEach((v, i) => {
      const x = (i / (history.length - 1)) * W;
      const y = H - ((v - min) / range) * (H - 4) - 2;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    const lastX = W;
    const lastY = H - ((history[history.length-1] - min) / range) * (H - 4) - 2;
    ctx.lineTo(lastX, H); ctx.lineTo(0, H); ctx.closePath();
    ctx.fillStyle = grad; ctx.fill();

    ctx.beginPath();
    history.forEach((v, i) => {
      const x = (i / (history.length - 1)) * W;
      const y = H - ((v - min) / range) * (H - 4) - 2;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.lineJoin = 'round'; ctx.stroke();
    ctx.beginPath();
    ctx.arc(lastX - 1, lastY, 3, 0, Math.PI * 2);
    ctx.fillStyle = color; ctx.fill();
  }, [history, isUp]);

  return (
    <div className={`portfolio-card ${flashClass}`}>
      <div className="card-header">
        <div>
          <div className="ticker-large">{ticker}</div>
          <div className="company-name">{company}</div>
        </div>
        <button className="sub-btn remove" style={{width:'auto',padding:'4px 10px'}} onClick={onUnsubscribe}>✕</button>
      </div>

      <div className="price-large">${price ? price.toFixed(2) : '---'}</div>

      <div className="price-change-row">
        <span className={`change-pill ${dir}`}>{arrow} ${Math.abs(delta).toFixed(2)} ({Math.abs(pct)}%)</span>
      </div>

      {/* Units held + P&L */}
      {held > 0 && (
        <div className="holdings-row">
          <div className="holdings-info">
            <span className="holdings-label">Held:</span>
            <strong>{held} unit{held !== 1 ? 's' : ''}</strong>
          </div>
          {pnl !== null && (
            <div className={`holdings-pnl ${pnl >= 0 ? 'up' : 'down'}`}>
              {pnl >= 0 ? '+' : ''}${pnl.toFixed(2)} ({pnlPct}%)
            </div>
          )}
        </div>
      )}
      {held === 0 && <div className="holdings-none">Not in portfolio</div>}

      <div className="mini-chart">
        <canvas ref={canvasRef} className="spark" />
      </div>

      {/* Buy / Sell buttons */}
      <div className="card-trade-row">
        <button className="card-trade-btn buy" onClick={onBuy}>🟢 Buy</button>
        <button className="card-trade-btn sell" onClick={onSell} disabled={held === 0}>🔴 Sell</button>
      </div>

      <div className="updated-at">Updated {new Date().toLocaleTimeString()}</div>
    </div>
  );
}
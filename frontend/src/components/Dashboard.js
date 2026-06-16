import React, { useEffect, useRef, useState, useCallback } from 'react';
import StockCard from './StockCard';
import './Dashboard.css';

const API = 'http://localhost:8000';
const WS_BASE = 'ws://localhost:8000';

const STOCKS_INFO = {
  GOOG: { name: 'Alphabet Inc.',   flag: '🔵' },
  TSLA: { name: 'Tesla Inc.',       flag: '⚡' },
  AMZN: { name: 'Amazon.com Inc.', flag: '🟠' },
  META: { name: 'Meta Platforms',  flag: '🔷' },
  NVDA: { name: 'NVIDIA Corp.',    flag: '🟢' },
};
const SUPPORTED = Object.keys(STOCKS_INFO);

export default function Dashboard({ user, onLogout }) {
  const [subscriptions, setSubscriptions] = useState(user.subscriptions || []);
  const [prices, setPrices]               = useState({});
  const [history, setHistory]             = useState({});
  const [lastUpdated, setLastUpdated]     = useState('—');
  const [portfolio, setPortfolio]         = useState(user.portfolio || {});
  const [cashBalance, setCashBalance]     = useState(user.cash_balance ?? 100000);
  const [transactions, setTransactions]   = useState([]);
  const [tradeModal, setTradeModal]       = useState(null); // { ticker, action }
  const [tradeUnits, setTradeUnits]       = useState(1);
  const [tradeMsg, setTradeMsg]           = useState('');
  const [tradeErr, setTradeErr]           = useState('');
  const [tradeLoading, setTradeLoading]   = useState(false);
  const [activeTab, setActiveTab]         = useState('portfolio'); // 'portfolio' | 'transactions'
  const wsRef = useRef(null);

  // WebSocket
  const connectWs = useCallback(() => {
    if (wsRef.current) wsRef.current.close();
    const ws = new WebSocket(`${WS_BASE}/ws/${encodeURIComponent(user.email)}`);
    wsRef.current = ws;
    ws.onmessage = (evt) => {
      const msg = JSON.parse(evt.data);
      if (msg.type === 'prices') {
        setPrices(prev => ({ ...prev, ...msg.data }));
        setHistory(prevHist => {
          const newHist = { ...prevHist };
          Object.keys(msg.data).forEach(ticker => {
            if (!newHist[ticker]) newHist[ticker] = Array(40).fill(msg.data[ticker]);
            newHist[ticker] = [...newHist[ticker].slice(-39), msg.data[ticker]];
          });
          return newHist;
        });
        setLastUpdated(new Date().toLocaleTimeString());
      }
    };
  }, [user.email]);

  useEffect(() => {
    connectWs();
    // Load portfolio from backend
    fetch(`${API}/portfolio/${user.email}`)
      .then(r => r.json())
      .then(d => {
        if (d.portfolio) setPortfolio(d.portfolio);
        if (d.cash_balance !== undefined) setCashBalance(d.cash_balance);
        if (d.transactions) setTransactions(d.transactions.reverse());
      })
      .catch(() => {});
    return () => { if (wsRef.current) wsRef.current.close(); };
  }, [connectWs, user.email]);

  const toggleSubscription = async (ticker, isSubbed) => {
    const endpoint = isSubbed ? '/unsubscribe' : '/subscribe';
    const res = await fetch(`${API}${endpoint}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: user.email, ticker }),
    });
    if (res.ok) {
      const data = await res.json();
      setSubscriptions(data.subscriptions);
    }
  };

  const openTrade = (ticker, action) => {
    setTradeModal({ ticker, action });
    setTradeUnits(1);
    setTradeMsg('');
    setTradeErr('');
  };

  const closeTrade = () => {
    setTradeModal(null);
    setTradeMsg('');
    setTradeErr('');
  };

  const executeTrade = async () => {
    if (!tradeModal) return;
    setTradeLoading(true);
    setTradeErr('');
    setTradeMsg('');
    try {
      const res = await fetch(`${API}/trade`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email, ticker: tradeModal.ticker, units: Number(tradeUnits), action: tradeModal.action }),
      });
      const data = await res.json();
      if (!res.ok) { setTradeErr(data.detail || 'Trade failed.'); return; }
      setPortfolio(data.portfolio);
      setCashBalance(data.cash_balance);
      setSubscriptions(data.subscriptions);
      setTradeMsg(data.message);
      // Refresh transactions
      fetch(`${API}/portfolio/${user.email}`)
        .then(r => r.json())
        .then(d => { if (d.transactions) setTransactions(d.transactions.reverse()); });
    } catch {
      setTradeErr('Cannot connect to server.');
    } finally { setTradeLoading(false); }
  };

  // Stats
  const portfolioValue = Object.entries(portfolio).reduce((sum, [ticker, pos]) => {
    return sum + (prices[ticker] ?? pos.avg_price) * pos.units;
  }, 0);
  const totalValue = cashBalance + portfolioValue;

  let best = { t: '—', pct: 0 }, worst = { t: '—', pct: 0 };
  if (subscriptions.length > 0) {
    const changes = subscriptions.map(t => {
      const hist = history[t] || [];
      const curr = prices[t];
      const prev = hist.length > 1 ? hist[hist.length - 2] : curr;
      return { t, pct: prev && curr ? ((curr - prev) / prev) * 100 : 0 };
    });
    if (changes.length > 0) {
      best  = changes.reduce((a, b) => a.pct > b.pct ? a : b);
      worst = changes.reduce((a, b) => a.pct < b.pct ? a : b);
    }
  }

  const totalStockUnits = Object.values(portfolio).reduce((s, p) => s + p.units, 0);
  const stockCount = Object.keys(portfolio).length;

  const tradePrice = tradeModal ? (prices[tradeModal.ticker] ?? BASE_PRICES_FALLBACK[tradeModal.ticker] ?? 0) : 0;
  const tradeCost  = tradePrice * (Number(tradeUnits) || 0);
  const heldUnits  = tradeModal ? (portfolio[tradeModal.ticker]?.units ?? 0) : 0;

  return (
    <div className="dash-layout">
      {/* NAV */}
      <nav>
        <div className="nav-logo">📈 TradeView</div>
        <div className="nav-right">
          <div className="live-badge"><div className="live-dot" /> LIVE</div>
          <div className="cash-display">💵 ${cashBalance.toLocaleString('en-US', {minimumFractionDigits:2,maximumFractionDigits:2})}</div>
          <div className="nav-user">
            <div className="avatar">{user.name ? user.name.slice(0,2).toUpperCase() : '?'}</div>
            <span>{user.name || user.email.split('@')[0]}</span>
          </div>
          <button className="btn-logout" onClick={onLogout}>Sign out</button>
        </div>
      </nav>

      <main className="dash-main">
        {/* STATS BAR */}
        <div className="stats-bar">
          <div className="stat-card">
            <div className="stat-label">Cash Balance</div>
            <div className="stat-value">${cashBalance.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Portfolio Value</div>
            <div className="stat-value accent">${portfolioValue.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Total Net Worth</div>
            <div className="stat-value">${totalValue.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Stocks Owned</div>
            <div className="stat-value">{stockCount} <span style={{fontSize:'0.75rem',color:'var(--muted)'}}>types</span></div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Total Units</div>
            <div className="stat-value">{totalStockUnits} <span style={{fontSize:'0.75rem',color:'var(--muted)'}}>shares</span></div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Best Performer</div>
            <div className={`stat-value ${best.t !== '—' && best.pct >= 0 ? 'up' : 'down'}`}>
              {best.t !== '—' ? `${best.t} ${best.pct >= 0 ? '+' : ''}${best.pct.toFixed(2)}%` : '—'}
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Last Updated</div>
            <div className="stat-value small">{lastUpdated}</div>
          </div>
        </div>

        {/* TABS */}
        <div className="dash-tabs">
          <button className={`dash-tab ${activeTab === 'portfolio' ? 'active' : ''}`} onClick={() => setActiveTab('portfolio')}>📊 Portfolio</button>
          <button className={`dash-tab ${activeTab === 'transactions' ? 'active' : ''}`} onClick={() => setActiveTab('transactions')}>📋 Transactions</button>
        </div>

        {activeTab === 'portfolio' && (
          <>
            {/* MY PORTFOLIO */}
            <div className="section-title" style={{marginTop:'1rem'}}>My Watchlist</div>
            <div className="portfolio-grid">
              {subscriptions.length === 0 ? (
                <div className="empty-state">No stocks in watchlist yet. Subscribe to stocks below to start tracking.</div>
              ) : (
                subscriptions.map(ticker => (
                  <StockCard
                    key={ticker}
                    ticker={ticker}
                    company={STOCKS_INFO[ticker]?.name}
                    price={prices[ticker] ?? null}
                    history={history[ticker] ?? []}
                    held={portfolio[ticker]?.units ?? 0}
                    avgPrice={portfolio[ticker]?.avg_price ?? null}
                    onBuy={() => openTrade(ticker, 'buy')}
                    onSell={() => openTrade(ticker, 'sell')}
                    onUnsubscribe={() => toggleSubscription(ticker, true)}
                  />
                ))
              )}
            </div>

            <hr className="section-divider" />

            {/* ALL STOCKS */}
            <div className="section-title">Available Stocks — Subscribe & Trade</div>
            <div className="all-stocks-grid">
              {SUPPORTED.map(ticker => {
                const isSub = subscriptions.includes(ticker);
                const curr = prices[ticker] || 0;
                const hist = history[ticker] || [];
                const prev = hist.length > 1 ? hist[hist.length - 2] : curr;
                const delta = curr - prev;
                const pct = prev ? ((delta / prev) * 100).toFixed(2) : '0.00';
                const dir = delta >= 0 ? 'up' : 'down';
                const arrow = delta >= 0 ? '▲' : '▼';
                const held = portfolio[ticker]?.units ?? 0;

                return (
                  <div key={ticker} className={`stock-tile ${isSub ? 'subscribed' : ''}`}>
                    {isSub && <div className="subscribed-badge" />}
                    <div className="tile-header">
                      <div>
                        <div className="ticker">{STOCKS_INFO[ticker].flag} {ticker}</div>
                        <div className="company">{STOCKS_INFO[ticker].name}</div>
                      </div>
                    </div>
                    <div className="price">${curr ? curr.toFixed(2) : '---'}</div>
                    <div className={`change ${dir}`}>{arrow} {Math.abs(pct)}%</div>
                    {held > 0 && <div className="held-badge">Held: {held} units</div>}
                    <div className="tile-actions">
                      <button className="tile-btn buy" onClick={() => openTrade(ticker, 'buy')}>Buy</button>
                      <button className="tile-btn sell" onClick={() => openTrade(ticker, 'sell')} disabled={held === 0}>Sell</button>
                    </div>
                    <button className={`sub-btn ${isSub ? 'remove' : 'add'}`} onClick={() => toggleSubscription(ticker, isSub)}>
                      {isSub ? '✕ Unwatch' : '+ Watch'}
                    </button>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {activeTab === 'transactions' && (
          <>
            <div className="section-title" style={{marginTop:'1rem'}}>Transaction History</div>
            {transactions.length === 0 ? (
              <div className="empty-state">No transactions yet. Buy or sell stocks to see your history here.</div>
            ) : (
              <div className="txn-table-wrap">
                <table className="txn-table">
                  <thead>
                    <tr>
                      <th>Date & Time</th><th>Action</th><th>Ticker</th><th>Units</th><th>Price</th><th>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map((txn, i) => (
                      <tr key={i} className={txn.action}>
                        <td>{txn.timestamp}</td>
                        <td><span className={`txn-badge ${txn.action}`}>{txn.action.toUpperCase()}</span></td>
                        <td><strong>{txn.ticker}</strong></td>
                        <td>{txn.units}</td>
                        <td>${txn.price.toFixed(2)}</td>
                        <td className={txn.action === 'buy' ? 'down' : 'up'}>{txn.action === 'buy' ? '-' : '+'}${txn.total.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </main>

      <footer>TradeView · Real-time market data · Updates every 5 seconds · Virtual trading only</footer>

      {/* TRADE MODAL */}
      {tradeModal && (
        <div className="modal-overlay" onClick={closeTrade}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className={`modal-action-label ${tradeModal.action}`}>
                {tradeModal.action === 'buy' ? '🟢 BUY' : '🔴 SELL'} {tradeModal.ticker}
              </div>
              <button className="modal-close" onClick={closeTrade}>✕</button>
            </div>
            <div className="modal-company">{STOCKS_INFO[tradeModal.ticker]?.name}</div>
            <div className="modal-price">Current Price: <strong>${tradePrice.toFixed(2)}</strong></div>
            {tradeModal.action === 'buy'
              ? <div className="modal-info">Available Cash: <strong>${cashBalance.toFixed(2)}</strong></div>
              : <div className="modal-info">You hold: <strong>{heldUnits} unit(s)</strong></div>
            }
            <label className="field-label" style={{marginTop:'1rem'}}>Number of Units</label>
            <input
              className="field-input"
              type="number"
              min="1"
              max={tradeModal.action === 'sell' ? heldUnits : undefined}
              value={tradeUnits}
              onChange={e => setTradeUnits(Math.max(1, parseInt(e.target.value) || 1))}
            />
            <div className="modal-total">
              Estimated Total: <strong className={tradeModal.action === 'buy' ? 'down' : 'up'}>
                {tradeModal.action === 'buy' ? '-' : '+'}${tradeCost.toFixed(2)}
              </strong>
            </div>
            {tradeErr && <div className="msg-error">{tradeErr}</div>}
            {tradeMsg && <div className="msg-success">{tradeMsg}</div>}
            {!tradeMsg && (
              <button
                className={`btn-trade ${tradeModal.action}`}
                onClick={executeTrade}
                disabled={tradeLoading || (tradeModal.action === 'sell' && heldUnits === 0)}
              >
                {tradeLoading ? 'Processing…' : `Confirm ${tradeModal.action === 'buy' ? 'Purchase' : 'Sale'}`}
              </button>
            )}
            {tradeMsg && <button className="btn-primary" style={{marginTop:'0.5rem'}} onClick={closeTrade}>Close</button>}
          </div>
        </div>
      )}
    </div>
  );
}

// Fallback prices if WS not connected yet
const BASE_PRICES_FALLBACK = { GOOG: 175, TSLA: 250, AMZN: 190, META: 520, NVDA: 950 };
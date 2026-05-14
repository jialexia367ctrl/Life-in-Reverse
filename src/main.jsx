import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  ArrowRight,
  Bandage,
  Bell,
  CupSoda,
  Flower2,
  Heart,
  Loader2,
  LockKeyhole,
  MessageCircle,
  RefreshCw,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { appApi, backendMode } from './lib/appApi';
import './styles.css';

const categories = [
  ['all', '全部'],
  ['work', '职场'],
  ['love', '情感'],
  ['family', '家庭'],
  ['health', '健康'],
  ['social', '人际'],
  ['other', '其他'],
];

const sorts = [
  ['pain_high', '最痛苦'],
  ['newest', '最新'],
  ['most_bought', '最畅销'],
  ['most_comforted', '最受安慰'],
];

const comfortItems = [
  ['tea', '暖茶', CupSoda],
  ['flower', '安慰鲜花', Flower2],
  ['bandage', '心灵创可贴', Bandage],
];

function App() {
  const currentPath = window.location.pathname;
  const [user, setUser] = useState(null);
  const [stories, setStories] = useState([]);
  const [rank, setRank] = useState(null);
  const [category, setCategory] = useState('all');
  const [sort, setSort] = useState('pain_high');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [selectedStory, setSelectedStory] = useState(null);
  const [draft, setDraft] = useState({
    title: '',
    content: '',
    category: 'work',
    pain_level: 5,
    price: 2.99,
  });

  const featured = stories[0];
  const totalPain = useMemo(() => stories.reduce((sum, story) => sum + Number(story.pain_level || 0), 0), [stories]);

  async function ensureUser() {
    const authUser = await appApi.ensureAuth();
    try {
      const profile = await appApi.getProfile();
      setUser(profile || authUser);
      return profile || authUser;
    } catch {
      setUser(authUser);
      return authUser;
    }
  }

  async function loadData() {
    setLoading(true);
    try {
      await ensureUser();
      const [storyResult, rankResult] = await Promise.all([
        appApi.getStories({ category, sort, page: 1, page_size: 12 }),
        appApi.getTragedyRank(),
      ]);
      const nextStories = storyResult.data || [];
      setStories(nextStories);
      setRank(rankResult);
      setSelectedStory((current) => current || nextStories[0] || null);
    } catch (err) {
      setMessage(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [category, sort]);

  async function publishStory(event) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      await appApi.publishStory(draft);
      setDraft({ title: '', content: '', category: 'work', pain_level: 5, price: 2.99 });
      setMessage('你的故事已匿名挂牌');
      await loadData();
    } catch (err) {
      setMessage(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function sendComfort(storyId, type) {
    setBusy(true);
    setMessage('');
    try {
      await appApi.sendComfort(storyId, type);
      setMessage('安慰已送达，对方会收到一点点光');
      await loadData();
    } catch (err) {
      setMessage(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function buyStory(storyId) {
    setBusy(true);
    setMessage('');
    try {
      const result = await appApi.createPayment(storyId);
      if (backendMode === 'supabase' && result.checkout_url) {
        window.location.href = result.checkout_url;
        return;
      }
      setMessage(`支付成功，交易号 ${result.transaction_id?.slice(0, 8) || 'local'}`);
      await loadData();
    } catch (err) {
      setMessage(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="app-shell">
      <div className="starfield" />
      {(currentPath === '/payment/success' || currentPath === '/payment/cancel') ? (
        <PaymentStatusPage currentPath={currentPath} />
      ) : (
        <>
      <nav className="nav">
        <a className="brand" href="#home" aria-label="反向人生交易所">
          <span className="brand-mark">R</span>
          <span>反向人生交易所</span>
        </a>
        <div className="nav-links">
          <a href="#market">交易大厅</a>
          <a href="#rank">悲剧榜</a>
          <a href="#publish">如何使用</a>
          <a href="#rules">规则与底线</a>
        </div>
        <div className="nav-actions">
          <span className="mode-pill">{backendMode === 'supabase' ? '生产模式' : '本地模式'}</span>
          <button className="ghost-icon" aria-label="通知"><Bell size={17} /></button>
          <div className="avatar-chip">
            {user ? <img src={user.avatar_url || user.user_metadata?.avatar_url} alt="匿名头像" /> : <Loader2 className="spin" size={18} />}
            <span>{user?.nickname || user?.user_metadata?.nickname || '匿名登录'}</span>
          </div>
        </div>
      </nav>

      <section className="hero" id="home">
        <div className="hero-copy">
          <p className="eyebrow">Reverse Life Exchange</p>
          <h1>你的<span>失败</span>，有人买单。</h1>
          <p className="hero-subtitle">把不能说出口的经历匿名挂牌。有人买走你的故事，也有人把安慰留给你。</p>
          <div className="hero-actions">
            <a className="primary-button" href="#publish">挂牌我的故事</a>
            <a className="secondary-button" href="#market">浏览故事大厅</a>
          </div>
        </div>
        <div className="neon-booth" aria-hidden="true">
          <div className="sign">REVERSE<br />LIFE EXCHANGE</div>
          <div className="door"><span /></div>
          <div className="person" />
        </div>
      </section>

      <section className="principles" id="rules">
        <div><LockKeyhole size={24} /><strong>匿名至上</strong><span>无需身份信息，保护你的隐私</span></div>
        <div><Sparkles size={24} /><strong>真实经历</strong><span>卖的是故事，不是虚假人设</span></div>
        <div><MessageCircle size={24} /><strong>轻量互动</strong><span>只交易和安慰，不做社交暴露</span></div>
        <div><ShieldCheck size={24} /><strong>安全第一</strong><span>产品入口始终指向求助资源</span></div>
      </section>

      <section className="market-layout" id="market">
        <div className="market-main">
          <div className="section-head">
            <div>
              <p className="eyebrow">Trade Hall</p>
              <h2>交易大厅</h2>
              <span>在别人的故事里，找到一点慰藉</span>
            </div>
            <button className="ghost-icon" onClick={loadData} aria-label="刷新"><RefreshCw size={18} /></button>
          </div>

          <div className="tabs">
            {categories.map(([value, label]) => (
              <button key={value} className={category === value ? 'active' : ''} onClick={() => setCategory(value)}>{label}</button>
            ))}
          </div>
          <div className="tabs subtle">
            {sorts.map(([value, label]) => (
              <button key={value} className={sort === value ? 'active' : ''} onClick={() => setSort(value)}>{label}</button>
            ))}
          </div>

          {loading ? (
            <div className="loading-card"><Loader2 className="spin" /> 正在读取匿名故事</div>
          ) : (
            <div className="story-grid">
              {stories.map((story) => (
                <article className={`story-card ${selectedStory?.id === story.id ? 'selected' : ''}`} key={story.id} onClick={() => setSelectedStory(story)}>
                  <div className="story-topline">
                    <span className={`tag tag-${story.category}`}>{categories.find(([v]) => v === story.category)?.[1] || story.category}</span>
                    <span className="pain">痛苦值 {story.pain_level}</span>
                  </div>
                  <h3>{story.title}</h3>
                  <p>{story.content}</p>
                  <div className="story-footer">
                    <strong>¥{Number(story.price).toFixed(2)}</strong>
                    <span><Heart size={14} /> {story.comfort_count}</span>
                    <span>{story.buy_count} 人购买</span>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>

        <aside className="detail-card">
          {selectedStory || featured ? (
            <StoryDetail
              story={selectedStory || featured}
              buyStory={buyStory}
              sendComfort={sendComfort}
              busy={busy}
            />
          ) : (
            <div className="empty-state">还没有故事上架</div>
          )}
        </aside>
      </section>

      <section className="lower-layout">
        <section className="publish-panel" id="publish">
          <div className="wizard-steps">
            <span className="active">1 填写故事</span>
            <span>2 设定价格</span>
            <span>3 确认发布</span>
          </div>
          <form onSubmit={publishStory}>
            <div className="section-head compact-head">
              <div>
                <p className="eyebrow">List Your Story</p>
                <h2>挂牌你的故事</h2>
                <span>把你的失败写成故事，换取陌生共鸣</span>
              </div>
            </div>
            <input maxLength={20} value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder="标题，不超过20字" required />
            <textarea value={draft.content} onChange={(event) => setDraft({ ...draft, content: event.target.value })} placeholder="按照“起因 - 经过 - 结果 - 感受”的结构写下你的故事" required minLength={20} />
            <div className="form-grid">
              <select value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value })}>
                {categories.filter(([value]) => value !== 'all').map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
              <input type="number" min="1" max="10" value={draft.pain_level} onChange={(event) => setDraft({ ...draft, pain_level: Number(event.target.value) })} />
              <input type="number" min="0.99" max="9.99" step="0.01" value={draft.price} onChange={(event) => setDraft({ ...draft, price: Number(event.target.value) })} />
            </div>
            <input type="range" min="1" max="10" value={draft.pain_level} onChange={(event) => setDraft({ ...draft, pain_level: Number(event.target.value) })} />
            <button className="primary-button" disabled={busy}>{busy ? '处理中...' : '下一步'}</button>
          </form>
          {message && <div className="toast">{message}</div>}
        </section>

        <section className="rank-panel" id="rank">
          <div className="metric-card">
            <p className="eyebrow">Mood Meter</p>
            <h2>今日情绪温度计</h2>
            <strong>{(rank?.today_stats?.total_stories || stories.length || 0).toLocaleString()}</strong>
            <span>总痛苦值 {totalPain} · 平均 {rank?.today_stats?.avg_pain || '0.0'}</span>
            <div className="chart">
              {[15, 28, 45, 62, 60, 76, 52, 86, 84, 80, 98].map((height, index) => <i key={index} style={{ height: `${height}%` }} />)}
            </div>
          </div>
          <div className="rank-table">
            <div className="section-head compact-head">
              <div>
                <p className="eyebrow">Top 10</p>
                <h2>今日悲剧榜</h2>
              </div>
            </div>
            <ol>
              {(rank?.top_stories || stories).slice(0, 10).map((story, index) => (
                <li key={story.id}>
                  <span className="rank-no">{index + 1}</span>
                  <span className="rank-title">{story.title}</span>
                  <span className="tag mini">{categories.find(([value]) => value === story.category)?.[1] || story.category}</span>
                  <strong>{story.pain_level}</strong>
                  <span>{story.comfort_count}</span>
                </li>
              ))}
            </ol>
            <a className="text-link" href="#market">查看完整榜单 <ArrowRight size={14} /></a>
          </div>
        </section>
      </section>

      <footer className="help-strip">
        <span>记住，你并不孤单。如果需要帮助，请联系可信任的人或本地心理援助热线。</span>
        <button>心理援助热线入口 <ArrowRight size={15} /></button>
      </footer>
        </>
      )}
    </main>
  );
}

function PaymentStatusPage({ currentPath }) {
  const isSuccess = currentPath === '/payment/success';

  return (
    <section className="status-shell">
      <div className="status-card">
        <p className="eyebrow">{isSuccess ? 'Payment Complete' : 'Payment Cancelled'}</p>
        <h1>{isSuccess ? '支付成功' : '你取消了支付'}</h1>
        <p className="status-copy">
          {isSuccess
            ? '故事已解锁。你买下的不只是全文，也是某个人把痛苦说出口的勇气。'
            : '故事还在交易大厅里等你。你可以先继续看看，也可以换一个更能打动你的故事。'}
        </p>
        <div className="hero-actions">
          <a className="primary-button" href="/">返回首页</a>
          <a className="secondary-button" href="/#market">去交易大厅</a>
        </div>
      </div>
    </section>
  );
}

function StoryDetail({ story, buyStory, sendComfort, busy }) {
  return (
    <>
      <div className="detail-nav">
        <span>← 返回大厅</span>
        <div>
          <LockKeyhole size={16} />
          <Heart size={16} />
        </div>
      </div>
      <h2>{story.title}</h2>
      <div className="detail-meta">
        <span>痛苦值 {story.pain_level}</span>
        <span>{story.buy_count} 人已购买</span>
      </div>
      <div className="detail-body">
        <strong>起因：</strong>
        <p>{story.content}</p>
        <strong>经过：</strong>
        <p>这段经历被匿名保存，只展示故事本身，不展示任何真实身份线索。</p>
        <strong>感受：</strong>
        <p>如果你也被类似情绪击中过，可以买下全文，或留下一份轻量安慰。</p>
      </div>
      <div className="payment-bar">
        <strong>¥{Number(story.price).toFixed(2)}</strong>
        <button className="primary-button" disabled={busy} onClick={() => buyStory(story.id)}>支付解锁全文</button>
      </div>
      <div className="comfort-row">
        <div>
          <strong>送出你的安慰剂</strong>
          <span>已送出 {story.comfort_count} 次</span>
        </div>
        <div className="comfort-actions">
          {comfortItems.map(([type, label, Icon]) => (
            <button key={type} onClick={() => sendComfort(story.id, type)} disabled={busy}>
              <Icon size={20} />
              <span>{label}</span>
              <small>¥0.99</small>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

createRoot(document.getElementById('root')).render(<App />);

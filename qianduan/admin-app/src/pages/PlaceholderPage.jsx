import { Construction } from "lucide-react";

export function PlaceholderPage({ title, description }) { return <section className="page-section"><header className="page-heading"><div><p className="eyebrow">PLANNED FEATURE</p><h1>{title}</h1><p>{description}</p></div></header><div className="placeholder-panel"><Construction size={30} /><h2>后端接口尚未提供</h2><p>此页面保留导航位置，不写模拟数据。接口完成后再接入真实配置与操作。</p></div></section>; }

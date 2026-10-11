import Link from "next/link";
import "./components/loading-screen.css";

export default function NotFound() {
  return <main className="mx-loading"><Link href="/" className="mx-loading-brand" aria-label="Medix, página inicial"><span>m<small>+</small></span>medix.</Link><section className="mx-loading-card"><div className="mx-loading-symbol" aria-hidden="true">?</div><p className="mx-loading-kicker">VAMOS ENCONTRAR SEU CAMINHO</p><h1>Esta página não foi encontrada.</h1><p>O endereço pode ter mudado. Volte para a página inicial para continuar.</p><Link href="/" className="mx-return-link">Voltar para o início <span aria-hidden="true">→</span></Link><div className="mx-loading-note">Tecnologia que aproxima. Cuidado que evolui.</div></section></main>;
}

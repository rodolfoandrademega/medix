import Link from "next/link";
import "./loading-screen.css";

export default function LoadingScreen({ title = "Preparando sua Medix.", description = "Estamos organizando seu espaço de cuidado.", error, retry }: { title?: string; description?: string; error?: string; retry?: () => void }) {
  return <main className="mx-loading"><Link href="/" className="mx-loading-brand" aria-label="Medix, página inicial"><span>m<small>+</small></span>medix.</Link><section className="mx-loading-card" role={error ? "alert" : "status"} aria-live="polite"><div className={`mx-loading-symbol ${error ? "error" : ""}`} aria-hidden="true">{error ? "!" : <span />}</div><p className="mx-loading-kicker">SEU ESPAÇO NA MEDIX</p><h1>{error ? "Vamos tentar novamente." : title}</h1><p>{error || description}</p>{error && retry && <button type="button" onClick={retry}>Tentar novamente <span aria-hidden="true">↻</span></button>}<div className="mx-loading-note">Tecnologia que aproxima. Cuidado que evolui.</div></section></main>;
}

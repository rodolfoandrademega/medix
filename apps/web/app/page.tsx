import Link from "next/link";
import type { Metadata } from "next";
import Faq from "./components/Faq";
import "./landing-extra.css";

type IconName = "arrow" | "calendar" | "users" | "chart" | "check" | "grid" | "bell" | "plus" | "shield" | "spark";

function Icon({ name, className = "" }: { name: IconName; className?: string }) {
  const paths: Record<IconName, React.ReactNode> = {
    arrow: <><path d="M5 12h14M13 6l6 6-6 6" /></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M7 3v4M17 3v4M3 10h18M8 14h2M14 14h2M8 18h2" /></>,
    users: <><circle cx="9" cy="8" r="3" /><path d="M3 21v-3a6 6 0 0 1 12 0v3M16 5a3 3 0 0 1 0 6M18 15a5 5 0 0 1 3 5" /></>,
    chart: <><path d="M4 4v16h16M8 15v-4M13 15V7M18 15v-6" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    grid: <><rect x="3" y="3" width="7" height="7" rx="2" /><rect x="14" y="3" width="7" height="7" rx="2" /><rect x="3" y="14" width="7" height="7" rx="2" /><rect x="14" y="14" width="7" height="7" rx="2" /></>,
    bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></>,
    plus: <path d="M12 5v14M5 12h14" />,
    shield: <><path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Z" /><path d="m8 12 3 3 5-6" /></>,
    spark: <path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3Z" />,
  };
  return <svg className={`ml-icon ${className}`} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

export const metadata: Metadata = {
  title: "Medix | Mais cuidado. Menos complicação.",
  description: "Organize a agenda, os pacientes e a equipe da sua clínica em um só lugar. Conheça a Medix e transforme a rotina de quem cuida.",
};

const specialties = ["Clínicas médicas", "Odontologia", "Psicologia", "Estética", "Clínicas multidisciplinares"];
const appointments = [
  { time: "09:00", name: "Mariana Costa", initials: "MC", type: "Primeira consulta", professional: "Dra. Ana Martins", color: "peach", status: "Confirmado" },
  { time: "09:45", name: "Pedro Almeida", initials: "PA", type: "Retorno", professional: "Dr. Rafael Lima", color: "purple", status: "Em atendimento" },
  { time: "10:30", name: "Camila Santos", initials: "CS", type: "Avaliação", professional: "Dra. Ana Martins", color: "green", status: "Confirmado" },
];

function DashboardPreview() {
  return <div className="ml-product-stage" id="preview">
    <div className="ml-stage-label"><span /> SUA CLÍNICA, EM SINTONIA</div>
    <div className="ml-dashboard">
      <aside className="ml-app-sidebar" aria-hidden="true">
        <span className="ml-app-symbol">m<span>+</span></span>
        <span><Icon name="grid" /></span><span className="selected"><Icon name="calendar" /></span><span><Icon name="users" /></span><span><Icon name="chart" /></span>
        <span className="ml-sidebar-avatar">AM</span>
      </aside>
      <div className="ml-app-content">
        <div className="ml-app-topbar"><span>Clínica Aurora <span className="ml-chevron">⌄</span></span><div><Icon name="bell" /><span className="ml-tiny-avatar">AM</span></div></div>
        <div className="ml-app-main">
          <div className="ml-app-greeting"><div><span>VISÃO GERAL</span><h3>Bom dia, Ana <span>☀</span></h3><p>Mais um dia para fazer a diferença.</p></div><span className="ml-date-chip">Hoje, 08 out.</span></div>
          <div className="ml-app-stats">
            <div><span><Icon name="calendar" /> Consultas hoje</span><strong>12<small>na sua agenda</small></strong><div className="ml-stat-line"><i /><i /><i /><i /><i /><i /><i /></div></div>
            <div><span><Icon name="users" /> Pacientes</span><strong>248<small>cadastrados</small></strong><span className="ml-stat-detail"><span /> Tudo em um só lugar</span></div>
          </div>
          <div className="ml-appointment-header"><h4>Agenda do dia <span>12</span></h4><span><Icon name="plus" /> Nova consulta</span></div>
          <div className="ml-appointments">{appointments.map((item) => <div className="ml-appointment" key={item.name}><time>{item.time}</time><span className={`ml-patient-avatar ${item.color}`}>{item.initials}</span><div><strong>{item.name}</strong><small>{item.type} · {item.professional}</small></div><span className={`ml-status ${item.status === "Em atendimento" ? "attending" : ""}`}>{item.status}</span></div>)}</div>
          <div className="ml-app-bottom"><span><i /> Sua equipe conectada</span><span>Ver agenda completa →</span></div>
        </div>
      </div>
    </div>
    <div className="ml-floating-note"><span className="ml-note-icon"><Icon name="check" /></span><div><strong>Tudo pronto para atender</strong><span>Agenda, pacientes e equipe organizados.</span></div></div>
    <p className="ml-preview-caption">Prévia ilustrativa da plataforma · dados fictícios</p>
  </div>;
}

export default function Home() {
  return <main className="medix-landing">
    <a href="#conteudo" className="ml-skip-link">Pular para o conteúdo</a>
    <header className="ml-header"><nav className="ml-wrap ml-nav" aria-label="Navegação principal">
      <Link href="/" className="ml-brand" aria-label="Medix, página inicial"><span className="ml-brand-symbol">m<span>+</span></span>medix<span className="ml-brand-dot">.</span></Link>
      <div className="ml-nav-sections"><a href="#recursos">A plataforma</a><a href="#solucoes">Para sua clínica</a><a href="#como-funciona">Como funciona</a></div>
      <div className="ml-nav-actions"><Link href="/auth" className="ml-login">Entrar</Link><Link href="/auth?mode=signup" className="ml-button ml-button-small">Começar agora <Icon name="arrow" /></Link></div>
    </nav></header>

    <section className="ml-hero ml-wrap" id="conteudo">
      <div className="ml-hero-copy"><div className="ml-eyebrow"><span className="ml-live-dot" /> MAIS LEVEZA NA ROTINA DA SUA CLÍNICA</div>
        <h1>Menos gestão.<br />Mais <span className="ml-care-word">cuidado.<svg viewBox="0 0 360 18" fill="none" aria-hidden="true"><path d="M3 12C93 1 213 1 355 9M24 16C115 7 245 7 331 14" stroke="currentColor" strokeWidth="3" strokeLinecap="round" /></svg></span></h1>
        <p>Da recepção ao consultório, conecte a rotina da sua clínica. Organize consultas, acompanhe o histórico dos pacientes e dê à sua equipe as informações de que ela precisa para atender melhor.</p>
        <ul className="ml-hero-benefits" aria-label="Benefícios para sua clínica">
          <li><Icon name="check" /><span><strong>Clareza em cada horário</strong> — veja consultas e acompanhe o status dos atendimentos.</span></li>
          <li><Icon name="check" /><span><strong>Continuidade no cuidado</strong> — reúna cadastro, anamnese e prontuário do paciente.</span></li>
          <li><Icon name="check" /><span><strong>Equipe em sintonia</strong> — organize os acessos conforme a função de cada pessoa.</span></li>
        </ul>
        <div className="ml-hero-actions"><Link href="/auth?mode=signup" className="ml-button">Quero organizar minha clínica <Icon name="arrow" /></Link><a href="#recursos" className="ml-text-link">Conhecer a plataforma <span>↗</span></a></div>
        <div className="ml-hero-assurances"><span><Icon name="check" /> Sem instalação</span><span><Icon name="check" /> Acesse de onde estiver</span></div>
        <div className="ml-hero-footnote"><span className="ml-footnote-icon"><Icon name="spark" /></span><p>Da recepção ao atendimento.<br /><strong>Uma rotina que funciona para toda a equipe.</strong></p></div>
      </div>
      <DashboardPreview />
    </section>

    <section className="ml-specialties" aria-label="Especialidades atendidas"><div className="ml-wrap"><p>Diferentes especialidades. <strong>O mesmo cuidado com a gestão.</strong></p><div>{specialties.map((name) => <span key={name}><Icon name="plus" />{name}</span>)}</div></div></section>

    <section className="ml-features ml-section ml-wrap" id="recursos">
      <div className="ml-section-heading"><div><span className="ml-eyebrow">UM LUGAR PARA TUDO FLUIR</span><h2>Uma rotina mais simples.<br /><span>Uma clínica mais conectada.</span></h2></div><p>As informações certas, nas mãos de quem precisa. Menos tarefas espalhadas, mais clareza em cada etapa do atendimento.</p></div>
      <div className="ml-feature-grid">
        <article className="ml-feature-card ml-feature-agenda"><span className="ml-feature-icon"><Icon name="calendar" /></span><h3>Uma agenda.<br />Todas as possibilidades.</h3><p>Troque a dúvida sobre o próximo horário por uma visão clara do dia. Acompanhe as consultas e mantenha a recepção informada sobre cada atendimento.</p><ul className="ml-feature-details"><li><Icon name="check" /> Visões por dia, semana e mês</li><li><Icon name="check" /> Status de consultas e registro de faltas</li><li><Icon name="check" /> Procedimentos, duração e observações</li></ul><div className="ml-calendar-mini" aria-hidden="true"><div><strong>Uma semana bem organizada</strong><Icon name="calendar" /></div><div className="ml-calendar-days">{["SEG", "TER", "QUA", "QUI", "SEX"].map((day, index) => <span className={index === 2 ? "active" : ""} key={day}><small>{day}</small><b>{5 + index}</b></span>)}</div><div className="ml-calendar-event"><i /><span>09:00<strong>Consulta · Dra. Ana Martins</strong></span><Icon name="check" /></div></div><a className="ml-card-link" href="#como-funciona">Organize sua agenda <Icon name="arrow" /></a></article>
        <article className="ml-feature-card ml-feature-patients"><span className="ml-feature-icon"><Icon name="users" /></span><h3>Cada paciente.<br />Mais perto de você.</h3><p>Encontre o que precisa antes de atender. Reúna os dados do paciente e os registros clínicos para acompanhar sua jornada com mais contexto.</p><ul className="ml-feature-details"><li><Icon name="check" /> Cadastro e contatos centralizados</li><li><Icon name="check" /> Anamnese e notas no prontuário</li><li><Icon name="check" /> Histórico dos atendimentos</li></ul><div className="ml-patient-mini" aria-hidden="true"><span className="ml-patient-avatar peach">MC</span><strong>Mariana Costa<small>Informações do paciente</small></strong><Icon name="check" /><div><span>Cadastro</span><span>Contatos</span><span>Consultas</span></div></div><a className="ml-card-link" href="#como-funciona">Conecte o cuidado <Icon name="arrow" /></a></article>
        <article className="ml-feature-card ml-feature-team"><span className="ml-feature-icon"><Icon name="grid" /></span><h3>Sua equipe.<br />Na mesma página.</h3><p>Cada pessoa com o acesso adequado ao seu trabalho. Conecte recepção, profissionais e gestão no ambiente da clínica, com responsabilidades bem definidas.</p><ul className="ml-feature-details"><li><Icon name="check" /> Convites para colaboradores</li><li><Icon name="check" /> Permissões por pessoa e função</li><li><Icon name="check" /> Gestão dos acessos da equipe</li></ul><div className="ml-team-mini" aria-hidden="true"><div><span className="ml-patient-avatar purple">AM</span><strong>Ana Martins<small>Administradora</small></strong><span className="ml-team-dot" /></div><div><span className="ml-patient-avatar green">RL</span><strong>Rafael Lima<small>Profissional</small></strong><span className="ml-team-dot" /></div><div><span className="ml-patient-avatar peach">JC</span><strong>Julia Carvalho<small>Recepção</small></strong><span className="ml-team-dot" /></div></div><a className="ml-card-link" href="#como-funciona">Aproxime sua equipe <Icon name="arrow" /></a></article>
      </div>
      <div className="ml-resource-extras" aria-label="Mais recursos para sua rotina">
        <article><span className="ml-extra-icon"><Icon name="spark" /></span><div><h3>Procedimentos organizados</h3><p>Cadastre os serviços da clínica com duração e valor e associe o procedimento à consulta na agenda.</p></div></article>
        <article><span className="ml-extra-icon"><Icon name="chart" /></span><div><h3>O dia da clínica em foco</h3><p>Consulte os agendamentos do dia, as consultas confirmadas e os cadastros recentes na visão geral.</p></div></article>
        <article><span className="ml-extra-icon"><Icon name="shield" /></span><div><h3>Acesso ao que cada pessoa precisa</h3><p>Defina quem pode acessar agenda, dados clínicos e gestão da equipe, de acordo com as permissões disponíveis.</p></div></article>
      </div>
    </section>

    <section className="ml-solutions" id="solucoes"><div className="ml-wrap ml-solutions-grid">
      <div className="ml-solutions-copy"><span className="ml-eyebrow">FEITA PARA QUEM CUIDA</span><h2>Por trás de um bom atendimento,<br /><span>uma gestão que funciona.</span></h2><p>Do primeiro contato à próxima consulta, a Medix ajuda cada pessoa da sua equipe a encontrar o que precisa.</p><Link href="/auth?mode=signup" className="ml-button ml-button-light">Trazer minha clínica para a Medix <Icon name="arrow" /></Link><div className="ml-solutions-detail"><Icon name="shield" /><span>Ambiente da clínica com acessos por função.</span></div></div>
      <div className="ml-role-list">{[
        { number: "01", title: "Para quem recebe", text: "Pacientes e horários à mão para uma recepção mais organizada.", icon: "calendar" as const },
        { number: "02", title: "Para quem atende", text: "Informações centralizadas para acompanhar cada paciente com atenção.", icon: "users" as const },
        { number: "03", title: "Para quem gerencia", text: "Uma visão da operação para coordenar pessoas e planejar os próximos passos.", icon: "chart" as const },
      ].map((role) => <article key={role.number}><span className="ml-role-number">{role.number}</span><div><h3>{role.title}</h3><p>{role.text}</p></div><Icon name={role.icon} /></article>)}</div>
    </div></section>

    <section className="ml-workflow ml-section ml-wrap" id="como-funciona"><div className="ml-centered-heading"><span className="ml-eyebrow">SEU PRÓXIMO PASSO PODE SER SIMPLES</span><h2>Uma nova rotina começa aqui.</h2><p>Prepare o ambiente da sua clínica e dê o primeiro passo com sua equipe.</p></div><div className="ml-steps">{[
      ["01", "Crie sua conta", "Cadastre seu acesso para iniciar a configuração da sua clínica."],
      ["02", "Prepare sua clínica", "Organize os dados da unidade e convide as pessoas da sua equipe."],
      ["03", "Conecte sua rotina", "Cadastre pacientes, organize os horários e acompanhe os atendimentos."],
    ].map(([number, title, description]) => <article key={number}><span>{number}</span><h3>{title}</h3><p>{description}</p></article>)}</div></section>

    <section className="ml-faq ml-wrap" id="duvidas"><div><span className="ml-eyebrow">BOM SABER ANTES DE COMEÇAR</span><h2>Vamos tirar{" "}<br /><span>suas dúvidas.</span></h2><p>Conheça um pouco mais sobre a Medix e como ela se encaixa na sua clínica.</p><a className="ml-text-link" href="mailto:contato@medix.app">Converse com a gente <Icon name="arrow" /></a></div><Faq /></section>

    <section className="ml-final-section ml-wrap"><div className="ml-final-cta"><div className="ml-cta-decoration" aria-hidden="true">+</div><span className="ml-eyebrow">MAIS TEMPO PARA O QUE IMPORTA</span><h2>Sua clínica merece<br />essa nova rotina.</h2><p>Cuide da gestão com a mesma atenção<br className="ml-desktop-break" /> que você dedica aos seus pacientes.</p><Link href="/auth?mode=signup" className="ml-button ml-button-white">Começar com a Medix <Icon name="arrow" /></Link><span className="ml-final-note">No navegador. Com a sua equipe. Do seu jeito.</span></div></section>

    <footer className="ml-footer ml-wrap"><div><Link href="/" className="ml-brand"><span className="ml-brand-symbol">m<span>+</span></span>medix<span className="ml-brand-dot">.</span></Link><p>Tecnologia que aproxima. Cuidado que evolui.</p></div><nav aria-label="Links do rodapé"><a href="#recursos">A plataforma</a><a href="#duvidas">Dúvidas</a><Link href="/auth">Entrar</Link></nav><span>© {new Date().getFullYear()} Medix<br />Feito para quem cuida.</span></footer>
  </main>;
}

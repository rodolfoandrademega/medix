"use client";

import { useState } from "react";

const items = [
  ["A Medix funciona para qual tipo de clínica?", "A plataforma foi pensada para clínicas de saúde, odontologia, estética, psicologia e demais operações que precisam organizar pacientes, agenda e equipe."],
  ["Meus dados ficam separados dos dados de outras clínicas?", "Sim. Cada clínica tem seu próprio ambiente e todos os registros são associados à clínica de origem, com regras de acesso no banco de dados."],
  ["Posso convidar minha equipe?", "Sim. Administradores podem convidar profissionais e recepcionistas, definindo permissões adequadas para cada função."],
  ["Preciso instalar algum programa?", "Não. A Medix funciona no navegador, no computador, tablet ou celular."],
];

export default function Faq() {
  const [open, setOpen] = useState(0);
  return <div className="faq-list">{items.map(([question, answer], index) => <article className={open === index ? "faq-item open" : "faq-item"} key={question}><button onClick={() => setOpen(open === index ? -1 : index)}><span>{question}</span><b>{open === index ? "−" : "+"}</b></button>{open === index && <p>{answer}</p>}</article>)}</div>;
}

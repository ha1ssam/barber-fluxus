import Link from 'next/link';
import { getCurrentUser } from '@/lib/auth/session';
import { formatBRL } from '@/lib/domain/money';
import { PLANS, TRIAL_DAYS } from '@/lib/domain/plans';
import { Icon, type IconName } from '@/components/ui/Icon';

const FEATURES: { icon: IconName; title: string; text: string }[] = [
  { icon: 'calendar-check', title: 'Agenda online 24h', text: 'Sua página com serviços, profissionais e horários livres. O cliente agenda sem precisar criar conta.' },
  { icon: 'whatsapp', title: 'WhatsApp que trabalha sozinho', text: 'Confirmação, lembrete na véspera e horas antes. O cliente responde SIM ou CANCELAR e a agenda se atualiza.' },
  { icon: 'wallet', title: 'Caixa e comissão', text: 'Feche o atendimento com a forma de pagamento, venda produtos no balcão e veja quanto pagar a cada profissional.' },
  { icon: 'purchase-tag', title: 'Fidelidade e indicação', text: 'Cartão de selos, cupons e indicação de amigos. Tudo aplicado no caixa, sem papel.' },
  { icon: 'chat', title: 'Mensagens automáticas', text: 'Pedido de avaliação, parabéns no aniversário e aquele “faz tempo que você não vem”.' },
  { icon: 'list-ul', title: 'Fila de espera ativa', text: 'Dia cheio? O cliente entra na fila e recebe um aviso quando alguém desmarca.' },
  { icon: 'line-chart', title: 'Relatórios que comparam', text: 'Faturamento, ticket médio, faltas e horários de pico, sempre contra o período anterior.' },
  { icon: 'rocket', title: 'Instala como app', text: 'Funciona no celular como um aplicativo, com aviso de reserva nova na hora.' },
];

export default async function Landing() {
  const user = await getCurrentUser();
  return (
    <div className="mk">
      <nav className="mk-nav">
        <Link href="/" aria-label="Fluxus">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logos/fluxus-full.svg" alt="Fluxus" />
        </Link>
        <div className="mk-nav-links">
          <a href="#recursos" className="hide-sm">Recursos</a>
          <a href="#planos" className="hide-sm">Planos</a>
          <Link href="/explorar" className="hide-sm">Explorar</Link>
          {user ? (
            <Link className="mk-btn" href="/painel">Ir para o painel</Link>
          ) : (
            <>
              <Link href="/entrar">Entrar</Link>
              <Link className="mk-btn" href="/cadastro">Testar grátis</Link>
            </>
          )}
        </div>
      </nav>

      <section className="mk-section mk-hero">
        <p className="mk-label">Para barbearias, salões e estética</p>
        <h1 style={{ marginTop: 12 }}>
          Agenda cheia. <em>Zero</em> mensagem no braço.
        </h1>
        <p className="mk-lead">Agendamento online, WhatsApp com lembretes, caixa, comissão e fidelidade num lugar só. Simples para o autônomo, completo para a equipe.</p>
        <div className="row" style={{ marginTop: 32, gap: 12 }}>
          <Link className="mk-btn" href="/cadastro">
            Começar {TRIAL_DAYS} dias grátis <Icon name="right-arrow-alt" size={16} />
          </Link>
          <Link className="mk-btn ghost" href="/barbearia-do-ze">
            Ver uma página de exemplo
          </Link>
        </div>
        <p style={{ marginTop: 16, fontSize: 13, color: 'var(--mk-muted)' }}>Sem cartão para testar. Cancele quando quiser.</p>
      </section>

      <section className="mk-section" id="recursos">
        <p className="mk-label">Recursos</p>
        <h2 className="mk-h2">Tudo o que a loja usa no dia a dia.</h2>
        <div className="mk-features">
          {FEATURES.map((f) => (
            <div key={f.title} className="mk-feature">
              <Icon name={f.icon} size={22} />
              <h3>{f.title}</h3>
              <p>{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mk-section" id="planos">
        <p className="mk-label">Planos</p>
        <h2 className="mk-h2">Preço de entrada baixo. Sem plano grátis que trava no meio.</h2>
        <div className="mk-plans">
          {Object.values(PLANS).map((p) => (
            <div key={p.id} className={`mk-plan ${p.id === 'equipe' ? 'featured' : ''}`}>
              <div>
                <h3>{p.name}</h3>
                <p style={{ fontSize: 14, color: 'var(--mk-muted)' }}>{p.tagline}</p>
              </div>
              <div className="mk-price">
                {formatBRL(p.priceCents)} <small>/mês</small>
              </div>
              <ul>
                {p.highlights.map((h) => (
                  <li key={h}>
                    <Icon name="check" size={16} />
                    {h}
                  </li>
                ))}
              </ul>
              <Link className={`mk-btn ${p.id === 'equipe' ? '' : 'ghost'}`} href="/cadastro" style={{ marginTop: 'auto' }}>
                Testar {TRIAL_DAYS} dias grátis
              </Link>
            </div>
          ))}
        </div>
      </section>

      <section className="mk-section" style={{ textAlign: 'center' }}>
        <h2 className="mk-h2" style={{ margin: '0 auto' }}>Sua página de agendamento no ar hoje.</h2>
        <div className="row" style={{ justifyContent: 'center', marginTop: 24 }}>
          <Link className="mk-btn" href="/cadastro">Criar minha conta</Link>
          <Link className="mk-btn ghost" href="/explorar">Sou cliente, quero agendar</Link>
        </div>
      </section>

      <footer className="mk-footer">© {new Date().getFullYear()} Fluxus · Agendamento para negócios de beleza</footer>
    </div>
  );
}

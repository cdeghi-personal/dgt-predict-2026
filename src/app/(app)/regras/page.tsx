'use client'

export default function RegrasPage() {
  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-dark">Regras do Predict 2026</h1>
        <p className="text-sm text-mid-gray">Como funciona o bolão da Copa do Mundo 2026</p>
      </div>

      {/* O que é */}
      <Section title="🏆 O que é o DGT Predict?">
        <p>
          O <strong>DGT Predict 2026</strong> é o bolão oficial da DGT para a Copa do Mundo de 2026.
          Todos os colaboradores podem participar — basta fazer seus palpites antes de cada jogo
          começar e torcer pelo seu resultado.
        </p>
        <p className="mt-2">
          Ao final do torneio, o colaborador com mais pontos acumulados será o grande campeão do bolão!
        </p>
      </Section>

      {/* Como palpitar */}
      <Section title="⚽ Como fazer um palpite?">
        <ol className="space-y-3 list-none">
          <Step n={1}>
            Acesse a tela <strong>Jogos</strong> no menu.
          </Step>
          <Step n={2}>
            Clique em qualquer jogo que ainda não começou para abrir o formulário de palpite.
          </Step>
          <Step n={3}>
            Digite o placar que você acredita que será o resultado final — por exemplo, <strong>Brasil 2 × 1 Argentina</strong>.
          </Step>
          <Step n={4}>
            Clique em <strong>"Confirmar Palpite"</strong>. Você pode alterar o palpite quantas vezes quiser até o jogo começar.
          </Step>
        </ol>
      </Section>

      {/* Prazo */}
      <Section title="⏰ Até quando posso palpitar?">
        <p>
          O prazo para registrar ou alterar um palpite encerra <strong>exatamente no horário de início do jogo</strong>.
          Após o apito inicial, o palpite fica bloqueado e não pode mais ser modificado.
        </p>
        <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
          ⚠️ Fique atento aos horários! Os jogos seguem o fuso horário de Brasília (UTC-3). Não deixe para a última hora.
        </div>
      </Section>

      {/* Pontuação */}
      <Section title="🎯 Sistema de pontuação">
        <p className="mb-3">Após cada jogo, os pontos são calculados automaticamente:</p>
        <div className="space-y-3">
          <ScoreCard
            icon="🎯"
            pts={10}
            color="amber"
            title="Placar exato"
            desc='Você acertou o placar cheio — ex.: palpitou "2 × 1" e o jogo terminou "2 × 1".'
          />
          <ScoreCard
            icon="✅"
            pts={5}
            color="green"
            title="Resultado correto"
            desc='Você errou o placar mas acertou quem ganhou ou que seria empate — ex.: palpitou "3 × 0" e o jogo terminou "1 × 0".'
          />
          <ScoreCard
            icon="❌"
            pts={0}
            color="red"
            title="Errou"
            desc='Você errou tanto o placar quanto o resultado do jogo.'
          />
        </div>
      </Section>

      {/* Exemplos */}
      <Section title="📖 Exemplos práticos">
        <div className="space-y-2">
          <Example palpite="2 × 1" resultado="2 × 1" pts={10} label="Placar exato" color="amber" />
          <Example palpite="3 × 0" resultado="1 × 0" pts={5}  label="Resultado certo" color="green" />
          <Example palpite="1 × 1" resultado="2 × 0" pts={0}  label="Errou" color="red" />
          <Example palpite="0 × 1" resultado="0 × 0" pts={0}  label="Errou" color="red" />
        </div>
      </Section>

      {/* Ranking */}
      <Section title="🏅 Ranking">
        <p>
          O <strong>Ranking</strong> é atualizado em tempo real conforme os jogos são finalizados.
          A classificação considera o total de pontos acumulados ao longo de toda a Copa.
        </p>
        <p className="mt-2">
          Em caso de empate na pontuação, o critério de desempate é o número de placares exatos (🎯).
        </p>
      </Section>

      {/* Dicas */}
      <Section title="💡 Dicas">
        <ul className="space-y-2 text-sm">
          <li className="flex gap-2"><span>→</span><span>Registre palpites para todos os jogos — mesmo um palpite de <strong>0 × 0</strong> pode render 5 pontos se o jogo terminar empatado.</span></li>
          <li className="flex gap-2"><span>→</span><span>Acompanhe a <strong>Classificação</strong> dos grupos para embasar seus palpites nas fases eliminatórias.</span></li>
          <li className="flex gap-2"><span>→</span><span>Use a tela <strong>Meus Palpites</strong> para ver seu histórico e acompanhar seus pontos a qualquer momento.</span></li>
        </ul>
      </Section>

      <p className="text-center text-xs text-mid-gray pb-4">
        Boa sorte a todos! 🇧🇷⚽
      </p>
    </div>
  )
}

// ─── Subcomponentes ────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-light-gray p-5">
      <h2 className="text-base font-bold text-dark mb-3">{title}</h2>
      <div className="text-sm text-dark/80 leading-relaxed">{children}</div>
    </div>
  )
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-3 items-start">
      <span className="shrink-0 w-6 h-6 rounded-full bg-dark text-white text-xs font-bold flex items-center justify-center mt-0.5">
        {n}
      </span>
      <span>{children}</span>
    </li>
  )
}

function ScoreCard({
  icon, pts, color, title, desc,
}: {
  icon: string; pts: number; color: 'amber' | 'green' | 'red'; title: string; desc: string
}) {
  const bg = { amber: 'bg-amber-50 border-amber-200', green: 'bg-green-50 border-green-200', red: 'bg-red-50 border-red-200' }[color]
  const badge = { amber: 'bg-amber-100 text-amber-800', green: 'bg-green-100 text-green-800', red: 'bg-red-100 text-red-700' }[color]
  return (
    <div className={`flex gap-3 p-3 rounded-xl border ${bg}`}>
      <span className="text-2xl shrink-0">{icon}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-semibold text-dark text-sm">{title}</span>
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${badge}`}>+{pts} pts</span>
        </div>
        <p className="text-xs text-dark/70">{desc}</p>
      </div>
    </div>
  )
}

function Example({
  palpite, resultado, pts, label, color,
}: {
  palpite: string; resultado: string; pts: number; label: string; color: 'amber' | 'green' | 'red'
}) {
  const badge = { amber: 'bg-amber-100 text-amber-800', green: 'bg-green-100 text-green-800', red: 'bg-red-100 text-red-700' }[color]
  return (
    <div className="flex items-center gap-3 text-xs py-2 border-b border-light-gray last:border-0">
      <div className="w-28 shrink-0">
        <span className="text-mid-gray">Palpite: </span>
        <span className="font-mono font-semibold text-dark">{palpite}</span>
      </div>
      <div className="w-32 shrink-0">
        <span className="text-mid-gray">Resultado: </span>
        <span className="font-mono font-semibold text-dark">{resultado}</span>
      </div>
      <span className={`px-2 py-0.5 rounded-full font-semibold ${badge}`}>{label}</span>
      <span className="ml-auto font-bold text-dark">+{pts} pts</span>
    </div>
  )
}

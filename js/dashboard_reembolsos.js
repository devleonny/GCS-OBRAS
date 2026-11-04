// DASHBOARD DE REEMBOLSOS (Reembolsos > Dashboard), só fin/diretoria/adm.
// Números prontos de /dashboard-reembolsos (dashboard_reembolsos.js no servidor); os gráficos
// são os mesmos do dashboard de chamados (dashboard_chamados.js). Período pelo vencimento.

const estadoDashRe = { empresa: '', preset: '12m', inicio: '', fim: '' }
const SERIES_PAGAMENTOS = [{ chave: 'pago', nome: 'Pago' }, { chave: 'aberto', nome: 'Em aberto' }]

async function telaDashboardReembolsos() {

    const { inicio, fim } = periodoPresetDash(estadoDashRe.preset)
    estadoDashRe.inicio ||= inicio
    estadoDashRe.fim ||= fim

    tela.innerHTML = `
        <div class="dash">
            <div class="dash-topo">
                <div>
                    <h2 class="dash-titulo">Dashboard de reembolsos</h2>
                    <p class="dash-subtitulo" id="dashReSubtitulo"></p>
                </div>
                <div class="dash-filtros">
                    <label class="dash-filtro">
                        <span>Empresa</span>
                        <select id="dashReEmpresa" onchange="filtrarDashReembolsos()"></select>
                    </label>
                    <label class="dash-filtro">
                        <span>Período (vencimento)</span>
                        <select id="dashRePreset" onchange="filtrarDashReembolsos(true)">
                            <option value="30d">Últimos 30 dias</option>
                            <option value="90d">Últimos 90 dias</option>
                            <option value="ano">Este ano</option>
                            <option value="12m">Últimos 12 meses</option>
                            <option value="personalizado">Personalizado</option>
                        </select>
                    </label>
                    <label class="dash-filtro dash-datas" id="dashReDatas">
                        <span>De / até</span>
                        <div>
                            <input type="date" id="dashReInicio" onchange="filtrarDashReembolsos()">
                            <input type="date" id="dashReFim" onchange="filtrarDashReembolsos()">
                        </div>
                    </label>
                </div>
            </div>
            <div id="dashReConteudo" class="dash-conteudo">
                <div class="dash-carregando"><img src="gifs/loading-gcs.png" alt="Carregando"></div>
            </div>
        </div>`

    document.getElementById('dashRePreset').value = estadoDashRe.preset
    document.getElementById('dashReInicio').value = estadoDashRe.inicio
    document.getElementById('dashReFim').value = estadoDashRe.fim
    document.getElementById('dashReDatas').hidden = estadoDashRe.preset !== 'personalizado'

    await carregarDashReembolsos()
}

async function filtrarDashReembolsos(trocouPreset = false) {
    const preset = document.getElementById('dashRePreset').value
    estadoDashRe.preset = preset
    estadoDashRe.empresa = document.getElementById('dashReEmpresa').value || ''
    document.getElementById('dashReDatas').hidden = preset !== 'personalizado'

    if (preset !== 'personalizado') {
        Object.assign(estadoDashRe, periodoPresetDash(preset))
    } else if (!trocouPreset) {
        estadoDashRe.inicio = document.getElementById('dashReInicio').value || estadoDashRe.inicio
        estadoDashRe.fim = document.getElementById('dashReFim').value || estadoDashRe.fim
    }
    document.getElementById('dashReInicio').value = estadoDashRe.inicio
    document.getElementById('dashReFim').value = estadoDashRe.fim

    await carregarDashReembolsos()
}

async function carregarDashReembolsos() {
    const conteudo = document.getElementById('dashReConteudo')
    if (!conteudo) return

    if (!conteudo.querySelector('.dash-carregando'))
        conteudo.classList.add('atualizando')

    try {
        const { token } = JSON.parse(localStorage.getItem('acesso') || '{}')
        const resposta = await fetch(`${api}/dashboard-reembolsos`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ empresa: estadoDashRe.empresa || null, inicio: estadoDashRe.inicio, fim: estadoDashRe.fim })
        })
        const retorno = await resposta.json().catch(() => ({}))
        if (!resposta.ok) throw new Error(retorno.mensagem || 'Falha ao carregar o dashboard.')

        if (!document.getElementById('dashReConteudo')) return
        desenharDashReembolsos(retorno)
    } catch (err) {
        console.error(err)
        conteudo.innerHTML = `<p class="dash-vazio">${textoDash(err.message)}</p>`
    } finally {
        conteudo.classList.remove('atualizando')
    }
}

function desenharDashReembolsos({ empresa, empresas, periodo, dados }) {

    const select = document.getElementById('dashReEmpresa')
    select.innerHTML = `<option value="">Todas as empresas</option>` +
        empresas.map(e => `<option value="${textoDash(e)}">${textoDash(e)}</option>`).join('')
    select.value = empresa || ''

    document.getElementById('dashReSubtitulo').textContent =
        `${empresa || 'Todas as empresas'} · vencimentos de ${dataDash(periodo.inicio)} a ${dataDash(periodo.fim)}`

    const conteudo = document.getElementById('dashReConteudo')

    if (!dados.quantidade) {
        conteudo.innerHTML = `<p class="dash-vazio">Nenhum pagamento com vencimento neste período.</p>`
        return
    }

    const situacao = nome => dados.situacoes.find(s => s.nome === nome) || { quantidade: 0, valor: 0 }
    const tipo = nome => dados.tipos.find(t => t.nome === nome) || { quantidade: 0, lancamentos: 0 }
    const pago = situacao('Pago'), aPagar = situacao('A pagar'), atrasado = situacao('Atrasado')
    const aprovacao = situacao('Em aprovação'), erro = situacao('Com erro')
    const qtd = n => `${numeroDash(n)} ${n === 1 ? 'pagamento' : 'pagamentos'}`
    const larguraMensal = Math.max(520, conteudo.clientWidth - 34)

    conteudo.innerHTML = `
        <section class="dash-kpis">
            <div class="dash-hero">
                <span class="dash-rotulo">Total de pagamentos no período</span>
                <span class="dash-hero-valor">${moedaDash(dados.total)}</span>
                ${deltaDash(dados.total, dados.totalAnterior, false, moedaDash)}
                <span class="dash-nota">${qtd(dados.quantidade)}</span>
            </div>
            ${tileDash('Pago', moedaDash(pago.valor), `<span class="dash-nota">${qtd(pago.quantidade)}</span>`)}
            ${tileDash('A pagar', moedaDash(aPagar.valor), `<span class="dash-nota">${qtd(aPagar.quantidade)} a vencer</span>`)}
            ${tileDash('Atrasado', moedaDash(atrasado.valor), `<span class="dash-nota">${qtd(atrasado.quantidade)}</span>`)}
            ${tileDash('Ticket médio', moedaDash(dados.ticketMedio), '<span class="dash-nota">por pagamento</span>')}
        </section>

        <section class="dash-atividades" aria-label="Situações e tipos de departamento">
            ${atividadeOrc('Em aprovação', numeroDash(aprovacao.quantidade), moedaDash(aprovacao.valor))}
            ${atividadeOrc('Com erro no Omie', numeroDash(erro.quantidade), moedaDash(erro.valor))}
            ${atividadeOrc('Departamentos fixos', moedaDash(tipo('Fixos').quantidade), qtd(tipo('Fixos').lancamentos))}
            ${atividadeOrc('Orçamentos e chamados', moedaDash(tipo('Orçamentos').quantidade + tipo('Chamados').quantidade), qtd(tipo('Orçamentos').lancamentos + tipo('Chamados').lancamentos))}
            ${atividadeOrc('Sem departamento', moedaDash(tipo('Sem departamento').quantidade), qtd(tipo('Sem departamento').lancamentos))}
        </section>

        <section class="dash-linha">
            <div class="dash-card">
                <h3>Departamentos por tipo</h3>
                ${barrasDash(dados.tipos, { total: dados.total, formatar: moedaDash })}
            </div>
            <div class="dash-card">
                <h3>Departamentos fixos</h3>
                ${barrasDash(dados.fixos, { formatar: moedaDash, complemento: d => qtd(d.lancamentos) })}
            </div>
        </section>

        <section class="dash-card">
            <h3>Pago e em aberto por mês de vencimento</h3>
            ${mensalDash(dados.mensal, larguraMensal, { series: SERIES_PAGAMENTOS, formatar: moedaCompletaDash, eixo: moedaDash })}
        </section>

        <section class="dash-linha dash-linha-mapa">
            <div class="dash-card">
                <h3>Custos de orçamentos e chamados por estado</h3>
                ${mapaDash(dados.porEstado, { formatar: moedaDash, descrever: moedaDash })}
            </div>
            <div class="dash-card">
                <h3>Orçamentos e chamados com mais custos</h3>
                ${projetosRe(dados.projetos)}
            </div>
        </section>

        <section class="dash-linha">
            <div class="dash-card">
                <h3>Categorias</h3>
                ${barrasDash(dados.categorias, { total: dados.total, formatar: moedaDash })}
            </div>
            <div class="dash-card">
                <h3>Fornecedores</h3>
                ${barrasDash(dados.fornecedores, { formatar: moedaDash, complemento: f => qtd(f.lancamentos) })}
            </div>
        </section>

        <section class="dash-linha">
            <div class="dash-card">
                <h3>Pagamentos por usuário</h3>
                ${barrasDash(dados.usuarios, { complemento: u => moedaDash(u.valor) })}
            </div>
            <div class="dash-card">
                <h3>Por empresa</h3>
                ${barrasDash(dados.empresas, { total: dados.total, formatar: moedaDash, complemento: e => qtd(e.lancamentos) })}
            </div>
        </section>

        <section class="dash-card">
            <h3>Pagamentos sem departamento <span class="dash-nota">${qtd(tipo('Sem departamento').lancamentos)} · ${moedaDash(tipo('Sem departamento').quantidade)} para ratear</span></h3>
            ${semDepartamentoRe(dados.semDepartamento, tipo('Sem departamento').lancamentos)}
        </section>

        <p class="dash-nota">Período pelo vencimento. Fora da análise: pagamentos cancelados, excluídos, reprovados e operações financeiras (CDB e pagamento de empréstimos).
            Departamentos pela parte de cada um na distribuição do pagamento; nomes iguais com e sem acento são somados juntos.</p>`

    ligarTooltipsDash(conteudo)
}

// Os maiores pagamentos sem departamento; a linha abre o pagamento para ratear.
function semDepartamentoRe(lista = [], total = 0) {
    if (!lista.length) return '<p class="dash-vazio">Todos os pagamentos do período têm departamento.</p>'
    const aviso = total > lista.length
        ? `<p class="dash-nota">Mostrando os ${lista.length} maiores de ${numeroDash(total)}.</p>`
        : ''
    return `
        ${aviso}
        <div class="dash-rolagem">
            <table class="dash-tabela dash-tabela-clicavel">
                <thead><tr><th>Vencimento</th><th>Fornecedor</th><th>Categoria</th><th>Empresa</th><th>Lançado por</th><th>Situação</th><th>Valor</th></tr></thead>
                <tbody>${lista.map(p => `
                    <tr tabindex="0" title="Abrir o pagamento" onclick="abrirDetalhesPagamentos('${textoDash(p.id)}')"
                        onkeydown="if (event.key === 'Enter') abrirDetalhesPagamentos('${textoDash(p.id)}')">
                        <td>${dataDash(p.vencimento)}</td>
                        <td>${textoDash(p.fornecedor || 'Não informado')}</td>
                        <td>${textoDash(p.categoria || '—')}</td>
                        <td>${textoDash(p.app || '')}</td>
                        <td>${textoDash(p.usuario || '')}</td>
                        <td>${textoDash(p.situacao)}</td>
                        <td>${moedaCompletaDash(p.valor)}</td>
                    </tr>`).join('')}
                </tbody>
            </table>
        </div>`
}

function projetosRe(projetos = []) {
    if (!projetos.length) return '<p class="dash-vazio">Nenhum custo ligado a orçamentos ou chamados.</p>'
    const maximo = Math.max(...projetos.map(p => p.quantidade)) || 1
    return `
        <table class="dash-tabela">
            <thead><tr><th>Departamento</th><th>Cliente</th><th>UF</th><th>Custo</th></tr></thead>
            <tbody>${projetos.map(p => `
                <tr>
                    <td>${textoDash(p.nome)}</td>
                    <td>${textoDash(p.cliente || '—')}</td>
                    <td>${textoDash(p.uf || '')}</td>
                    <td><span class="dash-celula-barra"><i style="width: ${p.quantidade / maximo * 100}%"></i><b>${moedaDash(p.quantidade)}</b></span></td>
                </tr>`).join('')}
            </tbody>
        </table>`
}
